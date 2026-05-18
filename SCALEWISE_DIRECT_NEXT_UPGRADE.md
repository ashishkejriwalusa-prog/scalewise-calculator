# ScaleWise Direct — Next Upgrade Roadmap

## Dashboard UX Changes

Remove these cards:
- Member Status
- Decision Table Rows

Replace with:
- Live Market Snapshot
- USD/INR Live
- Nifty Trend
- S&P 500 Trend
- NASDAQ Trend
- AI Market Pulse
- Top Sector Momentum

---

# New Feature: Global Stock Search

Add dynamic stock search functionality for:
- NSE
- BSE
- NASDAQ
- NYSE

Users should be able to search:
- Reliance
- HDFC Bank
- Microsoft
- NVIDIA
- Amazon
- Apple
- etc.

Search results should display:
- Current market price
- Trend direction
- BUY / HOLD / SELL signal
- Target price
- Risk score
- Market cap
- Time horizon

---

# Recommended APIs

## Stocks
- Twelve Data
- Finnhub
- Alpha Vantage
- Polygon.io

## Forex
- Open Exchange Rates
- Fixer.io
- ExchangeRate API

---

# Example Fetch Structure

```javascript
async function searchStock(symbol) {
  const response = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=YOUR_API_KEY`
  );

  return await response.json();
}
```

---

# Recommended Future Architecture

Move from:
- single monolithic HTML file

To:
- Next.js
- Tailwind
- Supabase Auth
- Stripe
- TradingView widgets
- Serverless API routes

---

# Important Positioning

Do NOT market the platform as:
- 99.99% accurate predictions

Instead position as:

"AI-assisted dynamic market intelligence platform providing probability-based investment insights and macro-driven analysis."

---

# Future Premium Features

- Portfolio tracker
- AI daily outlooks
- GPT market assistant
- Watchlists
- Dynamic alerts
- Real-time market engine
- Saved dashboards
- Cross-device login
