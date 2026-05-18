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

  try {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'FINNHUB_API_KEY is not configured in Netlify environment variables.' })
      };
    }

    const params = event.queryStringParameters || {};
    const query = (params.q || '').trim();

    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing q query parameter.' })
      };
    }

    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Finnhub symbol search request failed.' })
      };
    }

    const data = await response.json();
    const results = (data.result || []).slice(0, 20).map(item => ({
      symbol: item.symbol,
      description: item.description,
      displaySymbol: item.displaySymbol,
      type: item.type
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, count: results.length, results, source: 'Finnhub' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unexpected Finnhub search function error.' })
    };
  }
};
