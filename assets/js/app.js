/* The Orbit Post app.js — theme toggle, drawer nav, share, relative timestamps, search. */
(function () {
  "use strict";

  /* ---------- Edition memory (language persistence) ---------- */
  var ED_KEY = "op-edition";
  var ED_LANGS = ["en", "es", "ne", "hi", "fr"];
  function storedEdition() {
    try { return localStorage.getItem(ED_KEY); } catch (e) { return null; }
  }
  function storeEdition(l) {
    try { localStorage.setItem(ED_KEY, l); } catch (e) {}
  }
  // Explicit choice or reset in the URL wins: ?edition=fr stores French,
  // ?edition=reset forgets the stored edition entirely.
  try {
    var ep = new URLSearchParams(location.search).get("edition");
    if (ep === "reset") {
      try { localStorage.removeItem(ED_KEY); } catch (e) {}
    } else if (ep && ED_LANGS.indexOf(ep) !== -1) {
      storeEdition(ep);
    }
  } catch (e) {}
  // Choosing a language in the switcher, the article language pills, or
  // the footer Editions list (all hreflang anchors) stores the choice
  // before the browser navigates.
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[hreflang]");
    if (!a) return;
    var l = a.getAttribute("hreflang");
    if (ED_LANGS.indexOf(l) !== -1) storeEdition(l);
  });
  // On load: if the reader's stored edition differs from this page's
  // language AND the page's switcher offers that edition (this exact
  // page exists in it), go there. After the hop the stored edition
  // equals the page language, so it always settles — no loop. Choosing
  // EN stores "en" and stops the hops. No stored choice: no hop.
  (function () {
    var want = storedEdition();
    if (!want) return;
    var cur = document.documentElement.getAttribute("lang") || "en";
    if (want === cur) return;
    var a = document.querySelector('.lang-switch a[hreflang="' + want + '"]');
    if (a && a.getAttribute("href") &&
        a.getAttribute("href") !== location.pathname) {
      location.replace(a.getAttribute("href"));
    }
  })();

  /* ---------- Theme ---------- */
  var KEY = "the-orbit-post-theme";
  function currentTheme() {
    // The live data-theme attribute (set pre-paint by the inline head
    // script from storage, then system preference) is the single source
    // of truth. Reading storage alone desynced the toggle whenever the
    // theme came from prefers-color-scheme and nothing was stored yet:
    // the first tap then re-applied the theme already on screen and
    // looked dead (reported on Safari, 2026-10-16).
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") return attr;
    try {
      var t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") return t;
    } catch (e) {}
    return "dark";
  }
  function syncThemeUI(t) {
    var btns = document.querySelectorAll("[data-theme-toggle]");
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", t === "light" ? "true" : "false");
      var label = b.querySelector(".theme-label");
      if (label) label.textContent = t === "light" ? "\u2600" : "\u263D";
      b.setAttribute("aria-label", t === "light" ? "Switch to dark mode" : "Switch to light mode");
    });
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch (e) {}
    syncThemeUI(t);
  }
  // On load only sync the button to the theme the inline script chose;
  // never override it from a second, disagreeing read.
  syncThemeUI(currentTheme());
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-theme-toggle]");
    // Buttons already bound directly by the inline head script carry
    // data-theme-bound; skip them here so one tap flips exactly once.
    if (b && !b.hasAttribute("data-theme-bound")) {
      applyTheme(currentTheme() === "light" ? "dark" : "light");
    }
  });

  /* ---------- Drawer ---------- */
  var drawer = document.getElementById("drawer");
  var scrim = document.getElementById("drawerScrim");
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("open"); scrim.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("open"); scrim.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-drawer-open]")) openDrawer();
    if (e.target.closest("[data-drawer-close]") || e.target === scrim) closeDrawer();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- Share ---------- */
  document.addEventListener("click", function (e) {
    var copy = e.target.closest("[data-copy-link]");
    if (copy) {
      var url = copy.getAttribute("data-copy-link");
      var done = function () { toast(copy.getAttribute("data-copied-msg") || "Link copied"); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
      } else { fallbackCopy(url); done(); }
    }
    var native = e.target.closest("[data-native-share]");
    if (native && navigator.share) {
      navigator.share({
        title: native.getAttribute("data-share-title") || document.title,
        text: native.getAttribute("data-share-text") || "",
        url: native.getAttribute("data-share-url") || location.href
      }).catch(function () {});
    } else if (native) {
      toast("Sharing not supported on this device");
    }
    /* Facebook: iOS hands facebook.com links to the FB app, which drops share
       dialogs and lands on the feed. Route through the native share sheet
       instead — it opens the FB app's real composer, already logged in. */
    var fb = e.target.closest("[data-fb-share]");
    if (fb && navigator.share) {
      e.preventDefault();
      navigator.share({
        title: fb.getAttribute("data-share-title") || document.title,
        url: fb.getAttribute("data-share-url") || location.href
      }).catch(function () {});
    }
  });
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  /* ---------- Relative timestamps ---------- */
  function relTime(iso) {
    var d = new Date(iso), now = new Date();
    var s = Math.floor((now - d) / 1000);
    if (s < 0) s = 0;
    if (s < 60) return "just now";
    var m = Math.floor(s / 60);
    if (m < 60) return m + " min ago";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " h ago";
    var days = Math.floor(h / 24);
    if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
    return null; // keep absolute date for older items
  }
  document.querySelectorAll("time[data-rel]").forEach(function (el) {
    var r = relTime(el.getAttribute("datetime"));
    // Show freshness ALONGSIDE the date, never instead of it:
    // "October 14, 2026 · 2 h ago".
    if (r && el.textContent.indexOf(r) === -1) {
      el.textContent = el.textContent + " · " + r;
    }
  });

  /* ---------- Search page ---------- */
  var q = document.getElementById("searchInput");
  var results = document.getElementById("searchResults");
  if (q && results) {
    // Honor ?q= (the site's declared SearchAction target). Set via .value —
    // never parsed as HTML — and all rendering goes through esc() below.
    try {
      var pre = new URLSearchParams(location.search).get("q");
      if (pre) q.value = pre;
    } catch (e) {}
    var indexUrl = results.getAttribute("data-index") || "../search.json";
    var data = null, loaded = false;
    // Tokenized ranking matcher (same weights as the generator's
    // build-time trend resolution): split the query into significant
    // tokens, score title hits 3, tag hits 2, dek hits 1, and show the
    // best partial overlaps instead of an exact-phrase dead end.
    var STOPW = {the:1, a:1, an:1, and:1, or:1, of:1, to:1, in:1, on:1, for:1, with:1, as:1, at:1, by:1, from:1, is:1, are:1, was:1, were:1, be:1, been:1, it:1, its:1, this:1, that:1, after:1, before:1, over:1, under:1, about:1, into:1, amid:1, says:1, said:1, say:1, story:1, stories:1, news:1, update:1, updates:1, latest:1, live:1, watch:1, video:1, report:1, reports:1, "new":1, first:1, top:1, will:1, would:1, could:1, should:1, than:1, then:1, them:1, they:1, their:1, he:1, she:1, his:1, her:1, we:1, our:1, you:1, your:1, not:1, no:1, do:1, does:1, did:1, have:1, has:1, had:1, can:1, may:1, might:1, per:1, via:1, framed:1, framing:1};
    var LATEST_LABEL = {en: "Latest headlines", es: "Titulares recientes", ne: "\u0924\u093e\u091c\u093e \u0938\u092e\u093e\u091a\u093e\u0930", hi: "\u0924\u093e\u091c\u093c\u093e \u0916\u093c\u092c\u0930\u0947\u0902", fr: "Derniers titres"};
    function qtoks(s) {
      return String(s || "").toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u).filter(function (w) {
        return w.length >= 2 && !STOPW[w];
      });
    }
    function tokSet(s) { var o = {}; qtoks(s).forEach(function (t) { o[t] = 1; }); return o; }
    function scoreEntry(a, toks) {
      var tt = tokSet(a.title), tg = tokSet((a.tags || []).join(" ")), dk = tokSet(a.dek), s = 0;
      toks.forEach(function (t) { if (tt[t]) s += 3; if (tg[t]) s += 2; if (dk[t]) s += 1; });
      return s;
    }
    function itemHtml(a) {
      return '<li><h3><a href="' + esc(a.url) + '">' + esc(a.title) + "</a></h3>" +
        '<p class="dek">' + esc(a.dek) + "</p>" +
        '<p class="search-meta">' + esc(a.category) + " \u00b7 " + esc(fmtDate(a.published)) + "</p></li>";
    }
    function render() {
      var needle = q.value.trim().toLowerCase();
      if (!needle) { results.innerHTML = ""; return; }
      if (!loaded) return;
      var pageLang = document.documentElement.getAttribute("lang") || "en";
      var inLang = data.filter(function (a) { return !a.lang || a.lang === pageLang; });
      var toks = qtoks(needle), hits;
      if (toks.length) {
        hits = inLang.map(function (a) { return { a: a, s: scoreEntry(a, toks) }; })
          .filter(function (x) { return x.s > 0; })
          .sort(function (x, y) { return y.s - x.s; })
          .slice(0, 30).map(function (x) { return x.a; });
      } else {
        hits = inLang.filter(function (a) {
          return (a.title + " " + a.dek + " " + a.category + " " + (a.tags || []).join(" "))
            .toLowerCase().indexOf(needle) !== -1;
        }).slice(0, 30);
      }
      if (!hits.length) {
        // Never a dead end: fall back to this edition's latest stories.
        var latest = inLang.slice(0, 8);
        if (latest.length) {
          results.innerHTML = '<li class="empty-note">' +
            esc(LATEST_LABEL[pageLang] || LATEST_LABEL.en) + "</li>" +
            latest.map(itemHtml).join("");
          return;
        }
        results.innerHTML = '<li class="empty-note">' + esc(results.getAttribute("data-none") || "No results.") + "</li>";
        return;
      }
      results.innerHTML = hits.map(itemHtml).join("");
    }
    fetch(indexUrl, { credentials: "same-origin" })
      .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
      .then(function (j) { data = j; loaded = true; render(); })
      .catch(function () {
        results.innerHTML = '<li class="empty-note">' +
          esc(results.getAttribute("data-fail") || "Search index could not be loaded.") + "</li>";
      });
    var deb = null;
    q.addEventListener("input", function () { clearTimeout(deb); deb = setTimeout(render, 180); });
    var form = document.getElementById("searchForm");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return iso; }
  }
})();

