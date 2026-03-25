const PRIMEWEB_DB_NAME = "primeweb_highend_db";
const PRIMEWEB_STORE = "leads";
const PRIMEWEB_ADMIN_HASH = "d9a9162db32049c8402a2be70ef764796213dd6ff6880a758d6495450d603a53";
const PRIMEWEB_ADMIN_SESSION = "primeweb_admin_session";
const PRIMEWEB_COOKIE_CONSENT = "primeweb_cookie_consent";

const PRIMEWEB_STATUS_ORDER = [
  "Offen",
  "Kontaktiert",
  "Im Gespräch",
  "Abgeschlossen",
  "Abgelehnt"
];

const PRIMEWEB_DEFAULT_LEAD = {
  firma: "",
  ort: "",
  branche: "",
  website: "",
  problem: "",
  paket: "Beratung",
  preis: 0,
  tel: "",
  email: "",
  contacts: [],
  contactNames: "",
  websiteScore: 0,
  researchStatus: "",
  needsWebsite: false,
  needsRedesign: false,
  contactDelta: 0,
  pagesScanned: 0,
  cityQuery: "",
  sourceUrl: "",
  lastResearchAt: "",
  signals: [],
  prio: "HOCH",
  status: "Offen",
  notiz: "",
  source: "Website",
  createdAt: "",
  updatedAt: "",
  history: []
};

function primewebEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primewebFormatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function primewebNormalizeLead(lead) {
  const normalized = { ...PRIMEWEB_DEFAULT_LEAD, ...lead };
  normalized.id = lead.id || Date.now();
  normalized.preis = Number(normalized.preis) || 0;
  normalized.websiteScore = Math.max(0, Math.min(100, Number(normalized.websiteScore) || 0));
  normalized.prio = ["HOCH", "MITTEL", "NIEDRIG"].includes(normalized.prio)
    ? normalized.prio
    : "MITTEL";
  normalized.status = PRIMEWEB_STATUS_ORDER.includes(normalized.status)
    ? normalized.status
    : "Offen";
  normalized.source = normalized.source || "Website";
  normalized.contacts = Array.isArray(normalized.contacts) ? normalized.contacts : [];
  normalized.contactDelta = Math.max(0, Number(normalized.contactDelta) || 0);
  normalized.pagesScanned = Math.max(0, Number(normalized.pagesScanned) || 0);
  normalized.signals = Array.isArray(normalized.signals) ? normalized.signals : [];
  normalized.needsWebsite = Boolean(normalized.needsWebsite);
  normalized.needsRedesign = Boolean(normalized.needsRedesign);
  normalized.createdAt = normalized.createdAt || new Date().toISOString();
  normalized.updatedAt = normalized.updatedAt || normalized.createdAt;
  normalized.history = Array.isArray(normalized.history) ? normalized.history : [];
  return normalized;
}

function primewebOpenDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PRIMEWEB_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRIMEWEB_STORE)) {
        const store = db.createObjectStore(PRIMEWEB_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("status", "status");
        store.createIndex("source", "source");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function primewebReadAllLeads() {
  const db = await primewebOpenDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRIMEWEB_STORE, "readonly");
    const store = transaction.objectStore(PRIMEWEB_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const rows = Array.isArray(request.result) ? request.result : [];
      resolve(rows.map(primewebNormalizeLead));
    };
    request.onerror = () => reject(request.error);
  });
}

