// popup.js - Vaaniq settings popup

const FIELDS = ["wakeWord", "seekSeconds", "language"];

const COMMAND_CHEATSHEET = [
  { title: "🔍 Search YouTube", phrases: ['search lofi beats', 'search cooking pasta', 'find react tutorial'] },
  { title: "▶️ Play by Name",   phrases: ['play lo-fi study mix', 'play mrbeast latest', 'play interstellar trailer'] },
  { title: "🪟 Mini Player",    phrases: ['mini player', 'minimize', 'shrink the video'] },
  { title: "🖥 Theater Mode",    phrases: ['theater', 'wide mode', 'cinema mode'] },
  { title: "🖥 Default Mode",    phrases: ['default mode', 'normal view'] },
  { title: "⬇ Scroll Down",      phrases: ['scroll down', 'page down', 'go down'] },
  { title: "⬆ Scroll Up",        phrases: ['scroll up', 'page up', 'go up'] },
  { title: "⬆ Top of Page",      phrases: ['scroll to top', 'go to top', 'back to top'] },
  { title: "⬇ Bottom of Page",   phrases: ['scroll to bottom', 'go to bottom'] },
  { title: "⏪ Seek Backward",    phrases: ['back', 'rewind', 'back 15', 'rewind 30'] },
  { title: "⏩ Seek Forward",     phrases: ['forward', 'fast forward', 'forward 20'] },
  { title: "⏯ Play / Pause",     phrases: ['play', 'resume', 'pause', 'stop'] },
  { title: "⏮ Previous Video",   phrases: ['previous', 'prev'] },
  { title: "⏭ Next Video",       phrases: ['next', 'skip'] },
  { title: "⚡ Playback Speed",   phrases: ['speed 1.5', 'speed 2', 'speed 0.5'] },
  { title: "🔇 Mute / Unmute",   phrases: ['mute', 'unmute'] },
  { title: "🔊 Volume",          phrases: ['volume up', 'louder', 'volume down', 'quieter'] },
  { title: "🔄 Replay",          phrases: ['replay', 'start over', 'from the beginning'] },
  { title: "⏭ End of Video",     phrases: ['skip to the end', 'go to the end'] },
  { title: "📺 Fullscreen",      phrases: ['fullscreen', 'full screen'] },
  { title: "🚫 Skip Ad",         phrases: ['skip ad', 'skip the ad'] }
];

function renderCheatsheet() {
  const list = document.getElementById("cmdList");
  if (!list) return;
  list.innerHTML = "";
  for (const group of COMMAND_CHEATSHEET) {
    const wrap = document.createElement("div");
    wrap.className = "cmd-group";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = group.title;
    const phrases = document.createElement("div");
    phrases.className = "phrases";
    phrases.innerHTML = group.phrases.map((p) => `<code>${p}</code>`).join(" &nbsp;·&nbsp; ");
    wrap.appendChild(title);
    wrap.appendChild(phrases);
    list.appendChild(wrap);
  }
}

function loadSettings() {
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
    if (chrome.runtime.lastError) return;
    if (!settings) return;
    for (const key of FIELDS) {
      const el = document.getElementById(key);
      if (el) el.value = settings[key] ?? "";
    }
  });
}

function collectSettings() {
  const out = {};
  for (const key of FIELDS) {
    const el = document.getElementById(key);
    if (!el) continue;
    out[key] =
      key === "seekSeconds"
        ? Math.max(1, Number(el.value) || 10)
        : el.value.trim() || (key === "wakeWord" ? "hey vaaniq" : "en-IN");
  }
  return out;
}

document.getElementById("save").addEventListener("click", () => {
  const settings = collectSettings();
  const btn = document.getElementById("save");
  btn.disabled = true;
  btn.textContent = "Saving…";
  btn.classList.remove("ok");

  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, (res) => {
    btn.disabled = false;
    if (chrome.runtime.lastError || !res?.ok) {
      btn.textContent = "Save failed";
      console.error("Vaaniq: save failed", chrome.runtime.lastError);
    } else {
      btn.textContent = "Saved ✓";
      btn.classList.add("ok");
    }
    setTimeout(() => {
      btn.textContent = "Save Settings";
      btn.classList.remove("ok");
    }, 1200);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  renderCheatsheet();
  loadSettings();
});