# Finnhub Integration Setup

ScaleWise Direct now includes a secure Netlify Function for Finnhub integration.

---

# Step 1 — Create Finnhub Account

Create a free account:

https://finnhub.io

Get your API key.

---

# Step 2 — Add Environment Variable in Netlify

Open:

Site Settings → Environment Variables

Add:

FINNHUB_API_KEY=your_api_key_here

---

# Step 3 — Redeploy Site

In Netlify:

Deploys → Clear cache and deploy site

---

# Netlify Function Endpoint

/.netlify/functions/finnhub-quote?symbol=AAPL

Example:

/.netlify/functions/finnhub-quote?symbol=MSFT

---

# Supported Example Symbols

U.S.:
- AAPL
- MSFT
- NVDA
- AMZN
- GOOGL

India examples (depends on feed support):
- RELIANCE.NS
- HDFCBANK.NS
- TCS.NS

---

# Returned Data

The function returns:

- live price
- daily change
- % change
- high/low
- open
- previous close
- industry
- market cap

---

# Why Use Netlify Functions?

This prevents exposing your API key in browser JavaScript.

Professional architecture:

Browser → Netlify Function → Finnhub API

instead of:

Browser → Finnhub directly

which exposes secrets publicly.

---

# Recommended Future Architecture

Frontend:
- TradingView charts
- live search
- watchlists
- portfolio tracker

Backend:
- Netlify Functions
- Supabase/Firebase
- Stripe subscriptions
- Finnhub / Polygon / Twelve Data

This creates a scalable finance SaaS architecture.
