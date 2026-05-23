const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

function cleanPost(post) {
  return {
    type: post.type === 'Case Study' ? 'Case Study' : 'Article',
    poster: String(post.poster || 'ScaleWise').trim(),
    title: String(post.title || '').trim(),
    summary: String(post.summary || '').trim(),
    date: String(post.date || new Date().toISOString().slice(0, 10)).trim(),
    fileName: String(post.fileName || '').trim(),
    fileData: String(post.fileData || '').trim()
  };
}

function decodeBase64(value) {
  return Buffer.from(value || '', 'base64').toString('utf8');
}

function encodeBase64(value) {
  return Buffer.from(value || '', 'utf8').toString('base64');
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    const adminPassword = process.env.SW_ADMIN_PASSWORD;
    const githubToken = process.env.SW_GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO || 'ashishkejriwalusa-prog/scalewise-calculator';
    const branch = process.env.GITHUB_BRANCH || 'main';
    const dataPath = process.env.GITHUB_DATA_PATH || 'sw-insights-data.json';

    if (!adminPassword) return json(500, { ok: false, error: 'SW_ADMIN_PASSWORD is not configured in Netlify.' });
    if (!githubToken) return json(500, { ok: false, error: 'SW_GITHUB_TOKEN is not configured in Netlify.' });

    const body = JSON.parse(event.body || '{}');
    if (body.password !== adminPassword) return json(401, { ok: false, error: 'Invalid admin password.' });

    const post = cleanPost(body.post || {});
    if (!post.title || !post.summary) return json(400, { ok: false, error: 'Title and summary are required.' });

    const apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + dataPath + '?ref=' + encodeURIComponent(branch);
    const headers = {
      Authorization: 'Bearer ' + githubToken,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ScaleWise-Insights-Admin'
    };

    const getResponse = await fetch(apiUrl, { headers });
    if (!getResponse.ok) {
      const text = await getResponse.text();
      return json(500, { ok: false, error: 'Unable to read insights feed.' });
    }

    const currentFile = await getResponse.json();
    const currentJson = JSON.parse(decodeBase64(currentFile.content));
    const posts = Array.isArray(currentJson.posts) ? currentJson.posts : [];
    posts.unshift(post);

    const updatedJson = JSON.stringify({ posts }, null, 2) + '\n';

    const putResponse = await fetch('https://api.github.com/repos/' + repo + '/contents/' + dataPath, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'Publish SW Insights article',
        content: encodeBase64(updatedJson),
        sha: currentFile.sha,
        branch: branch
      })
    });

    if (!putResponse.ok) {
      return json(500, { ok: false, error: 'Unable to publish insight.' });
    }

    return json(200, { ok: true, post });
  } catch (error) {
    return json(500, { ok: false, error: error.message || 'Unable to publish SW Insight.' });
  }
};
