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
        body: JSON.stringify({
          error: 'FINNHUB_API_KEY is not configured in Netlify environment variables.'
        })
      };
    }

    const params = event.queryStringParameters || {};
    const symbol = (params.symbol || '').trim().toUpperCase();

    if (!symbol) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing symbol query parameter.' })
      };
    }

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;

    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(quoteUrl),
      fetch(profileUrl)
    ]);

    if (!quoteResponse.ok) {
      return {
        statusCode: quoteResponse.status,
        headers,
        body: JSON.stringify({ error: 'Finnhub quote request failed.' })
      };
    }

    const quote = await quoteResponse.json();
    const profile = profileResponse.ok ? await profileResponse.json() : {};

    const current = Number(quote.c || 0);
    const previousClose = Number(quote.pc || 0);
    const change = current && previousClose ? current - previousClose : Number(quote.d || 0);
    const changePercent = current && previousClose ? (change / previousClose) * 100 : Number(quote.dp || 0);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        name: profile.name || symbol,
        exchange: profile.exchange || '',
        currency: profile.currency || 'USD',
        industry: profile.finnhubIndustry || '',
        marketCapitalization: profile.marketCapitalization || null,
        price: current,
        open: quote.o || null,
        high: quote.h || null,
        low: quote.l || null,
        previousClose,
        change,
        changePercent,
        timestamp: quote.t || null,
        source: 'Finnhub'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Unexpected Finnhub function error.' })
    };
  }
};
