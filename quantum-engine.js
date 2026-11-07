(function (root) {
  "use strict";

  const mean = a => a.length
    ? a.reduce((s, x) => s + x, 0) / a.length
    : NaN;

  const median = a => {
    if (!a.length) return NaN;
    const b = [...a].sort((x, y) => x - y);
    const m = Math.floor(b.length / 2);
    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
  };

  function squareOfNine(price) {
    if (!(price > 0)) return [];
    const root = Math.sqrt(price);

    return [45, 90, 135, 180, 225, 270, 315, 360].map(degrees => {
      const step = degrees / 180;
      return {
        degrees,
        support: Math.pow(Math.max(0, root - step), 2),
        resistance: Math.pow(root + step, 2)
      };
    });
  }

  function pivots(data, left = 3, right = 3) {
    const result = [];

    for (let i = left; i < data.length - right; i++) {
      let high = true;
      let low = true;

      for (let j = i - left; j <= i + right; j++) {
        if (j === i) continue;
        if (data[j].high >= data[i].high) high = false;
        if (data[j].low <= data[i].low) low = false;
      }

      if (high) result.push({
        index: i, time: data[i].time,
        price: data[i].high, type: "high"
      });

      if (low) result.push({
        index: i, time: data[i].time,
        price: data[i].low, type: "low"
      });
    }

    return result.sort((a, b) => a.index - b.index);
  }

  function timeCycles(data) {
    const swings = pivots(data);
    const intervals = [];

    for (let i = 1; i < swings.length; i++) {
      const bars = swings[i].index - swings[i - 1].index;
      if (bars > 0) intervals.push(bars);
    }

    const cycle = median(intervals.slice(-12));
    const last = swings.at(-1);
    const windows = [];

    if (last && Number.isFinite(cycle)) {
      const msPerBar = data.length > 1
        ? data.at(-1).time - data.at(-2).time
        : 86400000;

      [0.5, 1, 1.5, 2].forEach(multiplier => {
        const bars = Math.max(1, Math.round(cycle * multiplier));
        const ahead = Math.max(0, last.index + bars - (data.length - 1));

        windows.push({
          barsAhead: ahead,
          estimatedTime: data.at(-1).time + ahead * msPerBar,
          cycleBars: bars,
          label: multiplier + "x median swing interval"
        });
      });
    }

    return {
      pivots: swings,
      intervals,
      medianSwingBars: cycle,
      windows
    };
  }

  function fibonacciLevels(high, low) {
    const range = high - low;
    if (!(range > 0)) return [];

    return [0, .236, .382, .5, .618, .786, 1].map(ratio => ({
      ratio,
      upward: low + range * ratio,
      downward: high - range * ratio
    }));
  }

  function volumeAnalysis(data) {
    const recent = data.slice(-20)
      .map(x => x.volume).filter(Number.isFinite);

    const previous = data.slice(-50, -20)
      .map(x => x.volume).filter(Number.isFinite);

    if (!recent.length || !previous.length) {
      return {
        available: false,
        reason: "Volume history unavailable"
      };
    }

    const currentAverage = mean(recent);
    const previousAverage = mean(previous);

    return {
      available: true,
      currentAverage,
      previousAverage,
      ratio: previousAverage
        ? currentAverage / previousAverage
        : NaN
    };
  }

  function momentum(data) {
    const closes = data.map(x => x.close);
    const fast = mean(closes.slice(-10));
    const slow = mean(closes.slice(-30));
    const first = closes[Math.max(0, closes.length - 11)];
    const last = closes.at(-1);

    const change = first
      ? ((last / first) - 1) * 100
      : 0;

    return {
      fastAverage: fast,
      slowAverage: slow,
      change10BarsPercent: change,
      bias: fast > slow && change > 0
        ? "Bullish"
        : fast < slow && change < 0
          ? "Bearish"
          : "Mixed"
    };
  }

  function buildForecast(data) {
    if (!Array.isArray(data) || data.length < 60) {
      return {
        ready: false,
        reason: "At least 60 valid candles are required."
      };
    }

    const last = data.at(-1);
    const close = last.close;
    const recent = data.slice(-50);

    const high = Math.max(...recent.map(x => x.high));
    const low = Math.min(...recent.map(x => x.low));

    const gann = squareOfNine(close);
    const cycles = timeCycles(data);
    const fibonacci = fibonacciLevels(high, low);
    const volume = volumeAnalysis(data);
    const momentumResult = momentum(data);

    const gannLevels = gann.flatMap(x => [
      {
        price: x.support,
        type: "Support",
        method: "Square of 9 " + x.degrees + " degrees"
      },
      {
        price: x.resistance,
        type: "Resistance",
        method: "Square of 9 " + x.degrees + " degrees"
      }
    ]).filter(x => Number.isFinite(x.price) && x.price > 0);

    const support = gannLevels
      .filter(x => x.price < close)
      .sort((a, b) => b.price - a.price)[0];

    const resistance = gannLevels
      .filter(x => x.price > close)
      .sort((a, b) => a.price - b.price)[0];

    let score = momentumResult.bias === "Bullish"
      ? 1
      : momentumResult.bias === "Bearish"
        ? -1
        : 0;

    if (volume.available && volume.ratio > 1.3) {
      score += Math.sign(momentumResult.change10BarsPercent) * 0.5;
    }

    const direction = score > 0.5
      ? "Bullish bias"
      : score < -0.5
        ? "Bearish bias"
        : "Neutral / mixed";

    return {
      ready: true,
      timestamp: last.time,
      close,
      direction,
      gann,
      nearestSupport: support || null,
      nearestResistance: resistance || null,
      fibonacci,
      cycles,
      momentum: momentumResult,
      volume,

      astro: {
        available: false,
        reason: "Verified planetary ephemeris is not connected yet."
      },

      institutional: {
        available: false,
        reason: "Verified NSE bulk/block deal and shareholding feeds are not connected yet."
      },

      waveAnalysis: {
        available: false,
        reason: "A validated Elliott Wave counting engine is not implemented yet."
      },

      scenarios: [
        {
          name: "Primary",
          bias: direction,
          condition: "Await price confirmation at calculated levels."
        },
        {
          name: "Alternative",
          bias: direction === "Bullish bias" ? "Bearish" : "Bullish",
          condition: "Activate only after primary invalidation."
        },
        {
          name: "No trade",
          bias: "Wait",
          condition: "Use when evidence is conflicting."
        }
      ],

      confidence: "Uncalibrated — historical walk-forward testing required."
    };
  }

  root.QuantumEngine = {
    buildForecast,
    squareOfNine,
    timeCycles,
    pivots,
    fibonacciLevels
  };

})(window);
