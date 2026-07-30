(function installQuantumCaptureButton() {
  if (window.__quantumTradingViewCaptureInstalled) return;
  window.__quantumTradingViewCaptureInstalled = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "quantum-capture-button";
  button.textContent = "Journal";
  button.title = "Capture this TradingView chart";

  button.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "CAPTURE_VISIBLE_TAB" }, async (response) => {
      if (!response?.ok) {
        alert(`QUANTUM capture failed: ${response?.error || "unknown error"}`);
        return;
      }
      await chrome.storage.local.set({
        quantumPendingCapture: {
          captureId: crypto.randomUUID(),
          dataUrl: response.dataUrl,
          pageUrl: response.url || location.href,
          capturedAt: new Date().toISOString(),
          ...readTradingViewContext()
        }
      });
      chrome.runtime.sendMessage({ type: "OPEN_EDITOR" });
    });
  });

  document.documentElement.appendChild(button);

  function readTradingViewContext() {
    const title = document.title || "";
    const titleMatch = title.match(/^([A-Z0-9:_\-\.]+)/i);
    const titleSymbol = titleMatch ? titleMatch[1].replace(/^.*:/, "") : "";
    const titlePrice = title.match(/\b(\d+(?:\.\d+)?)\b/)?.[1] || "";
    const symbolCandidate = document.querySelector("[data-symbol-fullname], [data-symbol], [class*=symbol]");
    const timeframeText = [...document.querySelectorAll("button, [role=button], [data-name]")]
      .map((node) => node.textContent?.trim() || "")
      .find((text) => /^(1|3|5|15|30|45|60|120|180|240|1D|1W|1M|D|W|M)$/i.test(text));

    return {
      symbol: symbolCandidate?.getAttribute("data-symbol") || titleSymbol || symbolCandidate?.textContent?.trim() || "",
      timeframe: timeframeText || "",
      price: titlePrice || ""
    };
  }
})();
