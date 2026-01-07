// app.js
(function () {
  const form = document.getElementById("leadForm");
  const submitBtn = document.getElementById("submitBtn");
  const statusEl = document.getElementById("status");
  const ts = document.getElementById("ts");
  const yearEl = document.getElementById("y");

  // Endpoint Apps Script Web App
  const APPS_SCRIPT_URL = "doplnit_APPS_SCRIPT_WEBAPP_URL";

  // Sdílené tajemství (doporučené)
  const SECRET = "doplnit_SECRET";

  function setStatus(msg, kind) {
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

  function validate(data) {
    if (!data.name || data.name.length < 2) return "Doplňte jméno.";
    if (!data.phone || data.phone.length < 6) return "Doplňte telefon.";
    if (!data.type) return "Vyberte typ zájmu.";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Zkontrolujte e-mail.";
    return "";
  }

  function toQueryString(obj) {
    const parts = [];
    const keys = Object.keys(obj);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(obj[k]));
    }
    return parts.join("&");
  }

  function beaconSend(url, payload) {
    // Prefer sendBeacon
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/x-www-form-urlencoded;charset=UTF-8" });
        const ok = navigator.sendBeacon(url, blob);
        if (ok) return Promise.resolve(true);
      }
    } catch (e) { /* ignore */ }

    // Fallback 1: fetch keepalive
    try {
      return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: payload,
        keepalive: true,
        mode: "no-cors"
      }).then(() => true).catch(() => false);
    } catch (e) { /* ignore */ }

    // Fallback 2: Image ping GET
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        const sep = url.includes("?") ? "&" : "?";
        img.src = url + sep + payload;
      } catch (e) {
        resolve(false);
      }
    });
  }

  function disableForm(disabled) {
    submitBtn.disabled = !!disabled;
    const els = form.querySelectorAll("input, textarea, select, button");
    for (let i = 0; i < els.length; i++) els[i].disabled = !!disabled;
  }

  // init
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  if (ts) ts.value = nowISO();
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    if (ts) ts.value = nowISO();

    const fd = new FormData(form);
    const data = serializeForm(fd);

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
