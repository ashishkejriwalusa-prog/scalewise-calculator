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
  const market = String(params.market || 'us').trim().toLowerCase() === 'india' ? 'india' : 'us';
  const apiKey = process.env.FINNHUB_API_KEY;

  const pools = {
    us: [
      { symbol: 'NVDA', name: 'NVIDIA' },
      { symbol: 'MSFT', name: 'Microsoft' },
      { symbol: 'AAPL', name: 'Apple' },
      { symbol: 'AMZN', name: 'Amazon' },
      { symbol: 'GOOGL', name: 'Alphabet' },
      { symbol: 'META', name: 'Meta Platforms' },
      { symbol: 'AVGO', name: 'Broadcom' },
      { symbol: 'TSLA', name: 'Tesla' },
      { symbol: 'JPM', name: 'JPMorgan Chase' },
      { symbol: 'XOM', name: 'Exxon Mobil' },
      { symbol: 'PFE', name: 'Pfizer' },
      { symbol: 'DIS', name: 'Walt Disney' },
      { symbol: 'INTC', name: 'Intel' },
      { symbol: 'BA', name: 'Boeing' },
      { symbol: 'NKE', name: 'Nike' }
    ],
    india: [
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank' },
      { symbol: 'TCS.NS', name: 'TCS' },
      { symbol: 'INFY.NS', name: 'Infosys' },
      { symbol: 'LT.NS', name: 'Larsen & Toubro' },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank' },
      { symbol: 'SBIN.NS', name: 'State Bank of India' },
      { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel' },
      { symbol: 'ITC.NS', name: 'ITC' },
      { symbol: 'MARUTI.NS', name: 'Maruti Suzuki' },
      { symbol: 'TATAMOTORS.NS', name: 'Tata Motors' },
      { symbol: 'ADANIENT.NS', name: 'Adani Enterprises' },
      { symbol: 'WIPRO.NS', name: 'Wipro' },
      { symbol: 'NHPC.NS', name: 'NHPC' },
      { symbol: 'POWERGRID.NS', name: 'Power Grid' }
    ]
  };

  const fallbackSignals = {
    us: {
      buy: ['NVDA', 'MSFT', 'AMZN', 'GOOGL', 'AVGO'],
      hold: ['AAPL', 'META', 'JPM', 'XOM', 'DIS'],
      sell: ['INTC', 'BA', 'PFE', 'NKE', 'TSLA']
    },
    india: {
      buy: ['RELIANCE.NS', 'HDFCBANK.NS', 'LT.NS', 'ICICIBANK.NS', 'BHARTIARTL.NS'],
      hold: ['TCS.NS', 'INFY.NS', 'ITC.NS', 'MARUTI.NS', 'POWERGRID.NS'],
      sell: ['WIPRO.NS', 'NHPC.NS', 'TATAMOTORS.NS', 'ADANIENT.NS', 'SBIN.NS']
    }
  };

  const pool = pools[market];
  const poolMap = Object.fromEntries(pool.map(item => [item.symbol, item]));
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function classifyRecommendation(rec, fallbackCategory) {
    if (!rec) return fallbackCategory;
    const buy = Number(rec.strongBuy || 0) + Number(rec.buy || 0);
    const hold = Number(rec.hold || 0);
    const sell = Number(rec.sell || 0) + Number(rec.strongSell || 0);
    if (buy > hold && buy > sell) return 'buy';
    if (sell > hold && sell > buy) return 'sell';
    return 'hold';
  }

  function confidence(rec, category) {
    if (!rec) return 0;
    const buy = Number(rec.strongBuy || 0) + Number(rec.buy || 0);
    const hold = Number(rec.hold || 0);
    const sell = Number(rec.sell || 0) + Number(rec.strongSell || 0);
    if (category === 'buy') return buy;
    if (category === 'sell') return sell;
    return hold;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function buildLiveItem(item, fallbackCategory) {
    if (!apiKey) throw new Error('No API key');
    const recommendationUrl = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(item.symbol)}&token=${apiKey}`;
    const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(item.symbol)}&from=${from}&to=${to}&token=${apiKey}`;
    const [recommendations, news] = await Promise.all([
      fetchJson(recommendationUrl).catch(() => []),
      fetchJson(newsUrl).catch(() => [])
    ]);
    const rec = Array.isArray(recommendations) && recommendations.length ? recommendations[0] : null;
    const signal = classifyRecommendation(rec, fallbackCategory);
    const firstNews = Array.isArray(news) && news.length ? news.find(row => row && row.headline) : null;
    return {
      symbol: item.symbol,
      name: item.name,
      signal,
      confidence: confidence(rec, signal),
      analystPeriod: rec && rec.period ? rec.period : null,
      headline: firstNews && firstNews.headline ? firstNews.headline : 'Current company-news headline unavailable.',
      newsSource: firstNews && firstNews.source ? firstNews.source : null,
      newsTime: firstNews && firstNews.datetime ? firstNews.datetime : null,
      mode: rec ? 'live' : 'fallback'
    };
  }

  function fallbackItem(symbol, category) {
    const item = poolMap[symbol] || { symbol, name: symbol };
    return {
      symbol: item.symbol,
      name: item.name,
      signal: category,
      confidence: 0,
      analystPeriod: null,
      headline: 'Current company-news headline will appear when the live feed returns data.',
      newsSource: null,
      newsTime: null,
      mode: 'fallback'
    };
  }

  try {
    const results = [];
    const fallbackCategoryBySymbol = {};
    Object.entries(fallbackSignals[market]).forEach(([category, symbols]) => {
      symbols.forEach(symbol => { fallbackCategoryBySymbol[symbol] = category; });
    });

    if (apiKey) {
      const settled = await Promise.allSettled(pool.map(item => buildLiveItem(item, fallbackCategoryBySymbol[item.symbol] || 'hold')));
      settled.forEach((row, index) => {
        if (row.status === 'fulfilled') results.push(row.value);
        else {
          const item = pool[index];
          results.push(fallbackItem(item.symbol, fallbackCategoryBySymbol[item.symbol] || 'hold'));
        }
      });
    } else {
      Object.entries(fallbackSignals[market]).forEach(([category, symbols]) => symbols.forEach(symbol => results.push(fallbackItem(symbol, category))));
    }

    const grouped = { buy: [], hold: [], sell: [] };
    results.forEach(item => {
      const key = grouped[item.signal] ? item.signal : 'hold';
      grouped[key].push(item);
    });

    Object.keys(grouped).forEach(key => {
      grouped[key] = grouped[key]
        .sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0) || a.name.localeCompare(b.name))
        .slice(0, 5);

      if (grouped[key].length < 5) {
        const needed = 5 - grouped[key].length;
        const existing = new Set(grouped[key].map(item => item.symbol));
        const fillers = fallbackSignals[market][key]
          .filter(symbol => !existing.has(symbol))
          .slice(0, needed)
          .map(symbol => fallbackItem(symbol, key));
        grouped[key] = grouped[key].concat(fillers);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        market,
        refreshedAt: new Date().toISOString(),
        buckets: grouped
      })
    };
  } catch (error) {
    const grouped = { buy: [], hold: [], sell: [] };
    Object.entries(fallbackSignals[market]).forEach(([category, symbols]) => {
      grouped[category] = symbols.slice(0, 5).map(symbol => fallbackItem(symbol, category));
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        market,
        refreshedAt: new Date().toISOString(),
        warning: error.message || 'Live top-signal data unavailable; fallback view loaded.',
        buckets: grouped
      })
    };
  }
};