async function primewebSaveLead(lead) {
  const db = await primewebOpenDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRIMEWEB_STORE, "readwrite");
    const store = transaction.objectStore(PRIMEWEB_STORE);
    store.put(primewebNormalizeLead(lead));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function primewebDeleteLead(id) {
  const db = await primewebOpenDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRIMEWEB_STORE, "readwrite");
    const store = transaction.objectStore(PRIMEWEB_STORE);
    store.delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function primewebReplaceAllLeads(leads) {
  const db = await primewebOpenDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PRIMEWEB_STORE, "readwrite");
    const store = transaction.objectStore(PRIMEWEB_STORE);
    store.clear();
    leads.map(primewebNormalizeLead).forEach((lead) => {
      store.put(lead);
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function primewebLeadMergeKey(lead) {
  return [
    String(lead.firma || "").trim().toLowerCase(),
    String(lead.website || "").trim().toLowerCase(),
    String(lead.sourceUrl || "").trim().toLowerCase(),
    String(lead.ort || "").trim().toLowerCase()
  ].join("|");
}

async function primewebMergeLeads(leads) {
  const existing = await primewebReadAllLeads();
  const merged = new Map();

  existing.forEach((lead) => {
    merged.set(primewebLeadMergeKey(lead), primewebNormalizeLead(lead));
  });

  leads.map(primewebNormalizeLead).forEach((lead) => {
    const key = primewebLeadMergeKey(lead);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, lead);
      return;
    }

    merged.set(key, primewebNormalizeLead({
      ...current,
      ...lead,
      id: current.id || lead.id,
      createdAt: current.createdAt || lead.createdAt,
      updatedAt: lead.updatedAt || current.updatedAt,
      history: [...(lead.history || []), ...(current.history || [])].slice(0, 20)
    }));
  });

  return primewebReplaceAllLeads(Array.from(merged.values()));
}

function primewebExportJson(leads, filename) {
  const blob = new Blob([JSON.stringify(leads, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function primewebHash(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function primewebIsAuthenticated() {
  return sessionStorage.getItem(PRIMEWEB_ADMIN_SESSION) === "1";
}

function primewebSetAuthenticated(state) {
  if (state) {
    sessionStorage.setItem(PRIMEWEB_ADMIN_SESSION, "1");
  } else {
    sessionStorage.removeItem(PRIMEWEB_ADMIN_SESSION);
  }
}

function primewebStatusClass(status) {
  if (status === "Offen") return "pill-status-open";
  if (status === "Kontaktiert") return "pill-status-contact";
  if (status === "Im Gespräch") return "pill-status-talk";
  if (status === "Abgeschlossen") return "pill-status-win";
  return "pill-status-loss";
}

function primewebPriorityClass(prio) {
  if (prio === "HOCH") return "pill-high";
  if (prio === "MITTEL") return "pill-mid";
  return "pill-low";
}

function primewebResearchBadge(lead) {
  if (lead.needsWebsite) return "Keine Website";
  if (lead.needsRedesign) return "Redesign sinnvoll";
  if (lead.websiteScore <= 0) return "Offen";
  return "Score " + lead.websiteScore;
}

function primewebToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = "block";
  toast.style.background = isError ? "#b94242" : "#102033";
  clearTimeout(primewebToast.timer);
  primewebToast.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 2400);
}

async function primewebHandleContactForm(form) {
  const successBox = document.getElementById("formSuccess");
  const errorBox = document.getElementById("formError");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    successBox.style.display = "none";
    errorBox.style.display = "none";

    try {
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim();
      const company = String(formData.get("company") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const phone = String(formData.get("phone") || "").trim();
      const packageName = String(formData.get("projectType") || "").trim();
      const website = String(formData.get("website") || "").trim();
      const message = String(formData.get("message") || "").trim();
      const companyOrName = company || name || "Neue Website-Anfrage";
      const now = new Date().toISOString();

      await primewebSaveLead({
        id: Date.now(),
        firma: companyOrName,
        ort: "",
        branche: "",
        website,
        problem: message || "Neue Anfrage über die Website",
        paket: packageName || "Beratung",
        preis: 0,
        tel: phone,
        email,
        prio: "HOCH",
        status: "Offen",
        notiz: "Website-Anfrage von " + (name || companyOrName),
        source: "Website",
        createdAt: now,
        updatedAt: now,
        history: [{ date: now, text: "Lead über Website-Formular erfasst" }]
      });

      // Email-Benachrichtigung via FormSubmit.co
      try {
        await fetch("https://formsubmit.co/ajax/marc@primeweb-design.de", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            _subject: "Neue Anfrage: " + companyOrName + " – " + (packageName || "Allgemein"),
            Name: name,
            Unternehmen: company,
            "E-Mail": email,
            Telefon: phone,
            Paket: packageName,
            Website: website,
            Nachricht: message,
            _template: "table"
          })
        });
      } catch (_) { /* Email-Fehler nicht kritisch */ }

      form.reset();
      successBox.style.display = "block";
    } catch (error) {
      errorBox.style.display = "block";
    }
  });
}

function primewebWireFaqToggles() {
  document.querySelectorAll("[data-rotate-icon]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const icon = details.querySelector("[data-faq-icon]");
      if (!icon) return;
      icon.textContent = details.open ? "×" : "+";
    });
  });
}

