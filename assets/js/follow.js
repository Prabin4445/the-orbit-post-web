/* The Orbit Post follow.js — Web Push subscribe/unsubscribe for the Follow button.
   No inline scripts anywhere: config + localized strings ride on the button's
   data-* attributes (emitted by generator.py). External file, covered by
   script-src 'self'.

   Hardened 2026-10-20 after PraBin's "Follow is not working in Phone" report:
   the old flow bound tap handlers only after the service worker registered,
   so any registration hiccup left a visible button that did nothing, and a
   denied notification permission surfaced only as a vague toast pointing at
   "browser settings" (on an iPhone Home Screen app the switch lives in iOS
   Settings > Notifications). Now: handlers bind immediately, registration is
   retried lazily inside the tap, a denied permission on iOS opens a guide
   with the exact Settings path, and a subscribe failure says so honestly
   instead of claiming notifications are blocked. */
(function () {
  "use strict";

  var btns = Array.prototype.slice.call(document.querySelectorAll("[data-follow]"));
  if (!btns.length) return;

  var first = btns[0];
  function attr(n) { return first.getAttribute(n) || ""; }
  var API = attr("data-api").replace(/\/$/, "");
  var VAPID = attr("data-vapid");
  var LANG = attr("data-lang") || "en";
  var L = {
    follow: attr("data-l-follow"), following: attr("data-l-following"),
    done: attr("data-m-done"), off: attr("data-m-off"), denied: attr("data-m-denied"),
    failed: attr("data-m-failed"), unsupported: attr("data-m-unsupported"),
    iosT: attr("data-ios-t"), ios1: attr("data-ios-1"), ios2: attr("data-ios-2"),
    ios3: attr("data-ios-3"),
    dT: attr("data-d-t"), d1: attr("data-d-1"), d2: attr("data-d-2"), d3: attr("data-d-3"),
    close: attr("data-l-close")
  };
  if (!API || !VAPID) {
    /* Not configured: hide entirely — never show a dead button. */
    btns.forEach(function (b) { b.style.display = "none"; });
    var cards0 = document.querySelectorAll(".follow-card");
    Array.prototype.forEach.call(cards0, function (c) { c.style.display = "none"; });
    return;
  }

  /* ---------- tiny toast (uses the site's #toast element) ---------- */
  var toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }

  /* ---------- helpers ---------- */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
  }
  function pushSupported() {
    return !!window.isSecureContext &&
      ("serviceWorker" in navigator) &&
      ("PushManager" in window) &&
      ("Notification" in window);
  }
  function urlB64ToU8(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = window.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function keyToB64Url(key) {
    var bytes = new Uint8Array(key), s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return window.btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function setState(on) {
    btns.forEach(function (b) {
      b.classList.toggle("on", !!on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var label = b.querySelector(".follow-label");
      if (label) label.textContent = on ? L.following : L.follow;
    });
  }

  /* ---------- guide overlay (iOS install steps / iOS denied steps) ---------- */
  function showGuide(title, steps) {
    var ov = document.getElementById("followGuide");
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "followGuide";
      ov.className = "follow-guide";
      var box = document.createElement("div");
      box.className = "follow-guide-box";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      var h = document.createElement("h2"); h.className = "follow-guide-title";
      box.appendChild(h);
      var ol = document.createElement("ol"); ol.className = "follow-guide-steps";
      box.appendChild(ol);
      var c = document.createElement("button");
      c.className = "follow-guide-close"; c.textContent = L.close || "Close";
      box.appendChild(c);
      ov.appendChild(box);
      ov.addEventListener("click", function (e) {
        if (e.target === ov || e.target === c) ov.classList.remove("open");
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") ov.classList.remove("open");
      });
      document.body.appendChild(ov);
    }
    ov.querySelector(".follow-guide-title").textContent = title;
    var ol = ov.querySelector(".follow-guide-steps");
    ol.innerHTML = "";
    steps.forEach(function (t) {
      var li = document.createElement("li"); li.textContent = t; ol.appendChild(li);
    });
    ov.classList.add("open");
  }
  function showIOSGuide() { showGuide(L.iosT, [L.ios1, L.ios2, L.ios3]); }
  function deniedHelp() {
    /* On iPhone the permission switch for a Home Screen app lives in iOS
       Settings, not in any browser menu: show the exact path. Everywhere
       else the toast wording (browser settings) is the right place. */
    if (isIOS()) showGuide(L.dT, [L.d1, L.d2, L.d3]);
    else toast(L.denied);
  }

  /* ---------- service worker (lazy, retried inside the tap) ---------- */
  var reg = null, regPromise = null, sub = null, busy = false;
  function ensureReg() {
    if (reg) return Promise.resolve(reg);
    if (!("serviceWorker" in navigator)) return Promise.reject(new Error("no sw"));
    if (!regPromise) {
      regPromise = navigator.serviceWorker.register("/sw.js").then(function (r) {
        reg = r;
        return r;
      }).catch(function (e) {
        regPromise = null; /* a later tap may retry */
        throw e;
      });
    }
    return regPromise;
  }

  /* ---------- subscribe / unsubscribe ---------- */
  function doSubscribe() {
    busy = true;
    /* Ask for permission FIRST, synchronously from the tap: iOS drops the
       request if it is issued after other async work. */
    var permP;
    try {
      permP = (Notification.permission === "default")
        ? Notification.requestPermission()
        : Promise.resolve(Notification.permission);
    } catch (e) {
      permP = Promise.resolve("denied");
    }
    permP.then(function (perm) {
      if (perm === "denied") { busy = false; deniedHelp(); return null; }
      if (perm !== "granted") { busy = false; toast(L.failed); return null; }
      return ensureReg().then(function (r) {
        return r.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToU8(VAPID)
        });
      }).then(function (s) {
        sub = s;
        var p256dh = keyToB64Url(s.getKey("p256dh"));
        var auth = keyToB64Url(s.getKey("auth"));
        return fetch(API + "/v1/orbitpush/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: s.endpoint, keys: { p256dh: p256dh, auth: auth },
            topics: [], lang: LANG
          })
        }).then(function (r) {
          if (!r.ok) throw new Error("subscribe rejected: " + r.status);
          busy = false;
          setState(true);
          toast(L.done);
        });
      });
    }).catch(function () {
      busy = false;
      toast(L.failed);
    });
  }

  function doUnsubscribe() {
    var s = sub;
    sub = null;
    setState(false);
    if (!s) { toast(L.off); return; }
    fetch(API + "/v1/orbitpush/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: s.endpoint })
    }).catch(function () {}).then(function () {
      return s.unsubscribe().catch(function () {});
    }).then(function () { toast(L.off); });
  }

  function onTap() {
    if (busy) return;
    if (sub) { doUnsubscribe(); return; }
    if (isIOS() && !isStandalone()) { showIOSGuide(); return; }
    if (!pushSupported()) { toast(L.unsupported); return; }
    if (Notification.permission === "denied") { deniedHelp(); return; }
    doSubscribe();
  }

  /* ---------- boot: bind taps NOW, sync state in the background ---------- */
  btns.forEach(function (b) { b.addEventListener("click", onTap); });
  if (pushSupported() && !(isIOS() && !isStandalone())) {
    ensureReg().then(function (r) {
      return r.pushManager ? r.pushManager.getSubscription() : null;
    }).then(function (s) {
      sub = s || null;
      setState(!!sub);
    }).catch(function () {
      /* Registration failed (private mode, blocked SW): the button stays
         live; a tap retries and reports honestly. Never hide it. */
    });
  }
})();
