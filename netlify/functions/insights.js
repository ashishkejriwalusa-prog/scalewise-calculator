const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

async function getMicrosoftToken() {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Microsoft Graph credentials are not configured.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.set('client_id', clientId);
  params.set('client_secret', clientSecret);
  params.set('scope', 'https://graph.microsoft.com/.default');
  params.set('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Microsoft token request failed: ${message}`);
  }

  const data = await response.json();
  return data.access_token;
}

function normalizePosts(input) {
  const posts = Array.isArray(input) ? input : Array.isArray(input?.posts) ? input.posts : [];
  return posts
    .filter(post => post && post.title && post.summary)
    .map(post => ({
      type: post.type || 'Article',
      poster: post.poster || 'ScaleWise',
      title: post.title,
      summary: post.summary,
      date: post.date || '',
      fileName: post.fileName || '',
      fileData: post.fileData || post.attachmentUrl || post.url || ''
    }));
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    let raw;

    if (process.env.SW_INSIGHTS_JSON_URL) {
      const response = await fetch(process.env.SW_INSIGHTS_JSON_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Cloud JSON URL failed with status ${response.status}`);
      raw = await response.json();
    } else if (process.env.MS_GRAPH_INSIGHTS_CONTENT_URL) {
      const token = await getMicrosoftToken();
      const response = await fetch(process.env.MS_GRAPH_INSIGHTS_CONTENT_URL, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(`Microsoft Graph content request failed: ${message}`);
      }
      raw = await response.json();
    } else {
      return json(200, {
        source: 'not_configured',
        posts: [],
        message: 'Cloud source is ready but not configured in Netlify environment variables.'
      });
    }

    return json(200, {
      source: process.env.SW_INSIGHTS_JSON_URL ? 'cloud_url' : 'microsoft_graph',
      posts: normalizePosts(raw)
    });
  } catch (error) {
    return json(200, {
      source: 'error',
      posts: [],
      message: error.message || 'Unable to load SW Insights cloud content.'
    });
  }
};
