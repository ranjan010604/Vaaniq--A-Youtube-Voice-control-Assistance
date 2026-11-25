// commands/command-registry.js
// Defines window.VAANIQ_COMMANDS for content.js.
// Order matters: more specific phrases must come before generic ones.

(function () {
  function firstNumber(text, fallback) {
    const m = text.match(/(\d+(\.\d+)?)/);
    return m ? parseFloat(m[1]) : fallback;
  }

  // Everything after the trigger word becomes the parameter.
  function after(text, trigger) {
    const re = new RegExp("\\b" + trigger + "\\b\\s*(.*)$", "i");
    const m = text.match(re);
    return m ? m[1].trim() : "";
  }

  window.VAANIQ_COMMANDS = [
    // ---- Search: MUST come before PLAY so "play X" doesn't get eaten ----
    {
      id: "SEARCH",
      phrases: [/\bsearch\s+(for\s+)?(.+)/, /\bfind\s+(.+)/],
      getParameter: (t) => {
        let q = after(t, "search") || after(t, "find");
        q = q.replace(/^for\s+/i, "").trim();
        return q;
      }
    },

    // ---- Play by name: "play <title>" ----
    // Only fires when there is real text after "play".
    {
      id: "PLAY_BY_NAME",
      phrases: [/\bplay\s+(.+)/],
      getParameter: (t) => after(t, "play")
    },

    // ---- Mini player / layout ----
    {
      id: "MINI_PLAYER",
      phrases: [
        /\bmini\s*-?\s*player\b/,
        /\bminimi[sz]e\b/,
        /\bshrink\s*(the\s*)?(video|player)\b/,
        /\bsmall\s*(the\s*)?(video|player)\b/
      ]
    },
    {
      id: "THEATER_MODE",
      phrases: [/\btheat(er|re)\b/, /\bwide\s*mode\b/, /\bcinema\s*mode\b/]
    },
    {
      id: "DEFAULT_MODE",
      phrases: [/\bdefault\s*(mode|view)\b/, /\bnormal\s*(mode|size|view)\b/]
    },

    // ---- Scroll ----
    { id: "SCROLL_DOWN",  phrases: [/\bscroll\s*down\b/, /\bpage\s*down\b/, /\bgo\s*down\b/] },
    { id: "SCROLL_UP",    phrases: [/\bscroll\s*up\b/,   /\bpage\s*up\b/,   /\bgo\s*up\b/] },
    { id: "SCROLL_TOP",   phrases: [/\bscroll\s*to\s*(the\s*)?top\b/, /\bgo\s*to\s*(the\s*)?top\b/, /\bback\s*to\s*top\b/] },
    { id: "SCROLL_BOTTOM",phrases: [/\bscroll\s*to\s*(the\s*)?bottom\b/, /\bgo\s*to\s*(the\s*)?bottom\b/] },

    // ---- Seek ----
    {
      id: "SEEK_FORWARD",
      phrases: [/\bforward\b/, /\bfast\s*forward\b/, /\bskip\s*ahead\b/],
      getParameter: (t, s) => firstNumber(t, s.seekSeconds)
    },
    {
      id: "SEEK_BACKWARD",
      phrases: [/\bback(ward)?\b/, /\brewind\b/],
      getParameter: (t, s) => firstNumber(t, s.seekSeconds)
    },

    // ---- Speed ----
    {
      id: "SET_SPEED",
      phrases: [/\bspeed\b/, /\bplayback\s*rate\b/],
      getParameter: (t) => firstNumber(t, 1.0)
    },

    // ---- Ad ----
    {
      id: "SKIP_AD",
      phrases: [/\bskip\b.*\bad\b/, /\bad\b.*\bskip\b/, /\bskip\s*the\s*ad\b/]
    },

    // ---- Navigation ----
    { id: "NEXT_VIDEO",     phrases: [/\bnext\b/] },
    { id: "PREVIOUS_VIDEO", phrases: [/\bprevious\b/, /\bpervious\b/, /\bprev\b/] },

    // ---- Playback control ----
    { id: "PAUSE", phrases: [/\bpause\b/, /\bstop\b/] },

    // ---- Volume ----
    { id: "UNMUTE",      phrases: [/\bunmute\b/, /\bun-mute\b/] },
    { id: "MUTE",        phrases: [/\bmute\b/] },
    { id: "VOLUME_UP",   phrases: [/\bvolume\s*up\b/, /\blouder\b/, /\bincrease volume\b/] },
    { id: "VOLUME_DOWN", phrases: [/\bvolume\s*down\b/, /\bquieter\b/, /\bdecrease volume\b/] },

    // ---- Replay / end ----
    {
      id: "REPLAY",
      phrases: [/\breplay\b/, /\bstart\s*over\b/, /\bfrom\s*(the\s*)?(start|beginning)\b/]
    },
    {
      id: "SEEK_END",
      phrases: [/\bskip\s*to\s*(the\s*)?end\b/, /\bgo\s*to\s*(the\s*)?end\b/]
    },

    // ---- Fullscreen ----
    { id: "FULLSCREEN", phrases: [/\bfull\s*-?\s*screen\b/] },

    // ---- Toggle play (before PLAY) ----
    { id: "TOGGLE_PLAY", phrases: [/\btoggle\s*play\b/, /\bplay\s*pause\b/] },

    // ---- Play / resume (last, generic) ----
    { id: "PLAY", phrases: [/\bplay\b/, /\bresume\b/] }
  ];
})();