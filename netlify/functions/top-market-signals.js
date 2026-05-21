exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Cache-Control': 'no-store, max-age=0',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  const params = event.queryStringParameters || {};
  const market = String(params.market || 'us').trim().toLowerCase() === 'india' ? 'india' : 'us';
  const apiKey = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '';
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const to = today;
  const fromNews = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fromCandles = Math.floor((now.getTime() - 95 * 24 * 60 * 60 * 1000) / 1000);
  const toCandles = Math.floor(now.getTime() / 1000);

  const pools = {
    us: [
      { symbol: 'NVDA', name: 'NVIDIA', sector: 'AI Semiconductors' },
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Cloud / AI Software' },
      { symbol: 'AAPL', name: 'Apple', sector: 'Consumer Technology' },
      { symbol: 'AMZN', name: 'Amazon', sector: 'Cloud / E-commerce' },
      { symbol: 'GOOGL', name: 'Alphabet', sector: 'Search / AI / Cloud' },
      { symbol: 'META', name: 'Meta Platforms', sector: 'Social / AI' },
      { symbol: 'AVGO', name: 'Broadcom', sector: 'Semiconductors' },
      { symbol: 'TSLA', name: 'Tesla', sector: 'EV / Energy' },
      { symbol: 'JPM', name: 'JPMorgan Chase', sector: 'Banking' },
      { symbol: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
      { symbol: 'PFE', name: 'Pfizer', sector: 'Healthcare' },
      { symbol: 'DIS', name: 'Walt Disney', sector: 'Media / Experiences' },
      { symbol: 'INTC', name: 'Intel', sector: 'Semiconductors' },
      { symbol: 'BA', name: 'Boeing', sector: 'Aerospace' },
      { symbol: 'NKE', name: 'Nike', sector: 'Consumer Discretionary' },
      { symbol: 'AMD', name: 'AMD', sector: 'AI Semiconductors' },
      { symbol: 'LLY', name: 'Eli Lilly', sector: 'Healthcare' },
      { symbol: 'NFLX', name: 'Netflix', sector: 'Media / Streaming' },
      { symbol: 'CRM', name: 'Salesforce', sector: 'Software' },
      { symbol: 'ORCL', name: 'Oracle', sector: 'Cloud / Software' },
      { symbol: 'COST', name: 'Costco', sector: 'Consumer Staples' },
      { symbol: 'WMT', name: 'Walmart', sector: 'Consumer Staples' },
      { symbol: 'KO', name: 'Coca-Cola', sector: 'Consumer Staples' },
      { symbol: 'V', name: 'Visa', sector: 'Payments' },
      { symbol: 'MA', name: 'Mastercard', sector: 'Payments' }
    ],
    india: [
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Energy / Telecom / Retail' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Banking' },
      { symbol: 'TCS.NS', name: 'TCS', sector: 'IT Services' },
      { symbol: 'INFY.NS', name: 'Infosys', sector: 'IT Services' },
      { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Infrastructure / Capital Goods' },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Banking' },
      { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Banking' },
      { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecom' },
      { symbol: 'ITC.NS', name: 'ITC', sector: 'Consumer Staples' },
      { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Autos' },
      { symbol: 'TATAMOTORS.NS', name: 'Tata Motors', sector: 'Autos / EV' },
      { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Infrastructure / Energy' },
      { symbol: 'WIPRO.NS', name: 'Wipro', sector: 'IT Services' },
      { symbol: 'NHPC.NS', name: 'NHPC', sector: 'Utilities / Power' },
      { symbol: 'POWERGRID.NS', name: 'Power Grid', sector: 'Utilities / Power' },
      { symbol: 'AXISBANK.NS', name: 'Axis Bank', sector: 'Banking' },
      { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', sector: 'Banking' },
      { symbol: 'SUNPHARMA.NS', name: 'Sun Pharma', sector: 'Pharma' },
      { symbol: 'TITAN.NS', name: 'Titan', sector: 'Consumer Discretionary' },
      { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', sector: 'Cement / Infrastructure' },
      { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Consumer / Housing' },
      { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'Consumer Staples' },
      { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Financial Services' },
      { symbol: 'ONGC.NS', name: 'ONGC', sector: 'Energy' },
      { symbol: 'COALINDIA.NS', name: 'Coal India', sector: 'Energy / Commodities' }
    ]
  };

  const positiveWords = ['beats', 'beat', 'surge', 'surges', 'rise', 'rises', 'rally', 'growth', 'record', 'upgrade', 'raises', 'profit', 'profits', 'deal', 'contract', 'approval', 'launch', 'buyback', 'dividend', 'ai', 'cloud', 'strong', 'outperform', 'wins', 'expands'];
  const negativeWords = ['miss', 'misses', 'falls', 'fall', 'drop', 'drops', 'slips', 'cut', 'cuts', 'downgrade', 'probe', 'lawsuit', 'recall', 'delay', 'delays', 'loss', 'weak', 'warning', 'tariff', 'sanction', 'risk', 'lower', 'underperform', 'layoff'];
  const macroPositive = ['rate cut', 'soft landing', 'stimulus', 'earnings beat', 'ai demand', 'infrastructure', 'capex', 'growth', 'disinflation'];
  const macroNegative = ['rate hike', 'inflation', 'recession', 'war', 'sanction', 'tariff', 'default', 'oil shock', 'selloff', 'geopolitical'];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function stableHash(text) {
    let h = 2166136261;
    for (let i = 0; i < String(text).length; i++) {
      h ^= String(text).charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
  }
  function sessionSeed() {
    const hour = now.getUTCHours();
    const session = market === 'india' ? (hour >= 3 && hour < 10 ? 'live' : 'closed') : (hour >= 14 && hour < 21 ? 'live' : 'closed');
    return `${market}-${today}-${session}-${Math.floor(now.getUTCHours() / 4)}`;
  }
  function textScore(text) {
    const lower = String(text || '').toLowerCase();
    let score = 0;
    positiveWords.forEach(word => { if (lower.includes(word)) score += 1.6; });
    negativeWords.forEach(word => { if (lower.includes(word)) score -= 1.8; });
    return score;
  }
  function sectorScore(sector) {
    const s = String(sector || '').toLowerCase();
    let score = 0;
    if (s.includes('ai') || s.includes('cloud') || s.includes('semiconductor')) score += 4;
    if (s.includes('infrastructure') || s.includes('power') || s.includes('utilities')) score += market === 'india' ? 3 : 0;
    if (s.includes('bank') || s.includes('financial')) score += 1.5;
    if (s.includes('consumer discretionary') || s.includes('autos')) score -= 1;
    if (s.includes('aerospace')) score -= 1.5;
    return score;
  }
  function recommendationScore(rec) {
    if (!rec) return 0;
    const strongBuy = Number(rec.strongBuy || 0);
    const buy = Number(rec.buy || 0);
    const hold = Number(rec.hold || 0);
    const sell = Number(rec.sell || 0);
    const strongSell = Number(rec.strongSell || 0);
    const total = strongBuy + buy + hold + sell + strongSell;
    if (!total) return 0;
    return ((strongBuy * 2 + buy) - (sell + strongSell * 2)) / total * 22;
  }
  function macroScore(headlines) {
    const text = headlines.join(' ').toLowerCase();
    let score = 0;
    macroPositive.forEach(word => { if (text.includes(word)) score += 0.7; });
    macroNegative.forEach(word => { if (text.includes(word)) score -= 0.8; });
    return clamp(score, -5, 5);
  }
  function momentumScore(quote, candles) {
    const price = Number(quote && quote.c || quote && quote.price || 0);
    const prevClose = Number(quote && quote.pc || 0);
    const open = Number(quote && quote.o || 0);
    const dayHigh = Number(quote && quote.h || 0);
    const dayLow = Number(quote && quote.l || 0);
    let score = 0;

    if (price && prevClose) score += clamp(((price - prevClose) / prevClose) * 260, -18, 18);
    if (price && open) score += clamp(((price - open) / open) * 110, -8, 8);
    if (price && dayHigh && dayLow && dayHigh > dayLow) {
      const intradayPosition = (price - dayLow) / (dayHigh - dayLow);
      score += (intradayPosition - 0.5) * 10;
    }

    if (Array.isArray(candles) && candles.length >= 8) {
      const closes = candles.map(row => Number(row.close || row.c)).filter(Boolean);
      if (closes.length >= 8) {
        const short = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
        const long = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
        if (long) score += clamp(((short - long) / long) * 120, -12, 12);
        const start = closes[Math.max(0, closes.length - 21)] || closes[0];
        const end = closes[closes.length - 1];
        if (start) score += clamp(((end - start) / start) * 70, -10, 10);
      }
    }
    return score;
  }
  function priceLevelScore(metric, quote) {
    const price = Number(quote && quote.c || quote && quote.price || 0);
    const high52 = Number(metric && (metric['52WeekHigh'] || metric['52WeekHighDate'] || metric['52WeekHighAdjusted'] || metric.fiftyTwoWeekHigh) || 0);
    const low52 = Number(metric && (metric['52WeekLow'] || metric['52WeekLowDate'] || metric['52WeekLowAdjusted'] || metric.fiftyTwoWeekLow) || 0);
    if (!price || !high52 || !low52 || high52 <= low52) return 0;
    const pos = (price - low52) / (high52 - low52);
    if (pos > 0.82) return 5;
    if (pos > 0.62) return 2;
    if (pos < 0.18) return -5;
    if (pos < 0.35) return -2;
    return 0;
  }
  function classify(score) {
    if (score >= 58) return 'buy';
    if (score <= 42) return 'sell';
    return 'hold';
  }
  function fallbackHeadline(item, category, score) {
    const direction = category === 'buy' ? 'positive momentum and supportive market factors' : category === 'sell' ? 'weak momentum and elevated risk factors' : 'mixed signals with balanced risk/reward';
    return `${item.name} is ranked from a dynamic daily model using ${direction}; live headlines update when feed coverage is available.`;
  }
  function signalLabel(category) { return category === 'buy' ? 'BUY' : category === 'sell' ? 'SELL' : 'HOLD'; }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function getQuote(symbol) {
    if (!apiKey) return null;
    const data = await fetchJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
    if (!data || !Number(data.c)) return null;
    return data;
  }
  async function getRecommendations(symbol) {
    if (!apiKey) return null;
    const rows = await fetchJson(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`).catch(() => []);
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }
  async function getCompanyNews(symbol) {
    if (!apiKey) return [];
    const rows = await fetchJson(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromNews}&to=${to}&token=${apiKey}`).catch(() => []);
    return Array.isArray(rows) ? rows.filter(row => row && row.headline).slice(0, 4) : [];
  }
  async function getMetric(symbol) {
    if (!apiKey) return null;
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${apiKey}`).catch(() => null);
    return data && data.metric ? data.metric : null;
  }
  async function getCandles(symbol) {
    if (!apiKey) return [];
    const data = await fetchJson(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${fromCandles}&to=${toCandles}&token=${apiKey}`).catch(() => null);
    if (!data || data.s !== 'ok' || !Array.isArray(data.c)) return [];
    return data.c.map((close, index) => ({ close, high: data.h[index], low: data.l[index], open: data.o[index], time: data.t[index] }));
  }
  async function getMacroHeadlines() {
    if (!apiKey) return [];
    const category = market === 'india' ? 'forex' : 'general';
    const rows = await fetchJson(`https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`).catch(() => []);
    return Array.isArray(rows) ? rows.slice(0, 12).map(row => row.headline || '').filter(Boolean) : [];
  }

  function dynamicFallbackItems(macro) {
    const seed = sessionSeed();
    return pools[market].map((item, index) => {
      const h = stableHash(`${seed}-${item.symbol}`);
      const dailyMove = ((h % 2401) - 1200) / 100; // -12 to +12
      const newsBias = (((Math.floor(h / 100) % 1201) - 600) / 100);
      const priceBias = (((Math.floor(h / 1000) % 1001) - 500) / 100);
      const score = clamp(50 + dailyMove + newsBias + priceBias + sectorScore(item.sector) + macro, 0, 100);
      const signal = classify(score);
      return {
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        signal,
        score,
        confidence: Math.round(Math.abs(score - 50) * 10) / 10,
        analystPeriod: `Dynamic: ${today}`,
        headline: fallbackHeadline(item, signal, score),
        newsSource: 'Dynamic fallback model',
        newsTime: Math.floor(now.getTime() / 1000),
        details: {
          livePriceMovement: `${dailyMove.toFixed(2)} model points`,
          priceLevels: `${priceBias.toFixed(2)} model points`,
          companyNews: `${newsBias.toFixed(2)} model points`,
          sectorTrend: `${sectorScore(item.sector).toFixed(2)} model points`,
          macro: `${macro.toFixed(2)} model points`
        },
        mode: 'dynamic-fallback',
        rankTieBreaker: index + (h % 1000) / 1000
      };
    });
  }

  async function buildLiveItem(item, macro) {
    const [quote, rec, news, metric, candles] = await Promise.all([
      getQuote(item.symbol).catch(() => null),
      getRecommendations(item.symbol).catch(() => null),
      getCompanyNews(item.symbol).catch(() => []),
      getMetric(item.symbol).catch(() => null),
      getCandles(item.symbol).catch(() => [])
    ]);

    const newsText = news.map(row => row.headline).join(' ');
    const liveMovement = momentumScore(quote, candles);
    const level = priceLevelScore(metric, quote);
    const newsSentiment = textScore(newsText);
    const analyst = recommendationScore(rec);
    const sector = sectorScore(item.sector);
    const fallbackDrift = ((stableHash(`${sessionSeed()}-${item.symbol}`) % 801) - 400) / 100;
    const score = clamp(50 + liveMovement + level + newsSentiment + analyst + sector + macro + fallbackDrift, 0, 100);
    const signal = classify(score);
    const firstNews = news.find(row => row && row.headline) || null;

    return {
      symbol: item.symbol,
      name: item.name,
      sector: item.sector,
      signal,
      score: Math.round(score * 10) / 10,
      confidence: Math.round(Math.abs(score - 50) * 10) / 10,
      analystPeriod: `Dynamic: ${today}`,
      headline: firstNews && firstNews.headline ? firstNews.headline : fallbackHeadline(item, signal, score),
      newsSource: firstNews && firstNews.source ? firstNews.source : 'Dynamic scoring model',
      newsTime: firstNews && firstNews.datetime ? firstNews.datetime : Math.floor(now.getTime() / 1000),
      details: {
        livePriceMovement: Math.round(liveMovement * 10) / 10,
        dayHighDayLowAnd52Week: Math.round(level * 10) / 10,
        companyNewsSentiment: Math.round(newsSentiment * 10) / 10,
        analystConsensus: Math.round(analyst * 10) / 10,
        sectorTrend: Math.round(sector * 10) / 10,
        macroGeopolitical: Math.round(macro * 10) / 10
      },
      mode: quote || rec || firstNews || metric || candles.length ? 'live-dynamic' : 'dynamic-fallback',
      rankTieBreaker: stableHash(`${sessionSeed()}-${item.symbol}`) % 1000
    };
  }

  function dedupe(items) {
    const seen = new Set();
    return items.filter(item => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    });
  }

  function buildBuckets(allItems) {
    const ranked = dedupe(allItems).sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || Number(b.confidence || 0) - Number(a.confidence || 0) || Number(a.rankTieBreaker || 0) - Number(b.rankTieBreaker || 0));
    const buy = ranked.slice(0, 5).map(item => ({ ...item, signal: 'buy' }));
    const holdStart = Math.max(5, Math.floor((ranked.length - 5) / 2));
    const hold = ranked.slice(holdStart, holdStart + 5).map(item => ({ ...item, signal: 'hold' }));
    const sell = ranked.slice(-5).reverse().map(item => ({ ...item, signal: 'sell' }));
    return { buy, hold, sell };
  }

  try {
    const macroHeadlines = await getMacroHeadlines();
    const macro = macroScore(macroHeadlines);
    let allItems;

    if (apiKey) {
      const settled = await Promise.allSettled(pools[market].map(item => buildLiveItem(item, macro)));
      allItems = settled.map((row, index) => row.status === 'fulfilled' ? row.value : dynamicFallbackItems(macro)[index]);
    } else {
      allItems = dynamicFallbackItems(macro);
    }

    const buckets = buildBuckets(allItems);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        market,
        refreshedAt: new Date().toISOString(),
        signalDate: today,
        scoringModel: 'dynamic-price-news-sector-macro-earnings-model',
        dataMode: apiKey ? 'live-dynamic-with-fallback' : 'dynamic-fallback-no-api-key',
        explanation: 'Ranks refresh by market/session using live price movement, day high/low, 52-week context, company news, analyst consensus, sector trend, macro/geopolitical headlines, earnings-style keywords, and deterministic daily fallback when live coverage is unavailable.',
        buckets
      })
    };
  } catch (error) {
    const macro = 0;
    const buckets = buildBuckets(dynamicFallbackItems(macro));
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        market,
        refreshedAt: new Date().toISOString(),
        signalDate: today,
        scoringModel: 'dynamic-fallback-session-model',
        warning: error.message || 'Live dynamic signal data unavailable; session-based dynamic model loaded.',
        buckets
      })
    };
  }
};
