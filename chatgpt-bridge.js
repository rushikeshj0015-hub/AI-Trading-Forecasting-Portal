(function (root) {
  "use strict";

  const $ = id => document.getElementById(id);

  function init(getContext) {
    const status = $("ai-bridge-status");
    const output = $("ai-bridge-output");

    function buildPrompt() {
      const c = getContext();
      if (!c || !Array.isArray(c.candles) || c.candles.length < 30) {
        throw Error("Load at least 30 market candles first.");
      }

      const payload = {
        app: "ALADDIN QUANTUM OMNI",
        task: "Independent market analysis and forecast",
        generatedAt: new Date().toISOString(),
        symbol: c.symbol,
        timeframe: c.timeframe,
        dataSource: c.dataSource,
        latestPrice: c.latestPrice,
        indicators: c.indicators,
        calculatedForecast: c.calculatedForecast,
        candles: c.candles.slice(-100)
      };

      return `You are the analytical assistant for ALADDIN QUANTUM OMNI.
Analyse the supplied market data carefully. Do not invent missing data,
news, institutional activity, astrology calculations, Elliott Wave counts,
or exact reversal dates. Distinguish measured facts from hypotheses.

Assess trend, momentum, volatility, support/resistance, volume if available,
and whether the supplied technical forecast is supported or contradicted.
Give bullish, bearish and neutral scenarios. If evidence is insufficient,
say so. Do not promise accuracy or guaranteed returns.

Return ONLY valid JSON using this structure:
{
  "symbol": "string",
  "timeframe": "string",
  "bias": "Bullish, Bearish, or Neutral",
  "setup": "string",
  "entry": null,
  "stopLoss": null,
  "target1": null,
  "target2": null,
  "turningPointWindow": "string",
  "support": ["level 1", "level 2"],
  "resistance": ["level 1", "level 2"],
  "confirmation": ["condition 1"],
  "invalidation": ["condition 1"],
  "confidence": "Low, Moderate, or High",
  "reasoning": "Concise explanation",
  "limitations": ["limitation 1"]
}

Prices must be numbers or null. Do not force a trade when the setup is
unclear. Confidence is a qualitative assessment, not a statistically
calibrated probability.

MARKET DATA:
${JSON.stringify(payload, null, 2)}`;
    }

    $("ai-build-prompt").addEventListener("click", () => {
      try {
        $("ai-prompt").value = buildPrompt();
        status.textContent = "Prompt prepared. Copy it into ChatGPT.";
      } catch (e) {
        status.textContent = e.message;
      }
    });

    $("ai-copy-prompt").addEventListener("click", async () => {
      const prompt = $("ai-prompt").value;
      if (!prompt) {
        status.textContent = "Prepare the prompt first.";
        return;
      }
      try {
        await navigator.clipboard.writeText(prompt);
        status.textContent = "Prompt copied. Open ChatGPT and paste it.";
      } catch {
        $("ai-prompt").focus();
        $("ai-prompt").select();
        status.textContent = "Clipboard unavailable. Long-press the selected prompt and choose Copy.";
      }
    });

    $("ai-open-chatgpt").addEventListener("click", () => {
      root.open("https://chatgpt.com/", "_blank");
    });

    $("ai-import").addEventListener("click", () => {
      try {
        const raw = $("ai-response").value.trim();
        const result = JSON.parse(raw);

        const allowed = ["Bullish", "Bearish", "Neutral"];
        if (!result || typeof result !== "object" ||
            !allowed.includes(result.bias) ||
            typeof result.reasoning !== "string") {
          throw Error("Response must contain a valid bias and reasoning.");
        }

        for (const key of ["entry", "stopLoss", "target1", "target2"]) {
          if (result[key] !== null &&
              result[key] !== undefined &&
              !Number.isFinite(Number(result[key]))) {
            throw Error("Invalid numeric value in " + key + ".");
          }
        }

        const safe = {
          importedAt: new Date().toISOString(),
          ...result
        };
        localStorage.setItem("aq_chatgpt_analysis_v1", JSON.stringify(safe));

        output.textContent = JSON.stringify(safe, null, 2);
        status.textContent = "Analysis imported and saved in this browser.";
      } catch (e) {
        status.textContent = "Import error: " + e.message;
      }
    });

    const saved = localStorage.getItem("aq_chatgpt_analysis_v1");
    if (saved) {
      try {
        output.textContent = JSON.stringify(JSON.parse(saved), null, 2);
      } catch {}
    }
  }

  root.QuantumBridge = { init };
})(window);
