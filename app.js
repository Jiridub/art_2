// app.js
(function () {
  const form = document.getElementById("leadForm");
  if (!form) return;

  const submitBtn = document.getElementById("submitBtn");
  const statusEl = document.getElementById("status");
  const ts = document.getElementById("ts");
  const yearEl = document.getElementById("y");

  // Endpoint Apps Script Web App
  const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXCCwAJW6e_ZuYMbE_FIq2wMYBDKuuPtlNTC-2iSfhzobi28794HEJQcl9j6bBJI3G/exec";

  // Sdílené tajemství (doporučené)
  const SECRET = "JDM_secret_token";

  function setStatus(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function nowISO() {
    try { return new Date().toISOString(); } catch (e) { return ""; }
  }

  function serializeForm(fd) {
    const obj = {};
    for (const [k, v] of fd.entries()) obj[k] = String(v || "").trim();
    return obj;
  }

  function normalizePhone(p) {
    // Nechávám volné: jen ořez a sjednocení mezer.
    return String(p || "").trim().replace(/\s+/g, " ");
  }

  function validate(data) {
    if (!data.name || data.name.length < 2) return "Doplňte jméno.";
    data.phone = normalizePhone(data.phone);
    if (!data.phone || data.phone.length < 6) return "Doplňte telefon.";

    // NOVĚ: podle indexu je to 'intent'
    if (!data.intent) return "Vyberte typ nákupu (soukromě / do firmy / do struktury).";

    // Budget nechávám volitelný (někdo nechce sdělit). Pokud chceš povinné, odkomentuj:
    // if (!data.budget) return "Vyberte rozpočet.";

    return "";
  }

  // držíme reference, aby Safari request nezabil (Image beacon fallback)
  window.__JDM_BEACONS__ = window.__JDM_BEACONS__ || [];

  function toQueryString(obj) {
    // robustnější než ruční encode (řeší diakritiku + edge-cases)
    const params = new URLSearchParams();
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      params.set(k, String(obj[k] ?? ""));
    }
    // anti-cache + jednoznačnost requestu
    params.set("t", String(Date.now()));
    return params.toString();
  }

  function beaconSend(url, payload) {
    // 1) Prefer sendBeacon (POST) — nejspolehlivější při opuštění stránky
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], {
          type: "application/x-www-form-urlencoded;charset=UTF-8"
        });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return Promise.resolve(true);
      }
    } catch (e) { /* ignore */ }

    // 2) Fallback: fetch keepalive (POST)
    try {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload,
        keepalive: true,
        mode: "no-cors"
      }).then(() => true).catch(() => false);
    } catch (e) { /* ignore */ }

    // 3) Fallback: Image ping GET (držet referenci kvůli Safari)
    return new Promise((resolve) => {
      try {
        const sep = url.includes("?") ? "&" : "?";
        const img = new Image();
        window.__JDM_BEACONS__.push(img);

        const cleanup = () => {
          const i = window.__JDM_BEACONS__.indexOf(img);
          if (i >= 0) window.__JDM_BEACONS__.splice(i, 1);
        };

        img.onload = () => { cleanup(); resolve(true); };
        img.onerror = () => { cleanup(); resolve(false); };
        img.src = url + sep + payload;
      } catch (e) {
        resolve(false);
      }
    });
  }

  function disableForm(disabled) {
    if (submitBtn) submitBtn.disabled = !!disabled;
    const els = form.querySelectorAll("input, textarea, select, button");
    for (let i = 0; i < els.length; i++) els[i].disabled = !!disabled;
  }

  // init
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  if (ts) ts.value = nowISO();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    if (ts) ts.value = nowISO();

    const fd = new FormData(form);
    const data = serializeForm(fd);

    // runtime metadata
    data.url = window.location.href;
    data.referrer = document.referrer || "";
    data.ua = navigator.userAgent || "";
    data.secret = SECRET;

    const err = validate(data);
    if (err) {
      setStatus(err, "err");
      return;
    }

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("doplnit_") === 0) {
      setStatus("Chybí Apps Script URL. Doplňte doplnit_APPS_SCRIPT_WEBAPP_URL v app.js.", "err");
      return;
    }

    disableForm(true);
    setStatus("Odesílám…", "");

    const payload = toQueryString(data);
    const ok = await beaconSend(APPS_SCRIPT_URL, payload);

    if (ok) {
      setStatus("Hotovo. Ozvu se a domluvíme termín.", "ok");
      form.reset();
      if (ts) ts.value = nowISO();
    } else {
      setStatus("Nepodařilo se odeslat. Zkuste to prosím znovu.", "err");
    }

    disableForm(false);
  });
})();
// --- Parallax artwork layer across bricks (safe, requestAnimationFrame) ---
(function () {
  const prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  let ticking = false;

  function update() {
    ticking = false;
    const y = window.scrollY || 0;

    // negative -> image moves slower than content (premium parallax feel)
    const parallax = Math.round(y * -0.12);

    document.documentElement.style.setProperty("--art-y", parallax + "px");
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  update();
})();
