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
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing symbol query parameter.' })
    };
  }

  function ok(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  async function tryFinnhub() {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY is not configured in Netlify environment variables.');
    }

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;

    const [quoteResponse, profileResponse] = await Promise.all([
      fetch(quoteUrl),
      fetch(profileUrl)
    ]);

    if (!quoteResponse.ok) {
      throw new Error('Finnhub quote request failed.');
    }

    const quote = await quoteResponse.json();
    const profile = profileResponse.ok ? await profileResponse.json() : {};

    const current = Number(quote.c || 0);
    const previousClose = Number(quote.pc || 0);
    if (!current) {
      throw new Error('Finnhub returned no live/current price.');
    }

    const change = previousClose ? current - previousClose : Number(quote.d || 0);
    const changePercent = previousClose ? (change / previousClose) * 100 : Number(quote.dp || 0);

    return {
      symbol,
      name: profile.name || symbol,
      exchange: profile.exchange || '',
      currency: profile.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
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
    };
  }

  async function tryYahoo() {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Yahoo quote request failed.');
    }

    const result = data.chart.result && data.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

    if (!result || !meta) {
      throw new Error('Yahoo Finance returned no quote metadata.');
    }

    const price = Number(meta.regularMarketPrice || 0);
    const previousClose = Number(meta.chartPreviousClose || meta.previousClose || 0);
    const change = previousClose ? price - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    if (!price) {
      throw new Error('Yahoo Finance returned no live/current price.');
    }

    const opens = quote && quote.open ? quote.open.filter(value => typeof value === 'number') : [];
    const highs = quote && quote.high ? quote.high.filter(value => typeof value === 'number') : [];
    const lows = quote && quote.low ? quote.low.filter(value => typeof value === 'number') : [];

    return {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      exchange: meta.exchangeName || '',
      currency: meta.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
      industry: '',
      marketCapitalization: null,
      price,
      open: opens.length ? opens[0] : null,
      high: highs.length ? Math.max(...highs) : null,
      low: lows.length ? Math.min(...lows) : null,
      previousClose,
      change,
      changePercent,
      timestamp: meta.regularMarketTime || null,
      source: 'Yahoo Finance fallback',
      fallbackUsed: true
    };
  }

  try {
    try {
      return ok(await tryFinnhub());
    } catch (finnhubError) {
      const yahoo = await tryYahoo();
      yahoo.fallbackReason = finnhubError.message;
      return ok(yahoo);
    }
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        error: error.message || 'No quote data returned from Finnhub or Yahoo Finance.'
      })
    };
  }
};
