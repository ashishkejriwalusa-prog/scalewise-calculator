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

  const fxYahooSymbols = {
    USDINR: 'INR=X', EURUSD: 'EURUSD=X', GBPUSD: 'GBPUSD=X', USDJPY: 'JPY=X',
    USDCAD: 'CAD=X', AUDUSD: 'AUDUSD=X', NZDUSD: 'NZDUSD=X', USDSGD: 'SGD=X',
    USDAED: 'AED=X', USDCNY: 'CNY=X', USDRUB: 'RUB=X', USDKWD: 'KWD=X'
  };

  const isFxSymbol = Object.prototype.hasOwnProperty.call(fxYahooSymbols, symbol);
  const isIndianSymbol = symbol.endsWith('.NS') || symbol.endsWith('.BO') || symbol.startsWith('NSE_EQ|') || symbol.startsWith('BSE_EQ|');
  const providerSymbol = fxYahooSymbols[symbol] || symbol;
  const currencyFallback = isIndianSymbol ? 'INR' : 'USD';

  function ok(payload) { return { statusCode: 200, headers, body: JSON.stringify(payload) }; }
  function numeric(values) { return Array.isArray(values) ? values.filter(value => typeof value === 'number' && Number.isFinite(value)) : []; }
  function polygonKey() { return process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY || ''; }
  function polygonTicker(sym) { return String(sym || '').replace(/\.NS$|\.BO$/i, '').toUpperCase(); }

  function upstoxMap() {
    try { return JSON.parse(process.env.UPSTOX_INSTRUMENT_MAP || '{}'); } catch (e) { return {}; }
  }

  function upstoxInstrumentKey(sym) {
    if (sym.startsWith('NSE_EQ|') || sym.startsWith('BSE_EQ|')) return sym;
    const clean = sym.replace(/\.NS$|\.BO$/i, '').toUpperCase();
    const map = upstoxMap();
    return map[sym] || map[clean] || '';
  }

  async function tryUpstoxQuote() {
    if (!isIndianSymbol || isFxSymbol) throw new Error('Upstox only used for India equity symbols.');
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) throw new Error('UPSTOX_ACCESS_TOKEN not configured.');
    const instrumentKey = upstoxInstrumentKey(symbol);
    if (!instrumentKey) throw new Error('UPSTOX_INSTRUMENT_MAP missing this NSE/BSE instrument key.');

    const url = `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKey)}`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message || 'Upstox quote request failed.');

    const quote = data.data && (data.data[instrumentKey] || Object.values(data.data)[0]);
    if (!quote) throw new Error('Upstox returned no quote for this instrument.');

    const price = Number(quote.last_price || quote.ltp || 0);
    const previousClose = Number((quote.ohlc && quote.ohlc.close) || quote.cp || quote.close || 0);
    if (!price) throw new Error('Upstox returned no live/current price.');
    const change = previousClose ? price - previousClose : Number(quote.net_change || 0);
    const changePercent = previousClose ? (change / previousClose) * 100 : Number(quote.percent_change || 0);

    return {
      symbol, providerSymbol: instrumentKey, name: quote.symbol || symbol, exchange: instrumentKey.startsWith('BSE') ? 'BSE' : 'NSE',
      currency: 'INR', industry: '', marketCapitalization: null, price,
      open: quote.ohlc ? quote.ohlc.open : null, high: quote.ohlc ? quote.ohlc.high : null, low: quote.ohlc ? quote.ohlc.low : null,
      previousClose, change, changePercent, timestamp: quote.timestamp || Date.now(), source: 'Upstox live market quote'
    };
  }

  async function tryPolygonQuote() {
    if (isIndianSymbol || isFxSymbol) throw new Error('Polygon/Massive only used for U.S. equity symbols.');
    const apiKey = polygonKey();
    if (!apiKey) throw new Error('POLYGON_API_KEY or MASSIVE_API_KEY not configured.');
    const ticker = polygonTicker(symbol);
    const [lastResponse, prevResponse] = await Promise.all([
      fetch(`https://api.polygon.io/v2/last/trade/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`),
      fetch(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev?adjusted=true&apiKey=${encodeURIComponent(apiKey)}`)
    ]);
    const last = await lastResponse.json();
    const prev = await prevResponse.json();
    if (!lastResponse.ok || last.status === 'ERROR') throw new Error(last.error || last.message || 'Polygon/Massive last trade failed.');
    const price = Number(last.results && (last.results.p || last.results.price) || 0);
    const prevBar = prev.results && prev.results[0] ? prev.results[0] : {};
    const previousClose = Number(prevBar.c || 0);
    if (!price) throw new Error('Polygon/Massive returned no price.');
    const change = previousClose ? price - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    return {
      symbol: ticker, providerSymbol: ticker, name: ticker, exchange: 'U.S.', currency: 'USD', industry: '', marketCapitalization: null,
      price, open: prevBar.o || null, high: prevBar.h || null, low: prevBar.l || null, previousClose,
      change, changePercent, timestamp: last.results ? (last.results.t || null) : null, source: 'Polygon/Massive U.S. market quote'
    };
  }

  async function tryUnifiedQuote() {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1m&range=1d&includePrePost=false`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' } });
    const data = await response.json();
    if (!response.ok || !data.chart || data.chart.error) throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Live quote request failed.');
    const result = data.chart.result && data.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
    if (!result || !meta) throw new Error('No live quote metadata returned.');
    const closes = numeric(quote && quote.close), highs = numeric(quote && quote.high), lows = numeric(quote && quote.low), opens = numeric(quote && quote.open);
    const price = Number(meta.regularMarketPrice || closes[closes.length - 1] || 0);
    const previousClose = Number(meta.chartPreviousClose || meta.previousClose || 0);
    const change = previousClose ? price - previousClose : 0;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    if (!price) throw new Error('Live/current market price was not returned.');
    return {
      symbol, providerSymbol, name: isFxSymbol ? symbol.replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2') : (meta.shortName || meta.longName || symbol),
      exchange: meta.exchangeName || '', currency: meta.currency || currencyFallback, industry: isFxSymbol ? 'Currency' : '', marketCapitalization: null,
      price, open: opens.length ? opens[0] : null, high: highs.length ? Math.max(...highs) : null, low: lows.length ? Math.min(...lows) : null,
      previousClose, change, changePercent, timestamp: meta.regularMarketTime || null, source: 'Consolidated live market quote'
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
    const current = Number(quote.c || 0), previousClose = Number(quote.pc || 0);
    if (!current) throw new Error('Fallback provider returned no price.');
    const change = previousClose ? current - previousClose : Number(quote.d || 0);
    const changePercent = previousClose ? (change / previousClose) * 100 : Number(quote.dp || 0);
    return { symbol, providerSymbol: symbol, name: profile.name || symbol, exchange: profile.exchange || '', currency: profile.currency || currencyFallback, industry: profile.finnhubIndustry || '', marketCapitalization: profile.marketCapitalization || null, price: current, open: quote.o || null, high: quote.h || null, low: quote.l || null, previousClose, change, changePercent, timestamp: quote.t || null, source: 'Fallback market quote', fallbackUsed: true };
  }

  try {
    const errors = [];
    const providers = isIndianSymbol ? [tryUpstoxQuote, tryUnifiedQuote, tryFinnhubFallback] : [tryPolygonQuote, tryUnifiedQuote, tryFinnhubFallback];
    for (const provider of providers) {
      try { return ok(await provider()); } catch (error) { errors.push(error.message); }
    }
    return ok({ symbol, providerSymbol, error: errors.join(' | ') || 'No quote data returned.' });
  } catch (error) {
    return ok({ symbol, providerSymbol, error: error.message || 'No quote data returned.' });
  }
};