/* ---------- Reveal on scroll (premium editorial motion) ---------- */
(function () {
  "use strict";
  // Reduced-motion users and no-IntersectionObserver browsers keep everything
  // fully visible: .reveal is only added when animation is appropriate.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;
  var els = Array.prototype.slice.call(document.querySelectorAll(
    ".story-card, .section-head, .side-module, .hero > *, .rail-item, .latest-list li"
  ));
  if (!els.length) return;
  function inView(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > 0 && r.top < vh;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -4% 0px" });
  // Reveal sweep: synchronous in-viewport check that never depends on the
  // observer's timing. Fixes the mid-page-refresh race where the observer
  // records stale positions during scroll restoration and leaves in-viewport
  // content stuck invisible.
  function sweep() {
    els.forEach(function (el) {
      if (!el.classList.contains("in") && inView(el)) {
        el.classList.add("reveal");
        // Force a reflow so the transition runs from the hidden state.
        void el.offsetWidth;
        el.classList.add("in");
        io.unobserve(el);
      }
    });
    // Anything still not revealed gets the hidden state + observer for later.
    els.forEach(function (el) {
      if (!el.classList.contains("reveal") && !el.classList.contains("in")) {
        el.classList.add("reveal");
        io.observe(el);
      }
    });
  }
  sweep();
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; sweep(); });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("load", sweep);
  setTimeout(sweep, 1500);

  /* ---------- Video autoplay on scroll + mute toggle ---------- */
  (function () {
    var wraps = Array.prototype.slice.call(document.querySelectorAll(".video-wrap"));
    if (!wraps.length || !("IntersectionObserver" in window)) return;
    var reducedMotion = false;
    try { reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

    function ytCmd(iframe, func) {
      try {
        var w = iframe && iframe.contentWindow;
        if (w) w.postMessage(JSON.stringify({ event: "command", func: func, args: [] }), "*");
      } catch (e) { /* iframe blocked or gone: stay silent */ }
    }

    var current = null; // wrap currently playing

    function pauseWrap(wrap) {
      if (!wrap || !wrap._played) return;
      ytCmd(wrap._iframe, "pauseVideo");
      wrap.classList.remove("is-playing");
      if (current === wrap) current = null;
    }

    wraps.forEach(function (wrap) {
      var iframe = wrap.querySelector("iframe");
      var btn = wrap.querySelector(".vid-mute");
      if (!iframe) return;
      wrap._iframe = iframe;
      wrap._played = false;
      if (btn) {
        btn.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (!wrap._played) return; // nothing to unmute yet
          if (wrap.classList.contains("unmuted")) {
            ytCmd(iframe, "mute");
            wrap.classList.remove("unmuted");
            btn.setAttribute("aria-pressed", "false");
            btn.setAttribute("aria-label", "Unmute video");
          } else {
            ytCmd(iframe, "unMute");
            wrap.classList.add("unmuted");
            btn.setAttribute("aria-pressed", "true");
            btn.setAttribute("aria-label", "Mute video");
          }
        });
      }
    });

    if (reducedMotion) return; // respect reduced motion: leave click-to-play

    function startWrap(wrap) {
      var iframe = wrap._iframe;
      if (!iframe) return;
      if (!wrap._played) {
        wrap._played = true;
        var src = iframe.getAttribute("src") || "";
        if (src.indexOf("autoplay=1") === -1) {
          var sep = src.indexOf("?") === -1 ? "?" : "&";
          iframe.setAttribute("src", src + sep + "autoplay=1&mute=1");
        }
        var btn = wrap.querySelector(".vid-mute");
        if (btn) btn.hidden = false; // reveal the "tap for sound" toggle
      } else {
        ytCmd(iframe, "playVideo");
      }
      wrap.classList.add("is-playing");
      current = wrap;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var wrap = en.target;
        var visible = en.isIntersecting && en.intersectionRatio >= 0.5;
        if (visible) {
          if (current && current !== wrap) pauseWrap(current);
          startWrap(wrap);
        } else {
          pauseWrap(wrap);
        }
      });
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    wraps.forEach(function (wrap) { io.observe(wrap); });
  })();
})();

