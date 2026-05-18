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
  const name = (params.name || symbol || 'Selected asset').trim();
  const market = (params.market || '').trim() || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'India' : 'U.S.');
  const sector = (params.sector || 'Equity').trim();
  const changePercent = Number(params.changePercent || 0);

  if (!symbol) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
  }

  const apiKey = process.env.FINNHUB_API_KEY || '';
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const positiveWords = ['beat', 'growth', 'upgrade', 'profit', 'record', 'surge', 'strong', 'expansion', 'approval', 'order', 'demand', 'recovery', 'buyback', 'dividend', 'partnership', 'positive'];
  const negativeWords = ['miss', 'downgrade', 'loss', 'decline', 'fall', 'weak', 'warning', 'probe', 'lawsuit', 'fraud', 'default', 'debt', 'slump', 'cut', 'delay', 'pressure', 'negative'];
  const geopoliticalWords = ['war', 'conflict', 'missile', 'sanction', 'tariff', 'iran', 'israel', 'gaza', 'russia', 'ukraine', 'china', 'taiwan', 'oil', 'crude', 'opec', 'shipping', 'red sea', 'supply chain', 'export ban', 'trade restriction'];
  const macroWords = ['federal reserve', 'fed', 'rbi', 'ecb', 'boj', 'inflation', 'rates', 'rate cut', 'rate hike', 'bond yield', 'recession', 'currency', 'rupee', 'dollar', 'fiscal', 'budget', 'gdp'];

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeArticle(article, fallbackSource) {
    return {
      title: cleanText(article.headline || article.title || ''),
      source: cleanText(article.source || article.domain || fallbackSource || ''),
      url: cleanText(article.url || article.link || ''),
      publishedAt: article.datetime ? new Date(article.datetime * 1000).toISOString() : cleanText(article.seendate || article.date || article.publishedAt || '')
    };
  }

  function uniqueByTitle(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.title.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function scoreText(items) {
    let positive = 0;
    let negative = 0;
    let geopolitical = 0;
    let macro = 0;

    for (const item of items) {
      const text = item.title.toLowerCase();
      for (const word of positiveWords) if (text.includes(word)) positive += 1;
      for (const word of negativeWords) if (text.includes(word)) negative += 1;
      for (const word of geopoliticalWords) if (text.includes(word)) geopolitical += 1;
      for (const word of macroWords) if (text.includes(word)) macro += 1;
    }

    const net = positive - negative;
    const sentiment = net >= 3 ? 'Positive' : net <= -3 ? 'Negative' : 'Mixed / Neutral';
    const geoRisk = geopolitical >= 5 ? 'High' : geopolitical >= 2 ? 'Medium' : 'Low';
    const macroRisk = macro >= 5 ? 'High' : macro >= 2 ? 'Medium' : 'Low';

    return { positive, negative, geopolitical, macro, net, sentiment, geoRisk, macroRisk };
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { 'User-Agent': 'ScaleWiseDirect/1.0' } });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  async function getFinnhubCompanyNews() {
    if (!apiKey || market === 'FX') return [];
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    try {
      const data = await fetchJson(url);
      return Array.isArray(data) ? data.slice(0, 8).map(article => normalizeArticle(article, 'Finnhub')) : [];
    } catch (error) {
      return [];
    }
  }

  async function getFinnhubMarketNews() {
    if (!apiKey) return [];
    const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;
    try {
      const data = await fetchJson(url);
      return Array.isArray(data) ? data.slice(0, 10).map(article => normalizeArticle(article, 'Finnhub')) : [];
    } catch (error) {
      return [];
    }
  }

  function gdeltQueryForAsset() {
    const broadMacro = market === 'India'
      ? '(India OR RBI OR rupee OR crude oil OR China OR Middle East OR tariffs OR Russia Ukraine)'
      : '(Federal Reserve OR inflation OR tariffs OR China OR Middle East OR Russia Ukraine OR crude oil OR AI regulation)';
    const companyTerm = market === 'FX' ? '' : ` OR \"${name.replace(/\"/g, '')}\"`;
    return `${broadMacro}${companyTerm}`;
  }

  async function getGdeltMacroNews() {
    const query = gdeltQueryForAsset();
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=12&format=json&sort=datedesc`;
    try {
      const data = await fetchJson(url);
      const articles = Array.isArray(data.articles) ? data.articles : [];
      return articles.slice(0, 10).map(article => normalizeArticle(article, article.domain || 'GDELT'));
    } catch (error) {
      return [];
    }
  }

  const [companyNewsRaw, marketNewsRaw, macroNewsRaw] = await Promise.all([
    getFinnhubCompanyNews(),
    getFinnhubMarketNews(),
    getGdeltMacroNews()
  ]);

  const companyNews = uniqueByTitle(companyNewsRaw).slice(0, 6);
  const marketNews = uniqueByTitle(marketNewsRaw).slice(0, 6);
  const macroNews = uniqueByTitle(macroNewsRaw).slice(0, 6);
  const allNews = uniqueByTitle([...companyNews, ...marketNews, ...macroNews]);
  const scores = scoreText(allNews);

  const priceBias = changePercent >= 1 ? 'Positive' : changePercent <= -1 ? 'Negative' : 'Neutral';
  const scoreFromPrice = changePercent >= 1 ? 1 : changePercent <= -1 ? -1 : 0;
  const scoreFromNews = scores.net >= 3 ? 1 : scores.net <= -3 ? -1 : 0;
  const geopoliticalPenalty = scores.geoRisk === 'High' ? -1 : 0;
  const composite = scoreFromPrice + scoreFromNews + geopoliticalPenalty;

  let stance = 'Neutral / Selective';
  if (composite >= 2) stance = 'Constructive';
  if (composite <= -1) stance = 'Cautious';

  const sentimentSummary = scores.sentiment === 'Positive'
    ? 'Recent sampled headlines skew positive.'
    : scores.sentiment === 'Negative'
      ? 'Recent sampled headlines skew negative.'
      : 'Recent sampled headlines are mixed.';

  const geopoliticalSummary = scores.geoRisk === 'High'
    ? 'Geopolitical headline risk is elevated and could influence near-term volatility.'
    : scores.geoRisk === 'Medium'
      ? 'Geopolitical risk is present and should be monitored.'
      : 'No unusually high geopolitical headline concentration was detected in the latest sample.';

  const macroSummary = scores.macroRisk === 'High'
    ? 'Macro-sensitive headlines are unusually active, making rates, currency and policy developments especially relevant.'
    : scores.macroRisk === 'Medium'
      ? 'Macro headlines matter, but they are not the only driver of the current view.'
      : 'The current headline mix is not dominated by macro policy stories.';

  const interpretation = `${name} (${symbol}) currently reads as ${stance.toLowerCase()}. Price action is ${priceBias.toLowerCase()} at ${Number.isFinite(changePercent) ? changePercent.toFixed(2) : '0.00'}% on the day. ${sentimentSummary} ${geopoliticalSummary} ${macroSummary}`;

  const contextNote = stance === 'Constructive'
    ? 'The current context is supportive, though headline reversals and valuation shifts still matter.'
    : stance === 'Cautious'
      ? 'The current context is fragile, with headline risk carrying meaningful weight.'
      : 'The current context is balanced, so the picture remains mixed rather than one-sided.';

  const drivers = [
    `Price-action bias: ${priceBias}${Number.isFinite(changePercent) ? ` (${changePercent.toFixed(2)}% today)` : ''}.`,
    `News sentiment: ${scores.sentiment} from the latest sampled company, market and macro headlines.`,
    `Geopolitical risk: ${scores.geoRisk}.`,
    `Macro/current-affairs risk: ${scores.macroRisk}.`,
    `Sector/context: ${sector}.`
  ];

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      symbol,
      name,
      market,
      sector,
      updatedAt: new Date().toISOString(),
      stance,
      compositeScore: composite,
      priceBias,
      changePercent: Number.isFinite(changePercent) ? changePercent : 0,
      sentiment: scores.sentiment,
      newsScore: scores.net,
      geopoliticalRisk: scores.geoRisk,
      macroRisk: scores.macroRisk,
      interpretation,
      contextNote,
      drivers,
      companyNews,
      marketNews,
      macroNews,
      counts: {
        companyNews: companyNews.length,
        marketNews: marketNews.length,
        macroNews: macroNews.length,
        positiveTerms: scores.positive,
        negativeTerms: scores.negative,
        geopoliticalTerms: scores.geopolitical,
        macroTerms: scores.macro
      },
      methodology: 'Heuristic context layer using selected-asset price action plus sampled company, market, macro and geopolitical headlines. Educational only; not investment advice.'
    })
  };
};