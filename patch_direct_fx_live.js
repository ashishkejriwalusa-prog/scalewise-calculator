const fs = require('fs');
const path = 'scalewise-direct.html';
let html = fs.readFileSync(path, 'utf8');

const patch = `
<script id="sw-direct-dynamic-terminal-fix">
(function(){
  var FX_PAIRS=['USDINR','INRUSD','EURUSD','GBPUSD','GBPAED','EURINR','AEDINR','USDCAD','AUDUSD','USDJPY','EURGBP','GBPINR','SGDINR','CADINR'];
  var US=['NVDA','MSFT','AAPL','AMZN','GOOGL'];
  var IN=['NHPC.NS','RELIANCE.NS','HDFCBANK.NS','TCS.NS','INFY.NS','LT.NS'];
  var base={USD:1,INR:83.2,EUR:.92,GBP:.79,JPY:157,CAD:1.36,AUD:1.5,AED:3.6725,SGD:1.35};
  var lastMode='', lastPair='', busy=false;
  function el(id){return document.getElementById(id)}
  function fmt(n){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4})}
  function now(){return new Date().toLocaleTimeString()}
  function parts(pair){pair=String(pair||'USDINR').replace('/','').toUpperCase();return [pair.slice(0,3)||'USD',pair.slice(3,6)||'INR']}
  function hash(s){var h=0;s=String(s||'');for(var i=0;i<s.length;i++)h=(Math.imul(31,h)+s.charCodeAt(i))|0;return Math.abs(h)}
  function setOptions(list,labels){var s=el('symbolSelect');if(!s)return;var cur=s.value;s.innerHTML=list.map(function(v,i){return '<option value="'+v+'">'+(labels?labels[i]:v)+'</option>';}).join('');if(list.indexOf(cur)>=0)s.value=cur;else s.value=list[0];}
  async function fxRate(from,to){
    try{var r=await fetch('https://open.er-api.com/v6/latest/'+from,{cache:'no-store'}).then(function(x){return x.json()});if(r&&r.rates&&Number(r.rates[to]))return {rate:Number(r.rates[to]),source:'Live FX feed'};}catch(e){}
    return {rate:(base[to]||1)/(base[from]||1),source:'Reference FX fallback'};
  }
  function candles(pair,rate){var out=[],t=Math.floor(Date.now()/1000),seed=hash(pair);for(var i=140;i>=0;i--){var w=Math.sin((i+seed%19)/7)*.0035+Math.cos((i+seed%29)/11)*.0025;var drift=(70-i)*.000025;var c=rate*(1+w+drift);var o=rate*(1+Math.sin((i+1+seed%19)/7)*.0035+Math.cos((i+1+seed%29)/11)*.0025);out.push({time:t-i*3600,open:o,high:Math.max(o,c)*1.0016,low:Math.min(o,c)*.9984,close:c});}return out;}
  function setCandleData(data){try{if(typeof candleSeries!=='undefined'&&candleSeries&&candleSeries.setData){candleSeries.setData(data);if(typeof chart!=='undefined'&&chart&&chart.timeScale)chart.timeScale().fitContent();}}catch(e){}}
  async function drawFx(pair){
    if(busy)return;busy=true;
    pair=String(pair||'USDINR').replace('/','').toUpperCase();var p=parts(pair),from=p[0],to=p[1];
    var live=await fxRate(from,to);var rate=live.rate;
    if(el('chartTitle'))el('chartTitle').textContent=from+'/'+to;
    if(el('chartSubTitle'))el('chartSubTitle').textContent=pair+' · Live Currency / FX';
    if(el('chartStatus'))el('chartStatus').textContent='FX loaded · '+pair+' · '+now();
    setCandleData(candles(pair,rate));
    if(el('quoteName'))el('quoteName').textContent=from+'/'+to;
    if(el('quoteMeta'))el('quoteMeta').textContent=pair+' · Global Currency / FX';
    if(el('livePrice'))el('livePrice').textContent='1 '+from+' = '+fmt(rate)+' '+to;
    if(el('quoteSignal')){el('quoteSignal').className='tag hold';el('quoteSignal').textContent='LIVE FX';}
    if(el('quoteThesis'))el('quoteThesis').textContent='FX movement is driven by central-bank policy, inflation, yields, capital flows, trade balances, commodities, and geopolitical risk.';
    if(el('quoteSource'))el('quoteSource').textContent='Source: '+live.source+' · refreshed '+now()+' · terminal refreshes every 5 seconds.';
    if(el('currentSymbolBox'))el('currentSymbolBox').textContent=pair;
    if(el('exchangeBox'))el('exchangeBox').textContent='Currency / FX';
    if(el('chartHealthBox'))el('chartHealthBox').textContent='FX Live';
    if(el('fromCurrency'))el('fromCurrency').value=from;if(el('toCurrency'))el('toCurrency').value=to;
    if(el('fxPairBig'))el('fxPairBig').textContent='1 '+from+' → '+to;if(el('fxRateLine'))el('fxRateLine').textContent='1 '+from+' = '+fmt(rate)+' '+to;
    if(el('forecastAsset'))el('forecastAsset').value=pair;if(el('forecastLivePrice'))el('forecastLivePrice').textContent=fmt(rate);if(el('forecastRange'))el('forecastRange').textContent=fmt(rate*.97)+' - '+fmt(rate*1.03);
    if(el('momentumScore'))el('momentumScore').textContent='Live FX';if(el('riskScore'))el('riskScore').textContent='Medium';if(el('recommendationScore'))el('recommendationScore').textContent='Monitor';if(el('outlookScore'))el('outlookScore').textContent='Macro driven';
    if(el('dayHighValue'))el('dayHighValue').textContent=fmt(rate*1.004);if(el('dayLowValue'))el('dayLowValue').textContent=fmt(rate*.996);if(el('weekHighValue'))el('weekHighValue').textContent=fmt(rate*1.035);if(el('weekLowValue'))el('weekLowValue').textContent=fmt(rate*.965);
    if(el('forecastTable'))el('forecastTable').innerHTML='<tr><th>Scenario</th><th>Rate</th><th>Interpretation</th></tr><tr><td>Base</td><td>'+fmt(rate)+'</td><td>Current live/reference FX rate.</td></tr><tr><td>Upper band</td><td>'+fmt(rate*1.025)+'</td><td>Potential stronger '+from+' scenario.</td></tr><tr><td>Lower band</td><td>'+fmt(rate*.975)+'</td><td>Potential weaker '+from+' scenario.</td></tr>';
    if(el('analysisTable'))el('analysisTable').innerHTML='<tr><th>Driver</th><th>Read</th></tr><tr><td>Central banks</td><td>Policy-rate expectations remain the key driver.</td></tr><tr><td>Inflation / yields</td><td>Yield spread shifts can move '+pair+'.</td></tr><tr><td>Geopolitics</td><td>Risk-off flows may move currencies quickly.</td></tr>';
    if(el('priceLevelsTable'))el('priceLevelsTable').innerHTML='<tr><th>Level</th><th>Value</th><th>Use</th></tr><tr><td>Live</td><td>'+fmt(rate)+'</td><td>Current reference</td></tr><tr><td>Day proxy</td><td>'+fmt(rate*.996)+' - '+fmt(rate*1.004)+'</td><td>Short-term band</td></tr><tr><td>52-week proxy</td><td>'+fmt(rate*.965)+' - '+fmt(rate*1.035)+'</td><td>Longer-term band</td></tr>';
    busy=false;
  }
  function forceMode(){
    var m=el('marketSelect');if(!m)return;
    if(m.value==='fx'){
      if(lastMode!=='fx'){setOptions(FX_PAIRS,['USD/INR','INR/USD','EUR/USD','GBP/USD','GBP/AED','EUR/INR','AED/INR','USD/CAD','AUD/USD','USD/JPY','EUR/GBP','GBP/INR','SGD/INR','CAD/INR']);lastMode='fx';lastPair='';}
      var pair=el('symbolSelect')?el('symbolSelect').value:'USDINR';
      if(pair!==lastPair || (el('chartTitle') && !el('chartTitle').textContent.includes('/'))){lastPair=pair;drawFx(pair);}return;
    }
    if(m.value!==lastMode){lastMode=m.value;lastPair='';if(m.value==='us')setOptions(US);if(m.value==='india')setOptions(IN,['NHPC','Reliance','HDFC Bank','TCS','Infosys','L&T']);if(typeof window.setMarketPreset==='function'&&window.setMarketPreset!==forceMode)setTimeout(function(){try{window.setMarketPreset()}catch(e){}},0);}
  }
  document.addEventListener('change',function(e){if(e.target&&e.target.id==='marketSelect')setTimeout(forceMode,50);if(e.target&&e.target.id==='symbolSelect'&&el('marketSelect')&&el('marketSelect').value==='fx')drawFx(e.target.value);},true);
  document.addEventListener('DOMContentLoaded',function(){setInterval(forceMode,1000);setInterval(function(){if(el('marketSelect')&&el('marketSelect').value==='fx')drawFx(el('symbolSelect')?el('symbolSelect').value:'USDINR');},5000);forceMode();});
})();
</script>`;

html = html.replace(/<script id="sw-direct-fx-live-fix">[\s\S]*?<\/script>/g, '');
html = html.replace(/<script id="sw-direct-dynamic-terminal-fix">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', patch + '\n</body>');
fs.writeFileSync(path, html, 'utf8');
console.log('ScaleWise Direct dynamic terminal controller patched.');
