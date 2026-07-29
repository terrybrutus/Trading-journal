const statusEl = document.getElementById("status");

function setStatus(message) {
  statusEl.textContent = message;
}

document.getElementById("capture").addEventListener("click", async () => {
  setStatus("Capturing...");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, async (dataUrl) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message);
      return;
    }
    await chrome.storage.local.set({
      quantumPendingCapture: {
        dataUrl,
        pageUrl: tab.url || "",
        capturedAt: new Date().toISOString(),
        symbol: ""
      }
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?capture=pending") });
    window.close();
  });
});

document.getElementById("open").addEventListener("click", async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
  window.close();
});
