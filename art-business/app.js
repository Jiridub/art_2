/* Art & Business RSVP
   - Validates inputs
   - Requires at least one checkbox: reserveSeat OR holdPlusOne
   - Honeypot anti-spam (company)
   - Writes to Google Sheets via Apps Script Web App (BEACON SAFE)
   - Shows "Rezervace přijata" modal
*/

(function () {
  // =========================================================
  // DOM
  // =========================================================
  const form = document.getElementById("rsvpForm");
  const modal = document.getElementById("modal");
  const submitBtn = document.getElementById("submitBtn");
  const bgImage = document.getElementById("bgImage");

  // Honeypot input (exists in HTML)
  const companyInput = document.querySelector('input[name="company"]');

  // =========================================================
  // Event data (from HTML)
  // =========================================================
  const eventDateText = document.getElementById("eventDateText");
  const eventDateTitle = document.getElementById("eventDateTitle");
  const eventDateMeta = document.getElementById("eventDateMeta");
  const eventCodeInput = document.getElementById("eventCode");

  const EVENT_DATE = (eventDateMeta?.textContent || "XX/XX").trim();
  const EVENT_CODE = (eventCodeInput?.value || "AB_XX-XX").trim();

  if (eventDateText) eventDateText.textContent = EVENT_DATE;
  if (eventDateTitle) eventDateTitle.textContent = EVENT_DATE;

  // =========================================================
  // Background image + subtle motion
  // =========================================================
  const bgPath = window.__AB_BG__ || "/images/IMG_2033.jpeg";
  if (bgImage) {
    bgImage.style.backgroundImage = `url("${bgPath}")`;

    let lastY = 0;
    function onScroll() {
      const y = window.scrollY || 0;
      if (Math.abs(y - lastY) < 1) return;
      lastY = y;
      const t = Math.min(26, y * 0.08);
      bgImage.style.transform = `scale(1.06) translate3d(0, ${t}px, 0)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // =========================================================
  // Validation
  // =========================================================
  const fields = {
    firstName: document.getElementById("firstName"),
    lastName: document.getElementById("lastName"),
    email: document.getElementById("email"),
    gdpr: document.getElementById("gdpr"),
    reserveSeat: document.getElementById("reserveSeat"),
    holdPlusOne: document.getElementById("holdPlusOne"),
  };

  const hints = {
    firstName: document.getElementById("firstNameHint"),
    lastName: document.getElementById("lastNameHint"),
    email: document.getElementById("emailHint"),
    gdpr: document.getElementById("gdprHint"),
    choice: document.getElementById("choiceHint"),
  };

  function setError(input, hintEl, msg) {
    if (!input) return;
    input.classList.add("is-invalid");
    if (hintEl) hintEl.textContent = msg;
  }

  function clearError(input, hintEl) {
    if (!input) return;
    input.classList.remove("is-invalid");
    if (hintEl) hintEl.textContent = "";
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
  }

  function validate() {
    let ok = true;

    const fn = fields.firstName.value.trim();
    const ln = fields.lastName.value.trim();
    const em = fields.email.value.trim();

    // Required choice: at least one checkbox
    const anyChoice = fields.reserveSeat.checked || fields.holdPlusOne.checked;
    if (!anyChoice) {
      ok = false;
      if (hints.choice) hints.choice.textContent = "Vyberte alespoň jednu možnost (rezervace / +1).";
    } else {
      if (hints.choice) hints.choice.textContent = "";
    }

    if (!fn) { ok = false; setError(fields.firstName, hints.firstName, "Vyplňte jméno."); }
    else clearError(fields.firstName, hints.firstName);

    if (!ln) { ok = false; setError(fields.lastName, hints.lastName, "Vyplňte příjmení."); }
    else clearError(fields.lastName, hints.lastName);

    if (!em) { ok = false; setError(fields.email, hints.email, "Vyplňte email."); }
    else if (!isValidEmail(em)) { ok = false; setError(fields.email, hints.email, "Email není ve správném formátu."); }
    else clearError(fields.email, hints.email);

    if (!fields.gdpr.checked) {
      ok = false;
      hints.gdpr.textContent = "Souhlas s GDPR je povinný.";
    } else {
      hints.gdpr.textContent = "";
    }

    return ok;
  }

  ["input", "change", "blur"].forEach(evt => {
    fields.firstName.addEventListener(evt, validate);
    fields.lastName.addEventListener(evt, validate);
    fields.email.addEventListener(evt, validate);
    fields.gdpr.addEventListener(evt, validate);
  });
  // checkboxy validuj hned při změně
  fields.reserveSeat.addEventListener("change", validate);
  fields.holdPlusOne.addEventListener("change", validate);

  // =========================================================
  // Modal
  // =========================================================
  function openModal() {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  // =========================================================
  // Sheets – SAFE BEACON (sendBeacon + hard Image fallback)
  // =========================================================
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbwXCCwAJW6e_ZuYMbE_FIq2wMYBDKuuPtlNTC-2iSfhzobi28794HEJQcl9j6bBJI3G/exec";
  const SECRET = "JDM_private_token";

  // držíme reference, aby Safari request nezabil
  window.__AB_BEACONS__ = window.__AB_BEACONS__ || [];

  function submitToSheetsBeacon(payload) {
    const params = new URLSearchParams({
      secret: SECRET,
      eventCode: payload.eventCode,
      eventDate: payload.eventDate,
      reserveSeat: payload.reserveSeat ? "1" : "0",
      holdPlusOne: payload.holdPlusOne ? "1" : "0",
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      gdpr: "1",
      company: payload.company || "", // honeypot (pošleme i na backend)
      t: String(Date.now())
    });

    // 1) Prefer sendBeacon (POST)
    try {
      if (navigator.sendBeacon) {
        const ok = navigator.sendBeacon(ENDPOINT, params);
        if (ok) return;
      }
    } catch (e) {}

    // 2) Fallback: Image GET beacon (udržený v paměti)
    const url = `${ENDPOINT}?${params.toString()}`;
    const img = new Image();
    window.__AB_BEACONS__.push(img);

    const cleanup = () => {
      const i = window.__AB_BEACONS__.indexOf(img);
      if (i >= 0) window.__AB_BEACONS__.splice(i, 1);
    };

    img.onload = cleanup;
    img.onerror = cleanup;
    img.src = url;
  }

  // =========================================================
  // Submit
  // =========================================================
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate()) return;

    // extra ochrana: pokud honeypot vyplněný, tvář se, že OK, ale nic neposílej
    const companyValue = (companyInput?.value || "").trim();
    if (companyValue) {
      form.reset();
      openModal();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Odesílám…";

    const payload = {
      eventCode: EVENT_CODE,
      eventDate: EVENT_DATE,
      reserveSeat: fields.reserveSeat.checked,
      holdPlusOne: fields.holdPlusOne.checked,
      firstName: fields.firstName.value.trim(),
      lastName: fields.lastName.value.trim(),
      email: fields.email.value.trim(),
      company: companyValue
    };

    submitToSheetsBeacon(payload);

    form.reset();
    openModal();

    submitBtn.disabled = false;
    submitBtn.textContent = "Odeslat";
  });
})();
