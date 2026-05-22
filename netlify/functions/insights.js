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

exports.handler = async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    if (!process.env.SW_INSIGHTS_JSON_URL) {
      return json(200, {
        source: 'not_configured',
        posts: [],
        message: 'Cloud source is ready. Add SW_INSIGHTS_JSON_URL in Netlify environment variables.'
      });
    }

    const response = await fetch(process.env.SW_INSIGHTS_JSON_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('Cloud JSON URL failed with status ' + response.status);
    const raw = await response.json();

    return json(200, {
      source: 'cloud_url',
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
