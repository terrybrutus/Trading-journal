(function installCaffeineBridge() {
  if (window.__quantumCaffeineBridgeInstalled) return;
  window.__quantumCaffeineBridgeInstalled = true;

  async function deliverPendingCapture() {
    const params = new URLSearchParams(window.location.search);
    const deliveryId = params.get("quantumDelivery");
    if (!deliveryId) return;
    const result = await chrome.storage.local.get("quantumPendingCaffeineCapture");
    const capture = result.quantumPendingCaffeineCapture;
    if (!capture) return;
    if (capture.deliveryId !== deliveryId) return;
    if (capture.expiresAtMs && Date.now() > capture.expiresAtMs) {
      await chrome.storage.local.remove("quantumPendingCaffeineCapture");
      return;
    }
    window.postMessage(
      {
        source: "quantum-extension",
        type: "QUANTUM_EXTENSION_CAPTURE",
        capture
      },
      window.location.origin
    );
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "quantum-caffeine-app") return;
    if (event.data?.type !== "QUANTUM_EXTENSION_CAPTURE_RESULT") return;
    await chrome.storage.local.set({
      quantumLastCaffeineResult: {
        ...event.data.result,
        receivedAt: new Date().toISOString()
      }
    });
    if (event.data.result?.ok) {
      await chrome.storage.local.remove("quantumPendingCaffeineCapture");
    }
  });

  deliverPendingCapture();
  [1200, 2500, 5000, 9000, 14000].forEach((delay) => {
    window.setTimeout(deliverPendingCapture, delay);
  });
})();
