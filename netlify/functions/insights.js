const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

function normalizePosts(input) {
  const posts = Array.isArray(input) ? input : input && Array.isArray(input.posts) ? input.posts : [];
  return posts
    .filter((post) => post && post.title && post.summary)
    .map((post) => ({
      type: post.type || 'Article',
      poster: post.poster || 'ScaleWise',
      title: post.title,
      summary: post.summary,
      date: post.date || '',
      fileName: post.fileName || '',
      fileData: post.fileData || post.attachmentUrl || post.url || ''
    }));
}

function getFallbackUrl(event) {
  const host = event.headers.host || event.headers.Host;
  const proto = event.headers['x-forwarded-proto'] || 'https';
  if (!host) return '';
  return proto + '://' + host + '/sw-insights-data.json';
}

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    const dataUrl = process.env.SW_INSIGHTS_JSON_URL || getFallbackUrl(event);

    if (!dataUrl) {
      return json(200, {
        source: 'not_configured',
        posts: [],
        message: 'SW Insights cloud feed is ready but no cloud URL is available.'
      });
    }

    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Cloud JSON URL failed with status ' + response.status);
    const raw = await response.json();

    return json(200, {
      source: process.env.SW_INSIGHTS_JSON_URL ? 'external_cloud_url' : 'site_cloud_feed',
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
