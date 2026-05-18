// ScaleWise Direct chart fallback override
// Automatically falls back to Yahoo Finance candles when Finnhub candles fail.
(function () {
  function sourceLabel(source) {
    return source === 'Yahoo Finance fallback' ? 'Yahoo candles loaded' : 'Finnhub candles loaded';
  }

  async function loadCandlesWithFallback(symbol) {
    if (typeof candleSeries === 'undefined' || typeof volumeSeries === 'undefined' || typeof chart === 'undefined' || !candleSeries || !volumeSeries || !chart) {
      return;
    }

    if (typeof setChartState === 'function') {
      setChartState('Loading candles for ' + symbol, true);
    }

    const resolutionEl = document.getElementById('resolutionSelect');
    const resolution = resolutionEl ? resolutionEl.value : 'D';
    const days = resolution === 'D' ? 365 : resolution === 'W' ? 1500 : 30;

    async function requestCandles(endpoint) {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Candle request failed.');
      }
      if (!data.candles || !data.candles.length) {
        throw new Error(data.message || 'No candle data returned.');
      }
      return data;
    }

    try {
      let data;
      let source = 'Finnhub';

      try {
        data = await requestCandles('/.netlify/functions/finnhub-candles?symbol=' + encodeURIComponent(symbol) + '&resolution=' + encodeURIComponent(resolution) + '&days=' + days);
      } catch (finnhubError) {
        data = await requestCandles('/.netlify/functions/yahoo-candles?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(resolution));
        source = data.source || 'Yahoo Finance fallback';
      }

      const candles = data.candles.map(function (x) {
        return {
          time: x.time,
          open: x.open,
          high: x.high,
          low: x.low,
          close: x.close
        };
      });

      const volumes = data.candles
        .filter(function (x) { return x.volume !== null && x.volume !== undefined; })
        .map(function (x) {
          return {
            time: x.time,
            value: x.volume,
            color: x.close >= x.open ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'
          };
        });

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      chart.timeScale().fitContent();

      if (typeof setChartState === 'function') {
        setChartState(sourceLabel(source) + ' · ' + symbol, true);
      }

      const subtitle = document.getElementById('chartSubTitle');
      if (subtitle) {
        subtitle.textContent = symbol + ' · ' + sourceLabel(source);
      }
    } catch (error) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      if (typeof setChartState === 'function') {
        setChartState(error.message || 'No chart data', false);
      }
    }
  }

  function installOverride() {
    if (typeof loadCandles !== 'function') {
      setTimeout(installOverride, 100);
      return;
    }

    loadCandles = loadCandlesWithFallback;
    reloadCandles = function () {
      if (typeof selected !== 'undefined' && selected && selected.quoteSymbol) {
        loadCandlesWithFallback(selected.quoteSymbol);
      }
    };

    if (typeof selected !== 'undefined' && selected && selected.quoteSymbol) {
      loadCandlesWithFallback(selected.quoteSymbol);
    }
  }

  installOverride();
})();
