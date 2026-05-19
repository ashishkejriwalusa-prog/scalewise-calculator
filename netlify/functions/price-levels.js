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

  const currencyFallback = symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD';

  function ok(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  function numeric(values) {
    return Array.isArray(values) ? values.filter(value => typeof value === 'number' && Number.isFinite(value)) : [];
  }

  async function fetchChart(range, interval) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}&includePrePost=false`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Yahoo chart request failed.');
    }

    const result = data.chart.result && data.chart.result[0];
    if (!result) {
      throw new Error('Yahoo Finance returned no chart result.');
    }
    return result;
  }

  try {
    const [intradayResult, annualResult] = await Promise.all([
      fetchChart('1d', '5m'),
      fetchChart('1y', '1d')
    ]);

    const intradayMeta = intradayResult.meta || {};
    const annualMeta = annualResult.meta || intradayMeta || {};
    const intradayQuote = intradayResult.indicators && intradayResult.indicators.quote && intradayResult.indicators.quote[0] ? intradayResult.indicators.quote[0] : {};
    const annualQuote = annualResult.indicators && annualResult.indicators.quote && annualResult.indicators.quote[0] ? annualResult.indicators.quote[0] : {};

    const intradayHighs = numeric(intradayQuote.high);
    const intradayLows = numeric(intradayQuote.low);
    const annualHighs = numeric(annualQuote.high);
    const annualLows = numeric(annualQuote.low);

    const dayHigh = intradayHighs.length ? Math.max(...intradayHighs) : Number(intradayMeta.regularMarketDayHigh || 0) || null;
    const dayLow = intradayLows.length ? Math.min(...intradayLows) : Number(intradayMeta.regularMarketDayLow || 0) || null;
    const fiftyTwoWeekHigh = annualHighs.length ? Math.max(...annualHighs) : Number(annualMeta.fiftyTwoWeekHigh || 0) || null;
    const fiftyTwoWeekLow = annualLows.length ? Math.min(...annualLows) : Number(annualMeta.fiftyTwoWeekLow || 0) || null;
    const price = Number(intradayMeta.regularMarketPrice || annualMeta.regularMarketPrice || 0) || null;
    const previousClose = Number(intradayMeta.chartPreviousClose || intradayMeta.previousClose || annualMeta.chartPreviousClose || annualMeta.previousClose || 0) || null;

    if (!dayHigh && !dayLow && !fiftyTwoWeekHigh && !fiftyTwoWeekLow) {
      throw new Error('Yahoo chart data returned no usable price levels.');
    }

    return ok({
      symbol,
      providerSymbol: intradayMeta.symbol || annualMeta.symbol || symbol,
      currency: intradayMeta.currency || annualMeta.currency || currencyFallback,
      price,
      dayHigh,
      dayLow,
      fiftyTwoWeekHigh,
      fiftyTwoWeekLow,
      previousClose,
      source: 'Yahoo Finance chart data',
      timestamp: intradayMeta.regularMarketTime || annualMeta.regularMarketTime || null
    });
  } catch (error) {
    return ok({
      symbol,
      currency: currencyFallback,
      error: error.message || 'Price level data unavailable.'
    });
  }
};
