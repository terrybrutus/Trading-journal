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
          dataUrl: response.dataUrl,
          pageUrl: response.url || location.href,
          capturedAt: new Date().toISOString(),
          symbol: readSymbol()
        }
      });
      window.open(chrome.runtime.getURL("popup.html?capture=pending"), "_blank", "noopener,noreferrer");
    });
  });

  document.documentElement.appendChild(button);

  function readSymbol() {
    const title = document.title || "";
    const titleMatch = title.match(/^([A-Z0-9:_\-\.]+)/i);
    if (titleMatch) return titleMatch[1].replace(/^.*:/, "");

    const candidate = document.querySelector("[data-symbol-fullname], [data-symbol], [class*=symbol]");
    return candidate?.getAttribute("data-symbol") || candidate?.textContent?.trim() || "";
  }
})();
