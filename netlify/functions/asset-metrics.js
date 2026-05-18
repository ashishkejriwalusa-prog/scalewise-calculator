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

  const providerSymbol = fxYahooSymbols[symbol] || symbol;

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function ok(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1d&range=1y&includePrePost=false`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Asset metrics request failed.');
    }

    const result = data.chart.result && data.chart.result[0];
    const meta = result && result.meta;
    const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
    const timestamps = result && Array.isArray(result.timestamp) ? result.timestamp : [];

    if (!result || !meta || !quote || !timestamps.length) {
      throw new Error('No metric history returned for this symbol.');
    }

    const candles = [];
    for (let index = 0; index < timestamps.length; index += 1) {
      const high = finite(quote.high && quote.high[index]);
      const low = finite(quote.low && quote.low[index]);
      const close = finite(quote.close && quote.close[index]);
      const open = finite(quote.open && quote.open[index]);
      if ([high, low, close].every(value => value !== null)) {
        candles.push({ time: timestamps[index], open, high, low, close });
      }
    }

    if (!candles.length) {
      throw new Error('Metric history was empty after validation.');
    }

    const latest = candles[candles.length - 1];
    const yearHighFromSeries = Math.max(...candles.map(candle => candle.high));
    const yearLowFromSeries = Math.min(...candles.map(candle => candle.low));
    const price = finite(meta.regularMarketPrice) ?? latest.close;
    const previousClose = finite(meta.chartPreviousClose) ?? finite(meta.previousClose);
    const dayHigh = finite(meta.regularMarketDayHigh) ?? latest.high;
    const dayLow = finite(meta.regularMarketDayLow) ?? latest.low;
    const yearHigh = finite(meta.fiftyTwoWeekHigh) ?? yearHighFromSeries;
    const yearLow = finite(meta.fiftyTwoWeekLow) ?? yearLowFromSeries;
    const change = previousClose !== null ? price - previousClose : null;
    const changePercent = previousClose ? (change / previousClose) * 100 : null;
    const distanceFrom52WeekHighPercent = yearHigh ? ((price - yearHigh) / yearHigh) * 100 : null;
    const distanceAbove52WeekLowPercent = yearLow ? ((price - yearLow) / yearLow) * 100 : null;
    const fiftyTwoWeekRangePosition = yearHigh && yearLow && yearHigh !== yearLow ? ((price - yearLow) / (yearHigh - yearLow)) * 100 : null;

    return ok({
      symbol,
      providerSymbol,
      name: meta.shortName || meta.longName || symbol,
      currency: meta.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
      exchange: meta.exchangeName || '',
      price,
      previousClose,
      change,
      changePercent,
      dayHigh,
      dayLow,
      fiftyTwoWeekHigh: yearHigh,
      fiftyTwoWeekLow: yearLow,
      distanceFrom52WeekHighPercent,
      distanceAbove52WeekLowPercent,
      fiftyTwoWeekRangePosition,
      timestamp: meta.regularMarketTime || latest.time,
      source: 'Yahoo Finance metrics'
    });
  } catch (error) {
    return ok({
      symbol,
      providerSymbol,
      error: error.message || 'Asset metrics unavailable.'
    });
  }
};