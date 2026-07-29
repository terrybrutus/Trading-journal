chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_EDITOR") {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?capture=pending") });
    return false;
  }

  if (message?.type === "CAPTURE_VISIBLE_TAB") {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ ok: true, dataUrl, url: sender.tab?.url || "" });
    });
    return true;
  }

  return false;
});