function primewebInitCookieBanner() {
  const banner = document.getElementById("cookieBanner");
  const accept = document.getElementById("cookieAccept");
  const decline = document.getElementById("cookieDecline");

  if (!banner || !accept || !decline) return;
  if (localStorage.getItem(PRIMEWEB_COOKIE_CONSENT)) {
    banner.hidden = true;
    banner.style.display = "none";
    return;
  }

  setTimeout(() => {
    banner.hidden = false;
    banner.style.display = "";
    banner.classList.add("is-visible");
  }, 700);

  function setConsent(value) {
    localStorage.setItem(PRIMEWEB_COOKIE_CONSENT, value);
    banner.classList.add("is-leaving");
    setTimeout(() => {
      banner.hidden = true;
      banner.style.display = "none";
      banner.classList.remove("is-visible", "is-leaving");
    }, 340);
  }

  accept.addEventListener("click", () => setConsent("accepted"));
  decline.addEventListener("click", () => setConsent("necessary"));
}

function primewebInitHeroStageMotion() {
  const stage = document.querySelector(".hero-stage");
  if (!stage || window.matchMedia("(max-width: 760px)").matches) return;

  const current = {
    rotateX: 0,
    rotateY: 0,
    shiftX: 0,
    shiftY: 0
  };
  const target = {
    rotateX: 0,
    rotateY: 0,
    shiftX: 0,
    shiftY: 0
  };
  let rafId = 0;

  function applyStage() {
    stage.style.setProperty("--hero-rotate-x", current.rotateX.toFixed(2) + "deg");
    stage.style.setProperty("--hero-rotate-y", current.rotateY.toFixed(2) + "deg");
    stage.style.setProperty("--hero-shift-x", current.shiftX.toFixed(2) + "px");
    stage.style.setProperty("--hero-shift-y", current.shiftY.toFixed(2) + "px");
  }

  function animateStage() {
    const ease = 0.11;
    current.rotateX += (target.rotateX - current.rotateX) * ease;
    current.rotateY += (target.rotateY - current.rotateY) * ease;
    current.shiftX += (target.shiftX - current.shiftX) * ease;
    current.shiftY += (target.shiftY - current.shiftY) * ease;
    applyStage();

    const settled =
      Math.abs(target.rotateX - current.rotateX) < 0.01 &&
      Math.abs(target.rotateY - current.rotateY) < 0.01 &&
      Math.abs(target.shiftX - current.shiftX) < 0.01 &&
      Math.abs(target.shiftY - current.shiftY) < 0.01;

    if (!settled) {
      rafId = requestAnimationFrame(animateStage);
    } else {
      rafId = 0;
    }
  }

  function queueAnimation() {
    if (!rafId) {
      rafId = requestAnimationFrame(animateStage);
    }
  }

  function resetStage() {
    target.rotateX = 0;
    target.rotateY = 0;
    target.shiftX = 0;
    target.shiftY = 0;
    queueAnimation();
  }

  stage.addEventListener("mousemove", (event) => {
    const rect = stage.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    target.rotateY = (px - 0.5) * 5.5;
    target.rotateX = (0.5 - py) * 4.5;
    target.shiftX = (px - 0.5) * 12;
    target.shiftY = (py - 0.5) * 9;
    queueAnimation();
  });

  stage.addEventListener("mouseleave", resetStage);
  applyStage();
}

window.primeweb = {
  primewebReadAllLeads,
  primewebSaveLead,
  primewebDeleteLead,
  primewebReplaceAllLeads,
  primewebMergeLeads,
  primewebExportJson,
  primewebHash,
  primewebIsAuthenticated,
  primewebSetAuthenticated,
  primewebToast,
  primewebEscape,
  primewebFormatDate,
  primewebNormalizeLead,
  primewebStatusClass,
  primewebPriorityClass,
  primewebResearchBadge,
  primewebHandleContactForm,
  primewebWireFaqToggles,
  primewebInitCookieBanner,
  primewebInitHeroStageMotion,
  PRIMEWEB_ADMIN_HASH,
  PRIMEWEB_STATUS_ORDER
};

/* ── Reveal Animation ── */
(function () {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );

  function initReveal() {
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }
})();
