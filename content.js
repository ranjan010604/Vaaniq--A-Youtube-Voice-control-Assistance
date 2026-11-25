// content.js - injected into www.youtube.com (Chrome + Edge)
// Pure local voice control - no backend, no WebSocket.
// Mic listens ALWAYS once Start Listening is clicked.
// Commands fire INSTANTLY when a known phrase appears in the transcript.

(function () {
    "use strict";
  
    const DEFAULT_SETTINGS = {
      wakeWord: "hey vaaniq",
      seekSeconds: 10,
      language: "en-IN"
    };
  
    // ---- Tunables ----
    const DEDUPE_MS = 1200;
    const SAME_COMMAND_COOLDOWN = 800;
    const INSTANT_MIN_LEN = 2;
    const SCROLL_STEP = 600;
    const MINI_PLAYER_MAX_W = 400;
  
    let settings = { ...DEFAULT_SETTINGS };
  
    let recognition = null;
    let recognitionRunning = false;
    let micToggledOn = false;
  
    let lastPhrase = "";
    let lastPhraseAt = 0;
  
    const actionLastRunAt = {};
  
    // Mini-player state
    let miniActive = false;
    let miniObserver = null;
  
    // ---------------- Boot ----------------
    chrome.storage.local.get(["vaaniqSettings"], (res) => {
      if (res.vaaniqSettings) settings = { ...DEFAULT_SETTINGS, ...res.vaaniqSettings };
      init();
    });
  
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "SETTINGS_UPDATED") {
        settings = { ...DEFAULT_SETTINGS, ...msg.settings };
        if (recognition) { try { recognition.lang = settings.language; } catch (e) {} }
        showTranscript("Settings updated");
      }
    });
  
    function init() {
      injectOverlay();
      setupRecognition();
      setInterval(autoAdWatcher, 700);
    }
  
    // ============================================================
    // SPEECH RECOGNITION
    // ============================================================
    function setupRecognition() {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
  
      if (!SpeechRecognition) {
        showTranscript("Speech recognition not supported in this browser");
        console.warn("Vaaniq: SpeechRecognition not supported");
        return;
      }
  
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.language;
  
      recognition.onstart = () => {
        recognitionRunning = true;
        flashMic(true);
        showTranscript("Listening...");
      };
  
      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const raw = event.results[i][0].transcript.trim().toLowerCase();
          if (!raw || raw.length < INSTANT_MIN_LEN) continue;
  
          showTranscript("Heard: " + raw);
  
          const now = Date.now();
          if (raw === lastPhrase && now - lastPhraseAt < DEDUPE_MS) continue;
          lastPhrase = raw;
          lastPhraseAt = now;
  
          tryExecute(raw);
        }
      };
  
      recognition.onerror = (e) => {
        console.warn("Vaaniq recognition error", e.error);
        showTranscript("Mic error: " + e.error);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          showTranscript("Mic blocked - allow Microphone for this site");
        }
        if (micToggledOn && e.error !== "not-allowed" && e.error !== "service-not-allowed") {
          try { recognition.start(); } catch (err) {}
        }
      };
  
      recognition.onend = () => {
        recognitionRunning = false;
        flashMic(false);
        if (micToggledOn) {
          try { recognition.start(); } catch (e) {
            console.warn("Vaaniq: restart failed", e);
          }
        }
      };
    }
  
    function tryExecute(raw) {
      const commands = window.VAANIQ_COMMANDS || [];
      const text = raw.trim().toLowerCase();
      if (!text) return;
  
      if (commands.length > 0) {
        const command = commands.find((item) =>
          item.phrases.some((pattern) => pattern.test(text))
        );
        if (!command) return;
  
        const now = Date.now();
        if (actionLastRunAt[command.id] && now - actionLastRunAt[command.id] < SAME_COMMAND_COOLDOWN) {
          return;
        }
        actionLastRunAt[command.id] = now;
  
        const parameter = command.getParameter
          ? command.getParameter(text, settings)
          : null;
  
        // Commands that need a parameter must not fire when parameter is empty.
        if (command.id === "SEARCH" && (!parameter || !parameter.length)) return;
        if (command.id === "PLAY_BY_NAME" && (!parameter || parameter.length < 2)) return;
  
        executeAction(command.id, parameter);
        showTranscript(
          "Executed: " + command.id +
          (parameter != null && parameter !== "" ? " (" + parameter + ")" : "")
        );
        return;
      }
  
      // Fallback matcher (if command-registry.js is missing) — minimal set.
      if (/\bpause\b/.test(text)) return executeAction("PAUSE");
      if (/\bunmute\b/.test(text)) return executeAction("UNMUTE");
      if (/\bmute\b/.test(text)) return executeAction("MUTE");
      if (/\bnext\b/.test(text)) return executeAction("NEXT_VIDEO");
      if (/\bprevious\b/.test(text)) return executeAction("PREVIOUS_VIDEO");
      if (/\bplay\b/.test(text)) return executeAction("PLAY");
      if (/\bfull\s*-?\s*screen\b/.test(text)) return executeAction("FULLSCREEN");
    }
  
    function toggleMic() {
      if (!recognition) return;
      micToggledOn = !micToggledOn;
      if (micToggledOn) {
        try { recognition.start(); } catch (e) {
          console.warn("Vaaniq: could not start recognition", e);
          showTranscript("Could not start mic: " + e.message);
        }
      } else {
        recognition.stop();
      }
      updateMicButton();
    }
  
    function updateMicButton() {
      const btn = document.getElementById("vaaniq-mic-toggle");
      if (btn) {
        btn.textContent = micToggledOn ? "🎙 Stop Listening" : "🎙 Start Listening";
        btn.classList.toggle("vaaniq-mic-on", micToggledOn);
      }
    }
  
    // ============================================================
    // YOUTUBE PLAYER HELPERS
    // ============================================================
    function getVideo() {
      return document.querySelector("video");
    }
  
    function robustClick(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const opts = {
        bubbles: true, cancelable: true, view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      };
      try {
        el.dispatchEvent(new PointerEvent("pointerdown", opts));
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new PointerEvent("pointerup", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
        if (typeof el.click === "function") el.click();
        return true;
      } catch (e) {
        console.warn("Vaaniq: robustClick failed", e);
        return false;
      }
    }
  
    function clickSelector(selector) {
      const el = document.querySelector(selector);
      if (el) robustClick(el);
    }
  
    function isAdShowing() {
      const player = document.querySelector("#movie_player");
      return !!(player && player.classList && player.classList.contains("ad-showing"));
    }
  
    // ============================================================
    // MINI PLAYER / THEATER / DEFAULT
    // ============================================================
    function isTheaterMode() {
      const player = document.querySelector("#movie_player");
      return !!(player && player.getAttribute("theater") === "true");
    }
  
    function enterMiniPlayer() {
      // If a video is open, YouTube's mini-player is triggered by scrolling
      // the watch page away, OR by clicking the "miniplayer" button on the
      // player. We try the button first, then fall back to scrolling the
      // page down so YouTube's own "keep playing on scroll" kicks in.
      const btn = document.querySelector(".ytp-miniplayer-button");
      if (btn) {
        robustClick(btn);
        miniActive = true;
        showTranscript("Mini player");
        watchMiniPlayer();
        return;
      }
      // Fallback: scroll the page down. YouTube auto-minimizes the player.
      window.scrollTo({ top: window.innerHeight * 1.5, behavior: "smooth" });
      miniActive = true;
      showTranscript("Mini player (via scroll)");
      watchMiniPlayer();
    }
  
    function exitMiniPlayer() {
      // Click the mini-player to restore the full watch page.
      const mini = document.querySelector(
        ".ytp-miniplayer, .html5-video-player.ytp-player-minimized"
      );
      if (mini) {
        robustClick(mini);
        miniActive = false;
        showTranscript("Restored player");
        return;
      }
      // If we don't see the mini-player DOM, just navigate back to the
      // watch page (works after the scroll-triggered miniplayer).
      if (location.pathname !== "/watch") return;
      window.scrollTo({ top: 0, behavior: "smooth" });
      miniActive = false;
      showTranscript("Restored player");
    }
  
    function watchMiniPlayer() {
      if (miniObserver) miniObserver.disconnect();
      // If YouTube removes the mini-player for any reason, reset our flag.
      miniObserver = new MutationObserver(() => {
        const mini = document.querySelector(
          ".ytp-miniplayer, .html5-video-player.ytp-player-minimized"
        );
        if (!mini && miniActive) {
          miniActive = false;
        }
      });
      miniObserver.observe(document.body, { childList: true, subtree: true });
    }
  
    function setTheaterMode(on) {
      // Click the theater/size button until the state matches.
      const btn = document.querySelector(".ytp-size-button");
      if (!btn) return;
      const current = isTheaterMode();
      if (current !== on) robustClick(btn);
      showTranscript(on ? "Theater mode" : "Default mode");
    }
  
    // ============================================================
    // SCROLLING
    // ============================================================
    function scrollBy(delta) {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }
    function scrollTop() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function scrollBottom() {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }
  
    // ============================================================
    // SEARCH
    // ============================================================
    function searchYouTube(query) {
      if (!query) return;
      const url = "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);
      window.location.href = url;
      showTranscript("Searching: " + query);
    }
  
    // ============================================================
    // PLAY VIDEO BY NAME (from currently visible results/feed)
    // ============================================================
    function collectVisibleVideos() {
      // Broad set of title anchors YouTube uses on home / results / sidebar.
      const selectors = [
        "a#video-title",
        "a#video-title-link",
        "a.yt-simple-endpoint.style-scope.ytd-rich-grid-media",
        "a.yt-simple-endpoint.style-scope.ytd-video-renderer",
        "a#thumbnail"
      ];
      const seen = new Set();
      const items = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((a) => {
          const href = a.getAttribute("href") || "";
          if (!href.includes("/watch")) return;
          const title =
            (a.getAttribute("title") || a.textContent || "").trim();
          if (!title || title.length < 3) return;
          const key = href.split("&")[0];
          if (seen.has(key)) return;
          seen.add(key);
          items.push({ el: a, href, title, text: title.toLowerCase() });
        });
      }
      return items;
    }
  
    // Simple fuzzy score: fraction of query tokens present in the title.
    function scoreTitle(query, title) {
      const qTokens = query.split(/\s+/).filter((w) => w.length > 1);
      if (qTokens.length === 0) return 0;
      let hits = 0;
      for (const tok of qTokens) {
        if (title.includes(tok)) hits++;
      }
      const ratio = hits / qTokens.length;
      // Exact substring is best.
      const exact = title.includes(query) ? 0.5 : 0;
      return ratio + exact;
    }
  
    function playVideoByName(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        showTranscript("No video name given");
        return;
      }
  
      const videos = collectVisibleVideos();
      if (videos.length === 0) {
        showTranscript("No videos visible on this page");
        return;
      }
  
      let best = null;
      let bestScore = 0;
      for (const v of videos) {
        const s = scoreTitle(q, v.text);
        if (s > bestScore) {
          bestScore = s;
          best = v;
        }
      }
  
      if (!best || bestScore < 0.5) {
        // Not found on the current page → fall back to a YouTube search
        // for the phrase. Most reliable UX.
        showTranscript('Not on page, searching "' + query + '"');
        searchYouTube(query);
        return;
      }
  
      showTranscript("Playing: " + best.title);
      // Navigate in the same tab (robust — click can be intercepted by
      // YouTube's SPA router, location.href always works).
      window.location.href = best.href;
    }
  
    // ============================================================
    // ACTIONS
    // ============================================================
    function executeAction(action, parameter) {
      const video = getVideo();
      switch (action) {
        case "SEEK_FORWARD":
          if (video) video.currentTime += Number(parameter) || settings.seekSeconds;
          break;
        case "SEEK_BACKWARD":
          if (video) video.currentTime -= Number(parameter) || settings.seekSeconds;
          break;
        case "SET_SPEED":
          if (video) video.playbackRate = Number(parameter) || 1.0;
          break;
        case "PLAY":
          if (video) video.play().catch(() => {});
          break;
        case "PAUSE":
          if (video) video.pause();
          break;
        case "TOGGLE_PLAY":
          if (video) (video.paused ? video.play().catch(() => {}) : video.pause());
          break;
        case "MUTE":
          if (video) video.muted = true;
          break;
        case "UNMUTE":
          if (video) video.muted = false;
          break;
        case "VOLUME_UP":
          if (video) { video.muted = false; video.volume = Math.min(1, video.volume + 0.1); }
          break;
        case "VOLUME_DOWN":
          if (video) video.volume = Math.max(0, video.volume - 0.1);
          break;
        case "REPLAY":
        case "SEEK_START":
          if (video) { video.currentTime = 0; video.play().catch(() => {}); }
          break;
        case "SEEK_END":
          if (video && Number.isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.duration - 1);
          }
          break;
        case "NEXT_VIDEO":
          clickSelector(".ytp-next-button");
          break;
        case "PREVIOUS_VIDEO":
          window.history.back();
          break;
        case "SKIP_AD":
          trySkipAd(30);
          break;
        case "FULLSCREEN":
          clickSelector(".ytp-fullscreen-button");
          break;
  
        // ---- new ----
        case "MINI_PLAYER":
          miniActive ? exitMiniPlayer() : enterMiniPlayer();
          break;
        case "THEATER_MODE":
          setTheaterMode(true);
          break;
        case "DEFAULT_MODE":
          setTheaterMode(false);
          break;
        case "SCROLL_DOWN":
          scrollBy(SCROLL_STEP);
          showTranscript("Scrolled down");
          break;
        case "SCROLL_UP":
          scrollBy(-SCROLL_STEP);
          showTranscript("Scrolled up");
          break;
        case "SCROLL_TOP":
          scrollTop();
          showTranscript("Top of page");
          break;
        case "SCROLL_BOTTOM":
          scrollBottom();
          showTranscript("Bottom of page");
          break;
        case "SEARCH":
          searchYouTube(parameter);
          break;
        case "PLAY_BY_NAME":
          playVideoByName(parameter);
          break;
  
        default:
          console.warn("Vaaniq: unknown action", action);
      }
      flashOverlayButton(action);
    }
  
    // ============================================================
    // AD SKIPPING (unchanged)
    // ============================================================
    const SKIP_BUTTON_SELECTORS = [
      ".ytp-ad-skip-button-modern",
      ".ytp-ad-skip-button",
      ".ytp-skip-ad-button",
      ".ytp-ad-skip-button-slot button",
      ".ytp-ad-skip-button-container button",
      ".ytp-ad-overlay-close-button",
      "[class*='ytp-ad-skip']",
      "[id^='skip-button']",
      "tp-yt-paper-button#skip-button"
    ];
    const AD_OVERLAY_SELECTORS = [
      ".ytp-ad-image-overlay",
      ".ytp-ad-text-overlay-container",
      ".ytp-ad-overlay-container",
      ".ytp-ad-player-overlay",
      ".ytp-ad-player-overlay-instream-info",
      ".ytp-ad-overlay-slot"
    ];
    function hideAdOverlaysNow(player) {
      for (const sel of AD_OVERLAY_SELECTORS) {
        const el = player.querySelector(sel);
        if (el) {
          el.style.setProperty("opacity", "0", "important");
          el.style.setProperty("pointer-events", "none", "important");
        }
      }
    }
    function forceSkipCurrentAd(announce) {
      const player = document.querySelector("#movie_player") || document;
      const video = getVideo();
      let acted = false;
      if (video && isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration;
        acted = true;
        try { video.dispatchEvent(new Event("ended", { bubbles: true })); } catch (e) {}
      }
      hideAdOverlaysNow(player);
      setTimeout(() => {
        hideAdOverlaysNow(player);
        for (const sel of SKIP_BUTTON_SELECTORS) {
          const el = player.querySelector(sel);
          if (el && el.offsetParent !== null) { robustClick(el); break; }
        }
        const v = getVideo();
        if (v && v.paused) v.play().catch(() => {});
      }, 120);
      if (announce) showTranscript(acted ? "Skipping ad..." : "No ad video found to skip");
      return acted;
    }
    let adCurrentlyHandled = false;
    let lastHandledAdDuration = null;
    function autoAdWatcher() {
      if (!isAdShowing()) {
        adCurrentlyHandled = false;
        lastHandledAdDuration = null;
        return;
      }
      const player = document.querySelector("#movie_player") || document;
      hideAdOverlaysNow(player);
      const video = getVideo();
      if (!video || !isFinite(video.duration) || video.duration <= 0.5) return;
      const isDifferentAd =
        lastHandledAdDuration === null || Math.abs(video.duration - lastHandledAdDuration) > 0.3;
      const looksLikeFreshStart = video.currentTime < 0.75;
      if (!adCurrentlyHandled || isDifferentAd || looksLikeFreshStart) {
        adCurrentlyHandled = true;
        lastHandledAdDuration = video.duration;
        forceSkipCurrentAd(true);
      }
    }
    function trySkipAd(attemptsLeft) {
      if (isAdShowing()) {
        const video = getVideo();
        if (video && isFinite(video.duration) && video.duration > 0) {
          forceSkipCurrentAd(true);
          return;
        }
      } else if (attemptsLeft === 10) {
        showTranscript("No ad currently playing");
        return;
      }
      if (attemptsLeft > 0) setTimeout(() => trySkipAd(attemptsLeft - 1), 400);
      else showTranscript("Could not detect a skippable ad");
    }
  
    // ============================================================
    // OVERLAY UI
    // ============================================================
    const COMMANDS = [
      { action: "SEEK_BACKWARD",  label: "⏪ -10s",        param: 10 },
      { action: "TOGGLE_PLAY",    label: "⏯ Play/Pause" },
      { action: "SEEK_FORWARD",   label: "⏩ +20s",        param: 20 },
      { action: "PREVIOUS_VIDEO", label: "⏮ Previous" },
      { action: "NEXT_VIDEO",     label: "⏭ Next" },
      { action: "SET_SPEED",      label: "1.5x Speed",     param: 1.5 },
      { action: "SET_SPEED",      label: "1x Speed",       param: 1.0 },
      { action: "MUTE",           label: "🔇 Mute" },
      { action: "UNMUTE",         label: "🔊 Unmute" },
      { action: "SKIP_AD",        label: "⏭ Skip Ad" },
      { action: "FULLSCREEN",     label: "⛶ Fullscreen" },
      { action: "MINI_PLAYER",    label: "🪟 Mini Player" },
      { action: "THEATER_MODE",   label: "🖥 Theater" },
      { action: "SCROLL_DOWN",    label: "⬇ Scroll Down" },
      { action: "SCROLL_UP",      label: "⬆ Scroll Up" }
    ];
  
    function injectOverlay() {
      if (document.getElementById("vaaniq-overlay")) return;
  
      const box = document.createElement("div");
      box.id = "vaaniq-overlay";
      box.innerHTML = `
        <div id="vaaniq-header">
          <span id="vaaniq-mic">🎙</span>
          <span id="vaaniq-title">Vaaniq</span>
          <span id="vaaniq-status" class="ready">ready</span>
          <span id="vaaniq-toggle">—</span>
        </div>
        <button id="vaaniq-mic-toggle">🎙 Start Listening</button>
        <div id="vaaniq-transcript"></div>
        <div id="vaaniq-buttons"></div>
      `;
      document.body.appendChild(box);
  
      box.querySelector("#vaaniq-mic-toggle").addEventListener("click", toggleMic);
  
      const btnContainer = box.querySelector("#vaaniq-buttons");
      COMMANDS.forEach((cmd) => {
        const btn = document.createElement("button");
        btn.className = "vaaniq-btn";
        btn.dataset.action = cmd.action;
        btn.textContent = cmd.label;
        btn.addEventListener("click", () => executeAction(cmd.action, cmd.param));
        btnContainer.appendChild(btn);
      });
  
      box.querySelector("#vaaniq-toggle").addEventListener("click", () => {
        box.classList.toggle("vaaniq-collapsed");
      });
  
      makeDraggable(box, box.querySelector("#vaaniq-header"));
    }
  
    function makeDraggable(box, handle) {
      let offsetX = 0, offsetY = 0, dragging = false;
      handle.addEventListener("mousedown", (e) => {
        dragging = true;
        offsetX = e.clientX - box.offsetLeft;
        offsetY = e.clientY - box.offsetTop;
        e.preventDefault();
      });
      document.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        box.style.left = e.clientX - offsetX + "px";
        box.style.top = e.clientY - offsetY + "px";
      });
      document.addEventListener("mouseup", () => (dragging = false));
    }
  
    function showTranscript(text) {
      const el = document.getElementById("vaaniq-transcript");
      if (el) el.textContent = text;
    }
    function flashMic(active) {
      const el = document.getElementById("vaaniq-mic");
      if (el) el.classList.toggle("active", active);
    }
    function flashOverlayButton(action) {
      const btn = document.querySelector(`.vaaniq-btn[data-action="${action}"]`);
      if (btn) {
        btn.classList.add("vaaniq-flash");
        setTimeout(() => btn.classList.remove("vaaniq-flash"), 300);
      }
    }
  })();