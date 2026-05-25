const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const FOLDER_PATH = 'ScaleWise/SW Insights';
const MANIFEST_NAME = 'insights.json';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  function response(statusCode, payload) {
    return { statusCode, headers, body: JSON.stringify(payload) };
  }

  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;
  const oneDriveUser = process.env.ONEDRIVE_USER || 'info@scalewise.group';

  if (!tenantId || !clientId || !clientSecret) {
    return response(200, {
      ok: false,
      posts: [],
      source: 'local-fallback',
      message: 'OneDrive sync is not active. Add MS_TENANT_ID, MS_CLIENT_ID, and MS_CLIENT_SECRET in Netlify environment variables.'
    });
  }

  async function getToken() {
    const body = new URLSearchParams();
    body.set('client_id', clientId);
    body.set('scope', 'https://graph.microsoft.com/.default');
    body.set('client_secret', clientSecret);
    body.set('grant_type', 'client_credentials');
    const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Microsoft Graph token request failed.');
    return data.access_token;
  }

  async function graph(token, url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    if (res.status === 404) return { notFound: true };
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
    if (!res.ok) throw new Error((data && (data.error?.message || data.message)) || `Graph request failed: ${res.status}`);
    return data;
  }

  function driveBase() {
    return `${GRAPH_ROOT}/users/${encodeURIComponent(oneDriveUser)}/drive/root`;
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  async function ensureFolder(token) {
    const segments = FOLDER_PATH.split('/');
    let current = '';
    for (const segment of segments) {
      const parentPath = current ? `:/${encodePath(current)}:/children` : '/children';
      const createUrl = `${driveBase()}${parentPath}`;
      current = current ? `${current}/${segment}` : segment;
      const checkUrl = `${driveBase()}:/${encodePath(current)}`;
      const existing = await graph(token, checkUrl).catch(() => ({ notFound: true }));
      if (!existing.notFound) continue;
      await graph(token, createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segment, folder: {}, '@microsoft.graph.conflictBehavior': 'replace' })
      });
    }
  }

  async function readManifest(token) {
    await ensureFolder(token);
    const url = `${driveBase()}:/${encodePath(`${FOLDER_PATH}/${MANIFEST_NAME}`)}:/content`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 404) return [];
    const text = await res.text();
    if (!res.ok) throw new Error(`Could not read SW Insights manifest: ${res.status}`);
    try {
      const parsed = JSON.parse(text || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  async function writeManifest(token, posts) {
    await ensureFolder(token);
    const url = `${driveBase()}:/${encodePath(`${FOLDER_PATH}/${MANIFEST_NAME}`)}:/content`;
    await graph(token, url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posts, null, 2)
    });
  }

  function safeFileName(name) {
    const cleaned = String(name || 'attachment').replace(/[\\/:*?"<>|#%{}~&]/g, '-').replace(/\s+/g, ' ').trim();
    return cleaned || 'attachment';
  }

  function dataUrlToBuffer(dataUrl) {
    const value = String(dataUrl || '');
    const match = value.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { mime: 'application/octet-stream', buffer: Buffer.alloc(0) };
    return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
  }

  async function uploadAttachment(token, id, fileName, fileData) {
    if (!fileData) return null;
    const { mime, buffer } = dataUrlToBuffer(fileData);
    if (!buffer.length) return null;
    const finalName = `${id}-${safeFileName(fileName)}`;
    const path = `${FOLDER_PATH}/attachments/${finalName}`;
    await ensureFolder(token);
    const attachmentsFolder = await graph(token, `${driveBase()}:/${encodePath(`${FOLDER_PATH}/attachments`)}`).catch(() => ({ notFound: true }));
    if (attachmentsFolder.notFound) {
      await graph(token, `${driveBase()}:/${encodePath(FOLDER_PATH)}:/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'attachments', folder: {}, '@microsoft.graph.conflictBehavior': 'replace' })
      });
    }
    const uploadUrl = `${driveBase()}:/${encodePath(path)}:/content`;
    const item = await graph(token, uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: buffer
    });
    return {
      fileName: safeFileName(fileName),
      storedName: finalName,
      oneDriveId: item.id || '',
      fileUrl: item.webUrl || '',
      mime
    };
  }

  async function deleteAttachment(token, post) {
    const storedName = post && (post.storedName || post.attachment?.storedName);
    if (!storedName) return;
    const path = `${FOLDER_PATH}/attachments/${storedName}`;
    const url = `${driveBase()}:/${encodePath(path)}`;
    await graph(token, url, { method: 'DELETE' }).catch(() => null);
  }

  try {
    const token = await getToken();

    if (event.httpMethod === 'GET') {
      const posts = await readManifest(token);
      return response(200, { ok: true, posts, source: 'onedrive', user: oneDriveUser });
    }

    const body = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'POST') {
      const posts = await readManifest(token);
      const id = body.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const attachment = await uploadAttachment(token, id, body.fileName, body.fileData);
      const post = {
        id,
        type: body.type || 'Article',
        poster: body.poster || 'ScaleWise',
        title: body.title || 'Untitled',
        summary: body.summary || '',
        date: body.date || new Date().toLocaleDateString('en-US'),
        fileName: attachment ? attachment.fileName : '',
        fileUrl: attachment ? attachment.fileUrl : '',
        storedName: attachment ? attachment.storedName : '',
        oneDriveId: attachment ? attachment.oneDriveId : '',
        source: 'onedrive'
      };
      posts.unshift(post);
      await writeManifest(token, posts);
      return response(200, { ok: true, post, posts, source: 'onedrive' });
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id || body.id;
      if (!id) return response(400, { ok: false, error: 'Missing id.' });
      const posts = await readManifest(token);
      const index = posts.findIndex(post => String(post.id) === String(id));
      if (index >= 0) {
        const [removed] = posts.splice(index, 1);
        await deleteAttachment(token, removed);
        await writeManifest(token, posts);
      }
      return response(200, { ok: true, posts, source: 'onedrive' });
    }

    return response(405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    return response(200, {
      ok: false,
      posts: [],
      source: 'onedrive-error',
      error: error.message || 'OneDrive sync failed.'
    });
  }
};
