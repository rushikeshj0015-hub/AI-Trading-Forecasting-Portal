(function (root) {
  "use strict";

  const KEY = "aladdin_quantum_forecast_ledger_v1";

  function readStore() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        forecasts: Array.isArray(s.forecasts) ? s.forecasts : [],
        evaluations: Array.isArray(s.evaluations) ? s.evaluations : []
      };
    } catch {
      return { forecasts: [], evaluations: [] };
    }
  }

  function writeStore(s) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }

  function id() {
    return "F-" + Date.now().toString(36) +
      "-" + Math.random().toString(36).slice(2, 9);
  }

  function recordForecast(input) {
    if (!input || !input.symbol || !input.forecast)
      throw Error("Symbol and forecast are required.");

    const s = readStore();

    const record = {
      id: id(),
      createdAt: new Date().toISOString(),
      symbol: String(input.symbol).toUpperCase(),
      timeframe: input.timeframe || "unspecified",
      dataSource: input.dataSource || "not specified",
      modelVersion: input.modelVersion || "baseline-v1",
      forecast: JSON.parse(JSON.stringify(input.forecast))
    };

    s.forecasts.push(record);
    writeStore(s);
    return record;
  }

  function evaluateOpenForecasts(symbol, timeframe, candles) {
    if (!Array.isArray(candles))
      throw Error("Candles must be an array.");

    const s = readStore();
    const results = [];

    const completed = new Set(
      s.evaluations
        .filter(x => x.outcome === "TARGET1_HIT" ||
                     x.outcome === "STOP_HIT")
        .map(x => x.forecastId)
    );

    for (const record of s.forecasts) {
      if (record.symbol !== String(symbol).toUpperCase()) continue;
      if (record.timeframe !== timeframe) continue;
      if (completed.has(record.id)) continue;

      const f = record.forecast;
      if (f.direction !== "Bullish" && f.direction !== "Bearish") continue;

      const entryTime = Number(f.candleTime);
      const stop = Number(f.stopLoss);
      const target = Number(f.target1);

      if (![entryTime, stop, target].every(Number.isFinite)) continue;

      const future = candles.filter(c => Number(c.time) > entryTime);
      let result = null;

      for (const c of future) {
        const high = Number(c.high);
        const low = Number(c.low);
        if (!Number.isFinite(high) || !Number.isFinite(low)) continue;

        const stopHit = f.direction === "Bullish"
          ? low <= stop : high >= stop;
        const targetHit = f.direction === "Bullish"
          ? high >= target : low <= target;

        // Conservative assumption if both levels occur in one candle.
        if (stopHit) {
          result = { outcome: "STOP_HIT", price: stop, time: c.time };
          break;
        }
        if (targetHit) {
          result = { outcome: "TARGET1_HIT", price: target, time: c.time };
          break;
        }
      }

      if (result) {
        const evaluation = {
          id: id(),
          forecastId: record.id,
          evaluatedAt: new Date().toISOString(),
          candlesChecked: future.length,
          outcome: result.outcome,
          outcomePrice: result.price,
          outcomeTime: result.time
        };

        s.evaluations.push(evaluation);
        results.push(evaluation);
      }
    }

    if (results.length) writeStore(s);
    return results;
  }

  function getSummary() {
    const s = readStore();
    const latest = new Map();

    for (const e of s.evaluations) latest.set(e.forecastId, e);

    const closed = [...latest.values()].filter(e =>
      e.outcome === "TARGET1_HIT" || e.outcome === "STOP_HIT"
    );

    const wins = closed.filter(e => e.outcome === "TARGET1_HIT").length;
    const losses = closed.filter(e => e.outcome === "STOP_HIT").length;

    return {
      totalForecasts: s.forecasts.length,
      evaluatedForecasts: closed.length,
      openForecasts: s.forecasts.length - closed.length,
      targetHits: wins,
      stopHits: losses,
      winRatePercent: closed.length
        ? Number((wins / closed.length * 100).toFixed(2))
        : null,
      note: "Browser-local records. Not independently verified."
    };
  }

  function getForecasts() {
    return readStore().forecasts;
  }

  function exportData() {
    return JSON.stringify(readStore(), null, 2);
  }

  root.QuantumLedger = {
    recordForecast,
    evaluateOpenForecasts,
    getSummary,
    getForecasts,
    exportData
  };
})(window);
