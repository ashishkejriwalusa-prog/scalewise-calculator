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

  const candidates = {
    India: [
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy / Telecom / Retail' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
      { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Infrastructure' },
      { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
      { symbol: 'SUNPHARMA.NS', name: 'Sun Pharma', sector: 'Healthcare' },
      { symbol: 'TCS.NS', name: 'TCS', sector: 'IT Services' },
      { symbol: 'INFY.NS', name: 'Infosys', sector: 'IT Services' },
      { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
      { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Autos' },
      { symbol: 'VBL.NS', name: 'Varun Beverages', sector: 'Consumer' },
      { symbol: 'NHPC.NS', name: 'NHPC', sector: 'Utilities' }
    ],
    US: [
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Cloud / AI Software' },
      { symbol: 'NVDA', name: 'NVIDIA', sector: 'Semiconductors / AI' },
      { symbol: 'AMZN', name: 'Amazon', sector: 'Cloud / E-commerce' },
      { symbol: 'GOOGL', name: 'Alphabet', sector: 'Search / AI / Cloud' },
      { symbol: 'META', name: 'Meta Platforms', sector: 'Digital Advertising / AI' },
      { symbol: 'AAPL', name: 'Apple', sector: 'Consumer Technology' },
      { symbol: 'AVGO', name: 'Broadcom', sector: 'Semiconductors' },
      { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Banking' },
      { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
      { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples' },
      { symbol: 'TSLA', name: 'Tesla', sector: 'EV / Energy' },
      { symbol: 'AMD', name: 'AMD', sector: 'Semiconductors' }
    ]
  };

  const apiKey = process.env.FINNHUB_API_KEY || '';
  const queryMarket = String((event.queryStringParameters || {}).market || 'both').toLowerCase();
  const markets = queryMarket === 'india' ? ['India'] : queryMarket === 'us' ? ['US'] : ['India', 'US'];

  const positiveSectors = {
    India: ['Infrastructure', 'Banking', 'Telecom', 'Healthcare'],
    US: ['Cloud / AI Software', 'Semiconductors / AI', 'Semiconductors', 'Healthcare']
  };

  const policyRiskSectors = {
    India: ['IT Services', 'Utilities'],
    US: ['EV / Energy', 'Digital Advertising / AI']
  };

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function ok(payload) {
    return { statusCode: 200, headers, body: JSON.stringify(payload) };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' } });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  async function quoteFromFinnhub(symbol) {
    if (!apiKey) return null;
    try {
      const data = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
      const price = finite(data.c);
      const previousClose = finite(data.pc);
      if (price === null) return null;
      const change = previousClose !== null ? price - previousClose : finite(data.d);
      const changePercent = previousClose ? (change / previousClose) * 100 : finite(data.dp);
      return {
        price,
        previousClose,
        change,
        changePercent,
        dayHigh: finite(data.h),
        dayLow: finite(data.l),
        timestamp: finite(data.t),
        source: 'Finnhub'
      };
    } catch (error) {
      return null;
    }
  }

  async function quoteFromYahoo(symbol) {
    try {
      const data = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y&includePrePost=false`);
      if (!data.chart || data.chart.error) return null;
      const result = data.chart.result && data.chart.result[0];
      const meta = result && result.meta;
      const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
      const timestamps = result && Array.isArray(result.timestamp) ? result.timestamp : [];
      if (!meta || !quote || !timestamps.length) return null;

      const price = finite(meta.regularMarketPrice);
      const previousClose = finite(meta.chartPreviousClose) ?? finite(meta.previousClose);
      if (price === null) return null;
      const change = previousClose !== null ? price - previousClose : null;
      const changePercent = previousClose ? (change / previousClose) * 100 : null;
      const highs = (quote.high || []).map(finite).filter(value => value !== null);
      const lows = (quote.low || []).map(finite).filter(value => value !== null);
      const latestHigh = highs.length ? highs[highs.length - 1] : null;
      const latestLow = lows.length ? lows[lows.length - 1] : null;
      const fiftyTwoWeekHigh = finite(meta.fiftyTwoWeekHigh) ?? (highs.length ? Math.max(...highs) : null);
      const fiftyTwoWeekLow = finite(meta.fiftyTwoWeekLow) ?? (lows.length ? Math.min(...lows) : null);
      const rangePosition = fiftyTwoWeekHigh && fiftyTwoWeekLow && fiftyTwoWeekHigh !== fiftyTwoWeekLow
        ? ((price - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100
        : null;

      return {
        price,
        previousClose,
        change,
        changePercent,
        dayHigh: finite(meta.regularMarketDayHigh) ?? latestHigh,
        dayLow: finite(meta.regularMarketDayLow) ?? latestLow,
        fiftyTwoWeekHigh,
        fiftyTwoWeekLow,
        fiftyTwoWeekRangePosition: rangePosition,
        timestamp: finite(meta.regularMarketTime),
        currency: meta.currency || '',
        source: 'Yahoo Finance metrics'
      };
    } catch (error) {
      return null;
    }
  }

  function classifyIdea(asset, market, quote) {
    const dayMove = finite(quote && quote.changePercent) ?? 0;
    const rangePosition = finite(quote && quote.fiftyTwoWeekRangePosition);
    const nearHigh = rangePosition !== null && rangePosition >= 82;
    const midRange = rangePosition !== null && rangePosition >= 38 && rangePosition < 82;
    const nearLow = rangePosition !== null && rangePosition < 38;
    const positiveSector = positiveSectors[market].includes(asset.sector);
    const policyRisk = policyRiskSectors[market].includes(asset.sector);

    let score = 0;
    if (dayMove >= 1) score += 2;
    else if (dayMove >= 0) score += 1;
    else if (dayMove <= -1.5) score -= 2;
    else score -= 1;

    if (nearHigh) score += positiveSector ? 2 : 1;
    if (midRange) score += 1;
    if (nearLow) score -= 1;
    if (positiveSector) score += 1;
    if (policyRisk) score -= 1;

    let bucket = 'HOLD';
    if (score >= 4) bucket = 'BUY';
    if (score <= 0) bucket = 'SELL / AVOID';

    const reasons = [];
    if (dayMove >= 1) reasons.push(`positive daily momentum at ${dayMove.toFixed(2)}%`);
    else if (dayMove <= -1.5) reasons.push(`weak daily tape at ${dayMove.toFixed(2)}%`);
    else reasons.push(`daily move is ${dayMove.toFixed(2)}%`);
    if (nearHigh) reasons.push('trading near the upper part of its 52-week range');
    else if (nearLow) reasons.push('trading in the lower part of its 52-week range');
    else reasons.push('trading in the middle of its 52-week range');
    if (positiveSector) reasons.push('sector backdrop is relatively supportive');
    if (policyRisk) reasons.push('sector carries elevated policy or cycle risk');

    return { bucket, score, reason: reasons.join('; ') + '.' };
  }

  try {
    const all = [];
    for (const market of markets) {
      for (const asset of candidates[market]) {
        const quote = (await quoteFromFinnhub(asset.symbol)) || (await quoteFromYahoo(asset.symbol));
        if (!quote || quote.price === null) continue;
        const yahooMetrics = quote.fiftyTwoWeekHigh !== undefined ? quote : (await quoteFromYahoo(asset.symbol));
        const metrics = yahooMetrics || quote;
        const idea = classifyIdea(asset, market, metrics);
        all.push({
          market,
          symbol: asset.symbol,
          name: asset.name,
          sector: asset.sector,
          bucket: idea.bucket,
          score: idea.score,
          reason: idea.reason,
          price: metrics.price,
          currency: metrics.currency || (market === 'India' ? 'INR' : 'USD'),
          changePercent: metrics.changePercent,
          dayHigh: metrics.dayHigh,
          dayLow: metrics.dayLow,
          fiftyTwoWeekHigh: metrics.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: metrics.fiftyTwoWeekLow ?? null,
          rangePosition: metrics.fiftyTwoWeekRangePosition ?? null,
          source: metrics.source || quote.source || 'Market data'
        });
      }
    }

    const group = (bucket) => all
      .filter(item => item.bucket === bucket)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const sell = all
      .filter(item => item.bucket === 'SELL / AVOID')
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    return ok({
      updatedAt: new Date().toISOString(),
      methodology: 'Current-situation screen using live/delayed price momentum, 52-week range position, and sector-cycle heuristics. Educational only; not investment advice.',
      buy: group('BUY'),
      hold: group('HOLD'),
      sell,
      allCount: all.length
    });
  } catch (error) {
    return ok({ error: error.message || 'Market ideas unavailable.' });
  }
};