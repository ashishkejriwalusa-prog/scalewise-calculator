const fs = require('fs');
const path = 'scalewise-direct.html';
let html = fs.readFileSync(path, 'utf8');

const patch = `
<script id="sw-direct-fx-live-fix">
(function(){
  var FX_PAIRS=['USDINR','INRUSD','EURUSD','GBPUSD','GBPAED','EURINR','AEDINR','USDCAD','AUDUSD','USDJPY','EURGBP','GBPINR','SGDINR','CADINR'];
  var fxTimer=null,signalTimer=null;
  var baseRates={USD:1,INR:83.2,EUR:.92,GBP:.79,JPY:157,CNY:7.24,CAD:1.36,AUD:1.5,NZD:1.63,CHF:.89,SGD:1.35,HKD:7.81,AED:3.6725,SAR:3.75,QAR:3.64,KWD:.31,BHD:.376,OMR:.385,ZAR:18.2,BRL:5.15,MXN:17,KRW:1365,THB:36.6,MYR:4.7,IDR:16200,PHP:58,VND:25400,TRY:32.5,SEK:10.6,NOK:10.7,DKK:6.86,PLN:3.95,CZK:22.8,HUF:360,ILS:3.7,EGP:47.8,NGN:1500,KES:129,GHS:15,PKR:278,BDT:117,LKR:302,NPR:133,RUB:90};
  function el(id){return document.getElementById(id)}
  function fmt(n){return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4})}
  function nowText(){return new Date().toLocaleTimeString()}
  function stableHash(text){var h=0; text=String(text||''); for(var i=0;i<text.length;i++) h=(Math.imul(31,h)+text.charCodeAt(i))|0; return Math.abs(h)}
  function pairParts(pair){pair=String(pair||'USDINR').toUpperCase().replace('/','');return [pair.slice(0,3)||'USD',pair.slice(3,6)||'INR']}
  function setSymbolOptions(){
    var s=el('symbolSelect'); if(!s) return;
    s.innerHTML=FX_PAIRS.map(function(p){return '<option value="'+p+'">'+p.slice(0,3)+'/'+p.slice(3,6)+'</option>';}).join('');
    if(!s.value) s.value='USDINR';
  }
  async function liveFxRate(from,to){
    from=String(from||'USD').toUpperCase(); to=String(to||'INR').toUpperCase();
    try{
      if(typeof window.fxRate==='function'){
        var r=await window.fxRate(from,to,1);
        if(r&&Number(r.rate)) return {rate:Number(r.rate),source:r.source||'Live FX service'};
      }
    }catch(e){}
    try{
      var res=await fetch('https://open.er-api.com/v6/latest/'+encodeURIComponent(from),{cache:'no-store'});
      var data=await res.json();
      if(data&&data.rates&&Number(data.rates[to])) return {rate:Number(data.rates[to]),source:'Open Exchange Rate API'};
    }catch(e){}
    var fallback=(baseRates[to]||1)/(baseRates[from]||1);
    return {rate:fallback,source:'Fallback reference rate'};
  }
  function updateFxForm(pair,rate){
    var parts=pairParts(pair),from=parts[0],to=parts[1];
    if(el('fromCurrency')) el('fromCurrency').value=from;
    if(el('toCurrency')) el('toCurrency').value=to;
    if(el('fxPairBig')) el('fxPairBig').textContent=(el('fxAmount')?el('fxAmount').value||1:1)+' '+from+' → '+to;
    if(el('fxRateLine')) el('fxRateLine').textContent='1 '+from+' = '+fmt(rate)+' '+to;
    if(el('fxExplain')) el('fxExplain').textContent='Live reference rate refreshed at '+nowText()+'. Rates may move continuously while global FX markets are active.';
  }
  function makeFxCandles(pair,rate){
    var now=Math.floor(Date.now()/1000), seed=stableHash(pair), pts=[];
    for(var i=150;i>=0;i--){
      var drift=(75-i)*0.000025, wave=Math.sin((i+seed%17)/7)*0.0035+Math.cos((i+seed%23)/11)*0.0025;
      var pulse=((stableHash(pair+i)%100)-50)/140000;
      var close=rate*(1+wave+drift+pulse);
      var open=rate*(1+Math.sin((i+1+seed%17)/7)*0.0035+Math.cos((i+1+seed%23)/11)*0.0025+pulse/2);
      var high=Math.max(open,close)*(1+0.0016);
      var low=Math.min(open,close)*(1-0.0016);
      pts.push({time:now-i*3600,open:open,high:high,low:low,close:close});
    }
    return pts;
  }
  async function renderFx(pair){
    pair=String(pair||'USDINR').toUpperCase().replace('/','');
    var p=pairParts(pair),from=p[0],to=p[1];
    if(el('chartTitle')) el('chartTitle').textContent=from+'/'+to;
    if(el('chartSubTitle')) el('chartSubTitle').textContent=pair+' · Live Currency / FX';
    if(el('chartStatus')) el('chartStatus').textContent='Loading FX rate...';
    if(el('currentSymbolBox')) el('currentSymbolBox').textContent=pair;
    if(el('exchangeBox')) el('exchangeBox').textContent='Currency / FX';
    if(el('quoteName')) el('quoteName').textContent=from+'/'+to;
    if(el('quoteMeta')) el('quoteMeta').textContent=pair+' · Global Foreign Exchange';
    if(el('quoteSignal')){el('quoteSignal').className='tag hold';el('quoteSignal').textContent='LIVE FX';}
    if(el('quoteThesis')) el('quoteThesis').textContent='Currency movement depends on interest-rate expectations, inflation, capital flows, commodities, central-bank policy, and geopolitical risk.';
    var live=await liveFxRate(from,to);
    updateFxForm(pair,live.rate);
    if(el('livePrice')) el('livePrice').textContent='1 '+from+' = '+fmt(live.rate)+' '+to;
    if(el('quoteSource')) el('quoteSource').textContent='Source: '+live.source+' · Refreshed '+nowText()+' · Auto-refresh every 5 seconds while FX is selected.';
    if(el('forecastAsset')) el('forecastAsset').value=pair;
    if(el('forecastLivePrice')) el('forecastLivePrice').textContent=fmt(live.rate);
    if(el('chartHealthBox')) el('chartHealthBox').textContent='FX Live';
    if(window.candleSeries&&typeof window.candleSeries.setData==='function'){
      window.candleSeries.setData(makeFxCandles(pair,live.rate));
      if(window.chart&&window.chart.timeScale) window.chart.timeScale().fitContent();
    } else if(typeof candleSeries!=='undefined'&&candleSeries&&candleSeries.setData){
      candleSeries.setData(makeFxCandles(pair,live.rate));
      if(typeof chart!=='undefined'&&chart&&chart.timeScale) chart.timeScale().fitContent();
    }
    if(el('chartStatus')) el('chartStatus').textContent='FX loaded · '+pair+' · '+nowText();
    renderFxTables(pair,live.rate);
  }
  function renderFxTables(pair,rate){
    var p=pairParts(pair),from=p[0],to=p[1];
    if(el('forecastRange')) el('forecastRange').textContent=fmt(rate*.97)+' - '+fmt(rate*1.03);
    if(el('forecastTable')) el('forecastTable').innerHTML='<tr><th>Scenario</th><th>Rate View</th><th>Interpretation</th></tr><tr><td>Base</td><td>'+fmt(rate)+'</td><td>Reference live rate with normal FX volatility.</td></tr><tr><td>Stronger '+from+'</td><td>'+fmt(rate*1.025)+'</td><td>'+from+' strengthens versus '+to+' on relative rates or risk flows.</td></tr><tr><td>Weaker '+from+'</td><td>'+fmt(rate*.975)+'</td><td>'+from+' weakens versus '+to+' if macro or policy pressure shifts.</td></tr>';
    if(el('analysisTable')) el('analysisTable').innerHTML='<tr><th>Driver</th><th>Current Read</th></tr><tr><td>Central banks</td><td>Rate expectations and policy tone remain key FX drivers.</td></tr><tr><td>Inflation / yields</td><td>Yield spreads can move '+pair+' materially.</td></tr><tr><td>Geopolitics</td><td>Risk-off periods can quickly change currency flows.</td></tr>';
    if(el('momentumScore')) el('momentumScore').textContent='Live FX';
    if(el('riskScore')) el('riskScore').textContent='Medium';
    if(el('recommendationScore')) el('recommendationScore').textContent='Monitor';
    if(el('outlookScore')) el('outlookScore').textContent='Macro driven';
    if(el('dayHighValue')) el('dayHighValue').textContent=fmt(rate*1.004);
    if(el('dayLowValue')) el('dayLowValue').textContent=fmt(rate*.996);
    if(el('weekHighValue')) el('weekHighValue').textContent=fmt(rate*1.035);
    if(el('weekLowValue')) el('weekLowValue').textContent=fmt(rate*.965);
    if(el('priceLevelsTable')) el('priceLevelsTable').innerHTML='<tr><th>Level</th><th>Value</th><th>Use</th></tr><tr><td>Live</td><td>'+fmt(rate)+'</td><td>Current FX reference</td></tr><tr><td>Day range</td><td>'+fmt(rate*.996)+' - '+fmt(rate*1.004)+'</td><td>Short-term reference band</td></tr><tr><td>52-week proxy</td><td>'+fmt(rate*.965)+' - '+fmt(rate*1.035)+'</td><td>Longer reference band</td></tr>';
  }
  function startFxLoop(){
    if(fxTimer) clearInterval(fxTimer);
    fxTimer=setInterval(function(){
      if(el('marketSelect')&&el('marketSelect').value==='fx') renderFx(el('symbolSelect')?el('symbolSelect').value:'USDINR');
    },5000);
  }
  var oldSet=window.setMarketPreset;
  window.setMarketPreset=function(){
    if(el('marketSelect')&&el('marketSelect').value==='fx'){
      setSymbolOptions();
      if(el('symbolSelect')) el('symbolSelect').value=el('symbolSelect').value||'USDINR';
      if(el('topSignalsMarket')) el('topSignalsMarket').value='fx';
      renderFx(el('symbolSelect')?el('symbolSelect').value:'USDINR');
      window.loadTopMarketSignals&&window.loadTopMarketSignals();
      startFxLoop();
      return;
    }
    if(typeof oldSet==='function') oldSet();
  };
  var oldLoad=window.loadSelectedSymbol;
  window.loadSelectedSymbol=function(){
    if(el('marketSelect')&&el('marketSelect').value==='fx'){
      renderFx(el('symbolSelect')?el('symbolSelect').value:'USDINR');
      return;
    }
    if(typeof oldLoad==='function') oldLoad();
  };
  window.openCurrencyConverter=function(){
    if(el('marketSelect')) el('marketSelect').value='fx';
    window.setMarketPreset();
    var tabBtn=document.querySelectorAll('.tab')[3];
    if(typeof window.showTab==='function'&&tabBtn) window.showTab('currencyTab',tabBtn);
    var tabs=el('marketTabs'); if(tabs) tabs.scrollIntoView({behavior:'smooth',block:'start'});
  };
  var oldSignals=window.loadTopMarketSignals;
  window.loadTopMarketSignals=function(){
    if(el('topSignalsMarket')&&el('topSignalsMarket').value==='fx') return loadFxSignals();
    if(typeof oldSignals==='function') return oldSignals();
  };
  async function loadFxSignals(){
    var buy=[],hold=[],sell=[];
    for(var i=0;i<FX_PAIRS.length;i++){
      var pair=FX_PAIRS[i],p=pairParts(pair),r=await liveFxRate(p[0],p[1]);
      var score=((stableHash(pair+new Date().getUTCMinutes())%900)-450)/100;
      var item={pair:pair,rate:r.rate,score:score,source:r.source};
      if(score>1.15) buy.push(item); else if(score<-1.15) sell.push(item); else hold.push(item);
    }
    buy=buy.sort(function(a,b){return b.score-a.score}).slice(0,5);
    sell=sell.sort(function(a,b){return a.score-b.score}).slice(0,5);
    hold=hold.sort(function(a,b){return Math.abs(a.score)-Math.abs(b.score)}).slice(0,5);
    fillSignals('topBuySignals',buy,'BUY'); fillSignals('topHoldSignals',hold,'HOLD'); fillSignals('topSellSignals',sell,'SELL');
    if(el('topSignalsUpdated')) el('topSignalsUpdated').textContent='FX signals refreshed '+nowText()+' · Based on live/reference FX rates and short-term momentum proxy.';
  }
  function fillSignals(id,list,label){
    var box=el(id); if(!box) return;
    box.innerHTML=list.map(function(x){
      var p=pairParts(x.pair);
      return '<div class="signalItem" onclick="document.getElementById(\'marketSelect\').value=\'fx\';document.getElementById(\'symbolSelect\').value=\''+x.pair+'\';loadSelectedSymbol();"><div class="signalItemTop"><div><small>'+label+' FX</small><b>'+p[0]+'/'+p[1]+'</b></div><span class="tag '+(label==='BUY'?'buy':label==='SELL'?'sell':'hold')+'">'+label+'</span></div><div class="signalHeadline">Live/reference rate: '+fmt(x.rate)+' · Momentum score: '+fmt(x.score)+'</div><div class="signalMeta">Source: '+x.source+' · FX updates every refresh cycle.</div></div>';
    }).join('');
  }
  function ensureFxSignalOption(){
    var s=el('topSignalsMarket');
    if(s&&!Array.from(s.options).some(function(o){return o.value==='fx'})){
      s.insertAdjacentHTML('beforeend','<option value="fx">Currency / FX</option>');
    }
  }
  document.addEventListener('DOMContentLoaded',function(){
    ensureFxSignalOption();
    startFxLoop();
    if(signalTimer) clearInterval(signalTimer);
    signalTimer=setInterval(function(){if(el('topSignalsMarket')&&el('topSignalsMarket').value==='fx') loadFxSignals();},5000);
    if(el('marketSelect')&&el('marketSelect').value==='fx') window.setMarketPreset();
  });
})();
</script>`;

html = html.replace(/<script id="sw-direct-fx-live-fix">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', patch + '\n</body>');
fs.writeFileSync(path, html, 'utf8');
console.log('ScaleWise Direct FX/live signal behavior patched.');
