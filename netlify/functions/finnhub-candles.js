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
  const resolution = (params.resolution || 'D').trim();
  const now = Math.floor(Date.now() / 1000);
  const days = Number(params.days || 365);
  const from = Number(params.from || now - days * 24 * 60 * 60);
  const to = Number(params.to || now);

  if (!symbol) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
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

  function formatResponse(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  async function tryUnifiedChart() {
    const intervalMap = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '60m',
      'D': '1d',
      'W': '1wk'
    };

    const interval = intervalMap[resolution] || resolution || '1d';
    let range = '1y';
    if (['1m', '5m', '15m', '30m', '60m'].includes(interval)) range = '1mo';
    if (interval === '1wk') range = '5y';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Unified candle request failed.');
    }

    const result = data.chart.result && data.chart.result[0];
    const timestamps = result && result.timestamp;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];

    if (!result || !Array.isArray(timestamps) || !timestamps.length || !quote) {
      throw new Error('No candle data returned.');
    }

    const candles = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const open = quote.open && quote.open[index];
      const high = quote.high && quote.high[index];
      const low = quote.low && quote.low[index];
      const close = quote.close && quote.close[index];
      const volume = quote.volume && quote.volume[index];

      if ([open, high, low, close].every(value => typeof value === 'number' && Number.isFinite(value))) {
        candles.push({
          time: timestamps[index],
          open,
          high,
          low,
          close,
          volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : null
        });
      }
    }

    if (!candles.length) {
      throw new Error('Candle data was empty after validation.');
    }

    return {
      symbol,
      providerSymbol,
      status: 'ok',
      resolution,
      from,
      to,
      candles,
      source: 'Consolidated market chart',
      interval,
      range
    };
  }

  async function tryFallbackChart() {
    if (isFxSymbol) {
      throw new Error('Currency pairs use the consolidated chart provider.');
    }

    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('No fallback chart key configured.');
    }

    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&from=${from}&to=${to}&token=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error('Fallback candle request failed.');
    }

    if (data.s !== 'ok' || !Array.isArray(data.t) || data.t.length === 0) {
      throw new Error('Fallback candle provider returned no data.');
    }

    const candles = data.t.map((time, index) => ({
      time,
      open: data.o[index],
      high: data.h[index],
      low: data.l[index],
      close: data.c[index],
      volume: data.v ? data.v[index] : null
    })).filter(candle => [candle.open, candle.high, candle.low, candle.close].every(value => typeof value === 'number' && Number.isFinite(value)));

    if (!candles.length) {
      throw new Error('Fallback candle data was empty after validation.');
    }

    return {
      symbol,
      providerSymbol: symbol,
      status: 'ok',
      resolution,
      from,
      to,
      candles,
      source: 'Fallback market chart',
      fallbackUsed: true
    };
  }

  try {
    try {
      return formatResponse(await tryUnifiedChart());
    } catch (primaryError) {
      const fallbackPayload = await tryFallbackChart();
      fallbackPayload.fallbackReason = primaryError.message;
      return formatResponse(fallbackPayload);
    }
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        providerSymbol,
        status: 'no_data',
        candles: [],
        source: 'Market chart feed',
        message: error.message || 'No candle data returned. Try exact symbols like USDINR, EURUSD, GBPUSD, USDJPY, HDFCBANK.NS, NHPC.NS, RELIANCE.NS, TCS.NS, AAPL, or MSFT.'
      })
    };
  }
};