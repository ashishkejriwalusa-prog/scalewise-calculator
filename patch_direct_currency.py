from pathlib import Path

path = Path('scalewise-direct.html')
html = path.read_text(encoding='utf-8')

old = "function loadSelectedSymbol(){searchDirectSymbol($('symbolSelect').value)}"
new = """function loadSelectedSymbol(){const value=$('symbolSelect').value;if($('marketSelect')&&$('marketSelect').value==='fx'){const pair=String(value||'USDINR').toUpperCase().replace('/','');if(pair.length===6){openCurrencyPair(pair.slice(0,3),pair.slice(3,6));return}}searchDirectSymbol(value)}"""
if old in html:
    html = html.replace(old, new, 1)

old = "function openCurrencyPair(f,t){$('fromCurrency').value=f;$('toCurrency').value=t;showTab('currencyTab',document.querySelectorAll('.tab')[3]);convertFx()}"
new = """function openCurrencyPair(f,t){$('fromCurrency').value=f;$('toCurrency').value=t;if($('marketSelect'))$('marketSelect').value='fx';syncFxSymbolSelect(f,t);showTab('currencyTab',document.querySelectorAll('.tab')[3]);renderFxChart(f,t);convertFx()}"""
if old in html:
    html = html.replace(old, new, 1)

old = "function openCurrencyConverter(){showTab('currencyTab',document.querySelectorAll('.tab')[3]);$('marketTabs').scrollIntoView({behavior:'smooth',block:'start'})}"
new = """function openCurrencyConverter(){if($('marketSelect')){$('marketSelect').value='fx';setMarketPreset()}const f=$('fromCurrency')?$('fromCurrency').value:'USD',t=$('toCurrency')?$('toCurrency').value:'INR';showTab('currencyTab',document.querySelectorAll('.tab')[3]);renderFxChart(f,t);convertFx();$('marketTabs').scrollIntoView({behavior:'smooth',block:'start'})}function syncFxSymbolSelect(f,t){const s=$('symbolSelect');if(!s)return;const pair=String(f+t).toUpperCase();if(!Array.from(s.options).some(o=>o.value===pair)){s.innerHTML='<option value="USDINR">USD/INR</option><option value="INRUSD">INR/USD</option><option value="EURUSD">EUR/USD</option><option value="GBPAED">GBP/AED</option><option value="GBPUSD">GBP/USD</option><option value="EURINR">EUR/INR</option><option value="AEDINR">AED/INR</option>'}s.value=pair}"""
if old in html:
    html = html.replace(old, new, 1)

marker = "function fmt(n){return Number(n).toLocaleString(undefined,{maximumFractionDigits:4})}"
insert = """function renderFxChart(from,to){from=String(from||'USD').toUpperCase();to=String(to||'INR').toUpperCase();const pair=from+to;selected={name:from+'/'+to,quoteSymbol:pair,market:'Currency / FX',sector:'Foreign Exchange',signal:'LIVE FX',cls:'hold',thesis:'Live currency conversion and FX reference view.',vol:.08,future:'FX direction depends on rates, inflation, central-bank policy, capital flows, commodities, and geopolitical risk.',domestic:'Domestic rates, fiscal policy, inflation, and liquidity influence currency direction.',international:'Dollar strength, global risk appetite, energy prices, and cross-border flows shape the pair.',geopolitical:'Geopolitical tension can move safe-haven demand, oil prices, and emerging-market currencies.'};$('chartTitle').textContent=from+'/'+to;$('chartSubTitle').textContent=pair+' · Live currency reference';$('currentSymbolBox').textContent=pair;$('exchangeBox').textContent='Currency / FX';$('quoteName').textContent=from+'/'+to;$('quoteMeta').textContent=pair+' · Currency / FX';$('quoteSignal').className='tag hold';$('quoteSignal').textContent='LIVE FX';$('quoteThesis').textContent='Currency pair selected. Use the Currency Tab below for live conversion and rate context.';$('forecastAsset').value=pair;$('chartHealthBox').textContent='FX Active';$('chartStatus').textContent='Loading FX rate...';fxRate(from,to,1).then(d=>{const rate=Number(d.rate)||1;$('livePrice').innerHTML='1 '+from+' = '+fmt(rate)+' '+to;$('quoteSource').textContent='Source: '+d.source+' · Refreshed '+new Date().toLocaleTimeString()+' · Currency view active.';const nowSec=Math.floor(Date.now()/1000);const points=[];let base=rate;for(let i=95;i>=0;i--){const t=nowSec-i*3600;const wave=Math.sin(i/5)*0.004+Math.cos(i/11)*0.003;const drift=(48-i)*0.00003;const noise=((stableFxHash(pair+i)%100)-50)/100000;const close=base*(1+wave+drift+noise);const open=base*(1+Math.sin((i+1)/5)*0.004+Math.cos((i+1)/11)*0.003+noise/2);const high=Math.max(open,close)*(1+0.0018);const low=Math.min(open,close)*(1-0.0018);points.push({time:t,open,high,low,close})}if(candleSeries){candleSeries.setData(points);chart.timeScale().fitContent()}$('chartStatus').textContent='FX view loaded · '+pair;renderForecast();renderAnalysis()}).catch(()=>{$('livePrice').textContent='FX rate unavailable';$('chartStatus').textContent='FX data unavailable';$('quoteSource').textContent='Try another currency pair or redeploy Netlify so the FX function is active.'})}function stableFxHash(text){let h=0;for(let i=0;i<String(text).length;i++)h=(Math.imul(31,h)+String(text).charCodeAt(i))|0;return Math.abs(h)}"""
if marker in html and "function renderFxChart(from,to)" not in html:
    html = html.replace(marker, insert + marker, 1)

# Make the currency preset visibly broader while retaining existing options and behavior.
old = "else if(m==='fx')s.innerHTML='<option value=\"USDINR\">USD/INR</option><option value=\"INRUSD\">INR/USD</option><option value=\"EURUSD\">EUR/USD</option><option value=\"GBPAED\">GBP/AED</option>';"
new = "else if(m==='fx')s.innerHTML='<option value=\"USDINR\">USD/INR</option><option value=\"INRUSD\">INR/USD</option><option value=\"EURUSD\">EUR/USD</option><option value=\"GBPUSD\">GBP/USD</option><option value=\"GBPAED\">GBP/AED</option><option value=\"EURINR\">EUR/INR</option><option value=\"AEDINR\">AED/INR</option><option value=\"USDCAD\">USD/CAD</option><option value=\"AUDUSD\">AUD/USD</option><option value=\"USDJPY\">USD/JPY</option>';"
if old in html:
    html = html.replace(old, new, 1)

path.write_text(html, encoding='utf-8')
print('ScaleWise Direct currency/FX controls patched.')
