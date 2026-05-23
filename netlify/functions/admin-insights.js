const https = require('https');

function json(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

function requestJson(url, options, body) {
  options = options || {};
  return new Promise(function(resolve, reject) {
    var req = https.request(url, options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        var parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch (e) { parsed = { raw: data }; }
        resolve({ statusCode: res.statusCode || 0, data: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function cleanPost(post) {
  post = post || {};
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

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  try {
    var adminPassword = process.env.SW_ADMIN_PASSWORD;
    var githubToken = process.env.SW_GITHUB_TOKEN;
    var repo = process.env.GITHUB_REPO || 'ashishkejriwalusa-prog/scalewise-calculator';
    var branch = process.env.GITHUB_BRANCH || 'main';
    var dataPath = process.env.GITHUB_DATA_PATH || 'sw-insights-data.json';

    if (!adminPassword) return json(500, { ok: false, error: 'SW_ADMIN_PASSWORD is not configured in Netlify.' });
    if (!githubToken) return json(500, { ok: false, error: 'SW_GITHUB_TOKEN is not configured in Netlify.' });

    var body = JSON.parse(event.body || '{}');
    if (body.password !== adminPassword) return json(401, { ok: false, error: 'Invalid admin password.' });

    var post = cleanPost(body.post || {});
    if (!post.title || !post.summary) return json(400, { ok: false, error: 'Title and summary are required.' });

    var apiUrl = 'https://api.github.com/repos/' + repo + '/contents/' + dataPath + '?ref=' + encodeURIComponent(branch);
    var headers = {
      Authorization: 'Bearer ' + githubToken,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ScaleWise-Insights-Admin'
    };

    var getResponse = await requestJson(apiUrl, { method: 'GET', headers: headers });
    if (getResponse.statusCode < 200 || getResponse.statusCode >= 300) {
      return json(500, { ok: false, error: 'Unable to read insights feed.' });
    }

    var currentFile = getResponse.data;
    var currentJson = JSON.parse(decodeBase64(currentFile.content));
    var posts = Array.isArray(currentJson.posts) ? currentJson.posts : [];
    posts.unshift(post);

    var updatedJson = JSON.stringify({ posts: posts }, null, 2) + '\n';
    var payload = JSON.stringify({
      message: 'Publish SW Insights article',
      content: encodeBase64(updatedJson),
      sha: currentFile.sha,
      branch: branch
    });

    var putResponse = await requestJson('https://api.github.com/repos/' + repo + '/contents/' + dataPath, {
      method: 'PUT',
      headers: Object.assign({}, headers, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) })
    }, payload);

    if (putResponse.statusCode < 200 || putResponse.statusCode >= 300) {
      return json(500, { ok: false, error: 'Unable to publish insight.' });
    }

    return json(200, { ok: true, post: post });
  } catch (error) {
    return json(500, { ok: false, error: error && error.message ? error.message : 'Unable to publish SW Insight.' });
  }
};
