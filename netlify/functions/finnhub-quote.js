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

  const fxYahooSymbols = {
    USDINR: 'INR=X',
    EURUSD: 'EURUSD=X',
    GBPUSD: 'GBPUSD=X',
    USDJPY: 'JPY=X',
    USDCAD: 'CAD=X',
    AUDUSD: 'AUDUSD=X',
    NZDUSD: 'NZDUSD=X',
    USDSGD: 'SGD=X',
    USDAED: 'AED=X',
    USDCNY: 'CNY=X',
    USDRUB: 'RUB=X',
    USDKWD: 'KWD=X'
  };

  const isFxSymbol = Object.prototype.hasOwnProperty.call(fxYahooSymbols, symbol);
  const providerSymbol = fxYahooSymbols[symbol] || symbol;
  const currencyFallback = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD';

  function ok(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  function numeric(values) {
    return Array.isArray(values) ? values.filter(value => typeof value === 'number' && Number.isFinite(value)) : [];
  }

  async function tryUnifiedQuote() {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Live quote request failed.');
    }

    const result = data.chart.result && data.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

    if (!result || !meta) {
      throw new Error('No live quote metadata returned.');
    }

    const closes = numeric(quote && quote.close);
    const highs = numeric(quote && quote.high);
    const lows = numeric(quote && quote.low);
    const opens = numeric(quote && quote.open);

    const price = Number(meta.regularMarketPrice || closes[closes.length - 1] || 0);
    const previousClose = Number(meta.chartPreviousClose || meta.previousClose || 0);
    const change = previousClose ? price - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    if (!price) {
      throw new Error('Live/current market price was not returned.');
    }

    return {
      symbol,
      providerSymbol,
      name: isFxSymbol ? symbol.replace('USDINR', 'USD/INR').replace('EURUSD', 'EUR/USD').replace('GBPUSD', 'GBP/USD').replace('USDJPY', 'USD/JPY').replace('USDCAD', 'USD/CAD').replace('AUDUSD', 'AUD/USD').replace('NZDUSD', 'NZD/USD').replace('USDSGD', 'USD/SGD').replace('USDAED', 'USD/AED').replace('USDCNY', 'USD/CNY').replace('USDRUB', 'USD/RUB').replace('USDKWD', 'USD/KWD') : (meta.shortName || meta.longName || symbol),
      exchange: meta.exchangeName || '',
      currency: meta.currency || currencyFallback,
      industry: isFxSymbol ? 'Currency' : '',
      marketCapitalization: null,
      price,
      open: opens.length ? opens[0] : null,
      high: highs.length ? Math.max(...highs) : null,
      low: lows.length ? Math.min(...lows) : null,
      previousClose,
      change,
      changePercent,
      timestamp: meta.regularMarketTime || null,
      source: 'Consolidated live market quote'
    };
  }

  async function tryFinnhubFallback() {
    if (isFxSymbol) throw new Error('Currency pairs use the consolidated market quote provider.');
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) throw new Error('No fallback quote key configured.');

    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const [quoteResponse, profileResponse] = await Promise.all([fetch(quoteUrl), fetch(profileUrl)]);

    if (!quoteResponse.ok) throw new Error('Fallback quote request failed.');

    const quote = await quoteResponse.json();
    const profile = profileResponse.ok ? await profileResponse.json() : {};
    const current = Number(quote.c || 0);
    const previousClose = Number(quote.pc || 0);
    if (!current) throw new Error('Fallback provider returned no price.');

    const change = previousClose ? current - previousClose : Number(quote.d || 0);
    const changePercent = previousClose ? (change / previousClose) * 100 : Number(quote.dp || 0);

    return {
      symbol,
      providerSymbol: symbol,
      name: profile.name || symbol,
      exchange: profile.exchange || '',
      currency: profile.currency || currencyFallback,
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
      source: 'Fallback market quote',
      fallbackUsed: true
    };
  }

  try {
    try {
      return ok(await tryUnifiedQuote());
    } catch (primaryError) {
      const fallback = await tryFinnhubFallback();
      fallback.fallbackReason = primaryError.message;
      return ok(fallback);
    }
  } catch (error) {
    return ok({
      symbol,
      providerSymbol,
      error: error.message || 'No quote data returned.'
    });
  }
};