/* ---------- Pass 2 (2026-10-14): search overlay, reading progress, back to top ---------- */
(function () {
  "use strict";

  function escS(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtD(iso) {
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch (e) { return iso; }
  }

  /* ----- Search overlay: instant results from the masthead button ----- */
  var overlay = document.getElementById("searchOverlay");
  if (overlay) {
    var input = document.getElementById("overlaySearchInput");
    var results = document.getElementById("overlaySearchResults");
    var pageLang = document.documentElement.getAttribute("lang") || "en";
    var data = null, loaded = false, loading = false, lastFocus = null;
    // Same tokenized ranking matcher as the search page: title hits 3,
    // tag hits 2, dek hits 1; zero hits fall back to latest headlines.
    var STOPW2 = {the:1, a:1, an:1, and:1, or:1, of:1, to:1, in:1, on:1, for:1, with:1, as:1, at:1, by:1, from:1, is:1, are:1, was:1, were:1, be:1, been:1, it:1, its:1, this:1, that:1, after:1, before:1, over:1, under:1, about:1, into:1, amid:1, says:1, said:1, say:1, story:1, stories:1, news:1, update:1, updates:1, latest:1, live:1, watch:1, video:1, report:1, reports:1, "new":1, first:1, top:1, will:1, would:1, could:1, should:1, than:1, then:1, them:1, they:1, their:1, he:1, she:1, his:1, her:1, we:1, our:1, you:1, your:1, not:1, no:1, do:1, does:1, did:1, have:1, has:1, had:1, can:1, may:1, might:1, per:1, via:1, framed:1, framing:1};
    var LATEST_LABEL2 = {en: "Latest headlines", es: "Titulares recientes", ne: "\u0924\u093e\u091c\u093e \u0938\u092e\u093e\u091a\u093e\u0930", hi: "\u0924\u093e\u091c\u093c\u093e \u0916\u093c\u092c\u0930\u0947\u0902", fr: "Derniers titres"};
    function qtoks2(s) {
      return String(s || "").toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u).filter(function (w) {
        return w.length >= 2 && !STOPW2[w];
      });
    }
    function tokSet2(s) { var o = {}; qtoks2(s).forEach(function (t) { o[t] = 1; }); return o; }
    function scoreEntry2(a, toks) {
      var tt = tokSet2(a.title), tg = tokSet2((a.tags || []).join(" ")), dk = tokSet2(a.dek), s = 0;
      toks.forEach(function (t) { if (tt[t]) s += 3; if (tg[t]) s += 2; if (dk[t]) s += 1; });
      return s;
    }
    function itemHtml2(a) {
      return '<li><h3><a href="' + escS(a.url) + '">' + escS(a.title) + "</a></h3>" +
        '<p class="dek">' + escS(a.dek) + "</p>" +
        '<p class="search-meta">' + escS(a.category) + " \u00b7 " +
        escS(fmtD(a.published)) + "</p></li>";
    }
    function render() {
      if (!input || !results) return;
      var needle = input.value.trim().toLowerCase();
      if (!needle) { results.innerHTML = ""; return; }
      if (!loaded) return;
      var inLang = data.filter(function (a) { return !a.lang || a.lang === pageLang; });
      var toks = qtoks2(needle), hits;
      if (toks.length) {
        hits = inLang.map(function (a) { return { a: a, s: scoreEntry2(a, toks) }; })
          .filter(function (x) { return x.s > 0; })
          .sort(function (x, y) { return y.s - x.s; })
          .slice(0, 12).map(function (x) { return x.a; });
      } else {
        hits = inLang.filter(function (a) {
          return (a.title + " " + a.dek + " " + a.category + " " + (a.tags || []).join(" "))
            .toLowerCase().indexOf(needle) !== -1;
        }).slice(0, 12);
      }
      if (!hits.length) {
        var latest = inLang.slice(0, 6);
        if (latest.length) {
          results.innerHTML = '<li class="empty-note">' +
            escS(LATEST_LABEL2[pageLang] || LATEST_LABEL2.en) + "</li>" +
            latest.map(itemHtml2).join("");
          return;
        }
        results.innerHTML = '<li class="empty-note">' +
          escS(results.getAttribute("data-none") || "No results.") + "</li>";
        return;
      }
      results.innerHTML = hits.map(itemHtml2).join("");
    }
    function load() {
      if (loaded || loading || !results) return;
      loading = true;
      var indexUrl = results.getAttribute("data-index") || "/search.json";
      fetch(indexUrl, { credentials: "same-origin" })
        .then(function (r) { if (!r.ok) throw new Error("bad"); return r.json(); })
        .then(function (j) { data = j; loaded = true; loading = false; render(); })
        .catch(function () {
          loading = false;
          results.innerHTML = '<li class="empty-note">' +
            escS(results.getAttribute("data-fail") || "Search index could not be loaded.") + "</li>";
        });
    }
    function openOverlay() {
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      load();
      setTimeout(function () { if (input) input.focus(); }, 30);
    }
    function closeOverlay() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-search-open]")) openOverlay();
      if (e.target.closest("[data-search-close]") || e.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeOverlay();
    });
    var deb = null;
    if (input) input.addEventListener("input", function () {
      clearTimeout(deb); deb = setTimeout(render, 140);
    });
    var form = document.getElementById("overlaySearchForm");
    if (form) form.addEventListener("submit", function (e) { e.preventDefault(); render(); });
  }

  /* ----- Reading progress bar + back-to-top ----- */
  var bar = document.querySelector("[data-progress]");
  var toTop = document.querySelector("[data-to-top]");
  if (bar || toTop) {
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || document.documentElement.scrollTop;
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        var p = h > 0 ? Math.min(1, y / h) : 0;
        bar.style.transform = "scaleX(" + p + ")";
      }
      if (toTop) toTop.hidden = y < 600;
    }
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
    if (toTop) toTop.addEventListener("click", function () {
      var reduce = false;
      try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }
})();
