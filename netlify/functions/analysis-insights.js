exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const params = event.queryStringParameters || {};
  const symbol = (params.symbol || '').trim().toUpperCase();
  if (!symbol) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
  }

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        recommendation: null,
        news: [],
        source: 'No API key configured',
        message: 'FINNHUB_API_KEY is not configured.'
      })
    };
  }

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().slice(0, 10);

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  try {
    const recommendationUrl = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${apiKey}`;

    const [recommendationData, newsData] = await Promise.all([
      fetchJson(recommendationUrl).catch(() => []),
      fetchJson(newsUrl).catch(() => [])
    ]);

    const recommendation = Array.isArray(recommendationData) && recommendationData.length ? recommendationData[0] : null;
    const news = Array.isArray(newsData) ? newsData.slice(0, 6).map(item => ({
      headline: item.headline || '',
      summary: item.summary || '',
      source: item.source || '',
      datetime: item.datetime || null,
      url: item.url || ''
    })).filter(item => item.headline) : [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        recommendation,
        news,
        source: 'Finnhub recommendation + company news',
        from,
        to
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        recommendation: null,
        news: [],
        source: 'Finnhub recommendation + company news',
        error: error.message || 'Analysis insights unavailable.'
      })
    };
  }
};
