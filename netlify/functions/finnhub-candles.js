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
    const symbol = (params.symbol || '').trim().toUpperCase();
    const resolution = (params.resolution || 'D').trim();
    const now = Math.floor(Date.now() / 1000);
    const days = Number(params.days || 365);
    const from = Number(params.from || now - days * 24 * 60 * 60);
    const to = Number(params.to || now);

    if (!symbol) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
    }

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}&token=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Finnhub candle request failed.', details: data }) };
    }

    if (data.s !== 'ok') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          symbol,
          status: data.s || 'no_data',
          candles: [],
          message: 'No candle data returned for this symbol/resolution. Try exact ticker such as NHPC.NS, RELIANCE.NS, AAPL, MSFT, or use another data provider for full NSE/BSE coverage.'
        })
      };
    }

    const candles = data.t.map((time, index) => ({
      time,
      open: data.o[index],
      high: data.h[index],
      low: data.l[index],
      close: data.c[index],
      volume: data.v ? data.v[index] : null
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ symbol, status: 'ok', resolution, from, to, candles, source: 'Finnhub' })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Unexpected Finnhub candle function error.' }) };
  }
};
