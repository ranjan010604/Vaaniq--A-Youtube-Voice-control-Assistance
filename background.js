// background.js - Vaaniq service worker (no backend)

const DEFAULT_SETTINGS = {
    wakeWord: "hey vaaniq",
    seekSeconds: 10,
    language: "en-IN"
  };
  
  chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["vaaniqSettings"], (res) => {
      if (!res.vaaniqSettings) {
        chrome.storage.local.set({ vaaniqSettings: DEFAULT_SETTINGS });
      } else {
        chrome.storage.local.set({
          vaaniqSettings: { ...DEFAULT_SETTINGS, ...res.vaaniqSettings }
        });
      }
    });
  });
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string") return;
  
    if (message.type === "GET_SETTINGS") {
      chrome.storage.local.get(["vaaniqSettings"], (res) => {
        sendResponse({ ...DEFAULT_SETTINGS, ...(res.vaaniqSettings || {}) });
      });
      return true;
    }
  
    if (message.type === "SAVE_SETTINGS") {
      const merged = { ...DEFAULT_SETTINGS, ...(message.settings || {}) };
      chrome.storage.local.set({ vaaniqSettings: merged }, () => {
        chrome.tabs.query({ url: "*://www.youtube.com/*" }, (tabs) => {
          for (const tab of tabs) {
            if (tab.id == null) continue;
            chrome.tabs.sendMessage(
              tab.id,
              { type: "SETTINGS_UPDATED", settings: merged },
              () => { void chrome.runtime.lastError; }
            );
          }
        });
        sendResponse({ ok: true, settings: merged });
      });
      return true;
    }
  
    if (message.type === "GET_SETTINGS_FROM_CONTENT") {
      chrome.storage.local.get(["vaaniqSettings"], (res) => {
        sendResponse({ ...DEFAULT_SETTINGS, ...(res.vaaniqSettings || {}) });
      });
      return true;
    }
  });