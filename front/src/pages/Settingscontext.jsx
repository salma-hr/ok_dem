import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

// ─── Clé localStorage ────────────────────────────────────────────
const STORAGE_KEY = "app-parametres-v1";

// ─── Valeurs par défaut ──────────────────────────────────────────
export const defaultSettings = {
  theme: "light",
  accentColor: "#0057a8",
  fontSize: "medium",
  animationsEnabled: true,
  lang: "fr",

  // Notifications email
  emailNotifications: false,
  emailRecipient: "",
  emailObject: "Alerte checklist - OK Démarrage",
  emailOnNonConformite: true,
  emailOnValidation: true,
  emailOnRejet: true,
  emailOnPlanAction: false,

  // Alertes in-app
  alerteNonConformiteAuto: true,
  alerteSonore: false,
  alertePopup: true,
  delaiRappelPlan: 3,

  // Checklist
  autoSaveChecklist: true,
  afficherImages: true,
  confirmationSoumission: true,
  checklistSessionDefault: "M",
  checklistFiltreDefaut: "ALL",   // filtre par défaut dans la liste
  checklistCompactView: false,    // vue compacte des critères
  checklistShowProgress: true,    // barre de progression pendant remplissage

  // Sécurité
  sessionTimeout: 30,
  doubleAuth: false,
};

const normalizeLang = (value) => (value === "ar" || value === "en" || value === "fr" ? value : defaultSettings.lang);

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const savedLang = normalizeLang(localStorage.getItem("app-lang"));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultSettings, ...parsed, lang: normalizeLang(parsed.lang || savedLang) };
    }
    return { ...defaultSettings, lang: savedLang };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ─── Accent colors map ───────────────────────────────────────────
const ACCENT_VARS = {
  "#0057a8": { l5:"#0057a8", l6:"#0046a0", l7:"#1a6ebf", l1:"#e6f0fa", l2:"#bcd5f0" },
  "#6366f1": { l5:"#6366f1", l6:"#4f46e5", l7:"#7c7ff7", l1:"#eef2ff", l2:"#c7d2fe" },
  "#059669": { l5:"#059669", l6:"#047857", l7:"#10b981", l1:"#ecfdf5", l2:"#a7f3d0" },
  "#dc2626": { l5:"#dc2626", l6:"#b91c1c", l7:"#ef4444", l1:"#fef2f2", l2:"#fecaca" },
  "#d97706": { l5:"#d97706", l6:"#b45309", l7:"#f59e0b", l1:"#fffbeb", l2:"#fde68a" },
  "#7c3aed": { l5:"#7c3aed", l6:"#6d28d9", l7:"#8b5cf6", l1:"#f5f3ff", l2:"#ddd6fe" },
  "#0284c7": { l5:"#0284c7", l6:"#0369a1", l7:"#38bdf8", l1:"#f0f9ff", l2:"#bae6fd" },
  "#db2777": { l5:"#db2777", l6:"#be185d", l7:"#ec4899", l1:"#fdf2f8", l2:"#fbcfe8" },
};

function applyAccentColor(color) {
  const vars = ACCENT_VARS[color] || ACCENT_VARS["#0057a8"];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
}
function applyFontSize(size) {
  const map = { small: "13px", medium: "15px", large: "17px" };
  document.documentElement.style.setProperty("--font-size-base", map[size] || "15px");
}
function applyAnimations(enabled) {
  if (enabled) document.documentElement.classList.remove("no-animations");
  else         document.documentElement.classList.add("no-animations");
}
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ─── Email via EmailJS (optionnel) ou mailto fallback ─────────────
// Pour un vrai envoi côté client, on utilise EmailJS si disponible.
// Sinon on ouvre le client mail natif via mailto:.
async function sendEmailNotification({ to, subject, body }) {
  // Tentative EmailJS si configuré
  if (window.emailjs) {
    try {
      await window.emailjs.send("default_service", "template_alerte", {
        to_email: to,
        subject,
        message: body,
      });
      return { ok: true, method: "emailjs" };
    } catch (e) {
      console.warn("EmailJS failed, falling back to mailto", e);
    }
  }
  // Fallback : mailto
  const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailtoLink, "_blank");
  return { ok: true, method: "mailto" };
}

// ─── Context ─────────────────────────────────────────────────────
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved]       = useState(false);
  const idleTimerRef = useRef(null);
  const logoutRef    = useRef(null);

  // ── Appliquer au montage ──────────────────────────────────────
  useEffect(() => {
    applyTheme(settings.theme);
    applyAccentColor(settings.accentColor);
    applyFontSize(settings.fontSize);
    applyAnimations(settings.animationsEnabled);
  }, []); // eslint-disable-line

  useEffect(() => { applyTheme(settings.theme); },             [settings.theme]);
  useEffect(() => { applyAccentColor(settings.accentColor); }, [settings.accentColor]);
  useEffect(() => { applyFontSize(settings.fontSize); },       [settings.fontSize]);
  useEffect(() => { applyAnimations(settings.animationsEnabled); }, [settings.animationsEnabled]);

  // ── Session timeout ───────────────────────────────────────────
  useEffect(() => {
    const timeoutMs = (settings.sessionTimeout || 30) * 60 * 1000;
    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (logoutRef.current) logoutRef.current();
      }, timeoutMs);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [settings.sessionTimeout]);

  // ── Auto-save checklist (brouillon dans localStorage) ─────────
  // Exposé via helpers, utilisé dans ChecklistPage
  const saveChecklistDraft = useCallback((data) => {
    if (!settings.autoSaveChecklist) return;
    try {
      localStorage.setItem("checklist-draft", JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {}
  }, [settings.autoSaveChecklist]);

  const loadChecklistDraft = useCallback(() => {
    if (!settings.autoSaveChecklist) return null;
    try {
      const raw = localStorage.getItem("checklist-draft");
      if (!raw) return null;
      const draft = JSON.parse(raw);
      // Expire après 24h
      if (Date.now() - draft.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem("checklist-draft");
        return null;
      }
      return draft;
    } catch { return null; }
  }, [settings.autoSaveChecklist]);

  const clearChecklistDraft = useCallback(() => {
    localStorage.removeItem("checklist-draft");
  }, []);

  // ── Son d'alerte ──────────────────────────────────────────────
  const playAlertSound = useCallback(() => {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(); osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // ── Popup in-app ─────────────────────────────────────────────
  const showAlertPopup = useCallback((message, type = "info", forceShow = false) => {
    if (!forceShow && !settings.alertePopup) return;
    const colors = {
      danger:  { bg:"#fef2f2", border:"#fecaca",  color:"#991b1b" },
      warning: { bg:"#fffbeb", border:"#fde68a",  color:"#92400e" },
      success: { bg:"#f0fdf4", border:"#bbf7d0",  color:"#15803d" },
      info:    { bg:"#eff6ff", border:"#bfdbfe",  color:"#1e40af" },
    };
    const c = colors[type] || colors.info;
    const el = document.createElement("div");
    el.style.cssText = `position:fixed;top:20px;right:20px;z-index:99999;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:600;background:${c.bg};border:1.5px solid ${c.border};color:${c.color};box-shadow:0 4px 16px rgba(0,0,0,0.12);max-width:360px;line-height:1.5;cursor:pointer;`;
    el.textContent = message;
    el.onclick = () => el.remove();
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(() => el.remove(), 300); }, 5000);
  }, [settings.alertePopup]);

  // ── Notification NC : popup + son + email ─────────────────────
  const notifyNonConformite = useCallback(async (infos = {}) => {
    const { machineName = "", critereNom = "", commentaire = "", nbRouge = 1 } = infos;

    // Son
    if (settings.alerteSonore) playAlertSound();

    // Popup
    if (settings.alerteNonConformiteAuto && settings.alertePopup) {
      showAlertPopup(
        `🔴 Non-conformité détectée${machineName ? ` sur ${machineName}` : ""} — ${nbRouge} critère${nbRouge > 1 ? "s" : ""} ROUGE${nbRouge > 1 ? "s" : ""}`,
        "danger"
      );
    }

    // Email
    if (settings.emailNotifications && settings.emailOnNonConformite && settings.emailRecipient) {
      const subject = settings.emailObject || "Alerte Non-conformité - OK Démarrage";
      const body = [
        `⚠️ Non-conformité détectée`,
        ``,
        `Machine      : ${machineName || "N/A"}`,
        `Critère      : ${critereNom  || "N/A"}`,
        `Commentaire  : ${commentaire || "—"}`,
        `Nombre de NC : ${nbRouge}`,
        ``,
        `Connectez-vous à OK Démarrage pour traiter cette anomalie.`,
      ].join("\n");
      await sendEmailNotification({ to: settings.emailRecipient, subject, body });
    }
  }, [settings, playAlertSound, showAlertPopup]);

  // ── Notification validation ───────────────────────────────────
  const notifyValidation = useCallback(async (infos = {}) => {
    const { checklistId, machineName = "", niveau = "N1", validePar = "" } = infos;

    if (settings.alertePopup) {
      showAlertPopup(`✅ Checklist #${checklistId} validée ${niveau} par ${validePar}`, "success");
    }

    if (settings.emailNotifications && settings.emailOnValidation && settings.emailRecipient) {
      const subject = `[OK Démarrage] Checklist #${checklistId} validée ${niveau}`;
      const body = [
        `✅ Validation ${niveau}`,
        ``,
        `Checklist #${checklistId}`,
        `Machine  : ${machineName}`,
        `Validé par : ${validePar}`,
      ].join("\n");
      await sendEmailNotification({ to: settings.emailRecipient, subject, body });
    }
  }, [settings, showAlertPopup]);

  // ── Notification rejet ────────────────────────────────────────
  const notifyRejet = useCallback(async (infos = {}) => {
    const { checklistId, machineName = "", motif = "" } = infos;

    if (settings.alertePopup) {
      showAlertPopup(`❌ Checklist #${checklistId} rejetée${motif ? ` : ${motif}` : ""}`, "danger");
    }

    if (settings.emailNotifications && settings.emailOnRejet && settings.emailRecipient) {
      const subject = `[OK Démarrage] Checklist #${checklistId} rejetée`;
      const body = [
        `❌ Rejet de checklist`,
        ``,
        `Checklist #${checklistId}`,
        `Machine : ${machineName}`,
        `Motif   : ${motif || "Non précisé"}`,
      ].join("\n");
      await sendEmailNotification({ to: settings.emailRecipient, subject, body });
    }
  }, [settings, showAlertPopup]);

  // ── Notification plan d'action ────────────────────────────────
  const notifyPlanAction = useCallback(async (infos = {}) => {
    const { checklistId, action = "créé", planTitre = "" } = infos;

    if (settings.alertePopup) {
      showAlertPopup(`📋 Plan d'action ${action} pour checklist #${checklistId}`, "info");
    }

    if (settings.emailNotifications && settings.emailOnPlanAction && settings.emailRecipient) {
      const subject = `[OK Démarrage] Plan d'action ${action} — Checklist #${checklistId}`;
      const body = [
        `📋 Plan d'action ${action}`,
        ``,
        `Checklist #${checklistId}`,
        `Plan : ${planTitre || "N/A"}`,
      ].join("\n");
      await sendEmailNotification({ to: settings.emailRecipient, subject, body });
    }
  }, [settings, showAlertPopup]);

  // ── Confirmation soumission ───────────────────────────────────
  const confirmSubmit = useCallback((nbRouge) => {
    if (!settings.confirmationSoumission) return true;
    if (nbRouge > 0) {
      return window.confirm(
        `⚠️ Vous avez ${nbRouge} critère${nbRouge > 1 ? "s" : ""} non-conforme${nbRouge > 1 ? "s" : ""}.\nVoulez-vous vraiment soumettre cette checklist ?`
      );
    }
    return window.confirm("Confirmer la soumission de la checklist ?");
  }, [settings.confirmationSoumission]);

  // ── shouldAlertNC ─────────────────────────────────────────────
  const shouldAlertNC = useCallback(() => settings.alerteNonConformiteAuto, [settings.alerteNonConformiteAuto]);

  // ── Test email ────────────────────────────────────────────────
  const sendTestEmail = useCallback(async () => {
    if (!settings.emailNotifications || !settings.emailRecipient) return { ok: false, reason: "disabled" };
    const locale = settings.lang === "ar" ? "ar-MA" : settings.lang === "en" ? "en-US" : "fr-FR";
    const result = await sendEmailNotification({
      to:      settings.emailRecipient,
      subject: `[TEST] ${settings.emailObject || "OK Démarrage - Test"}`,
      body:    `Ceci est un email de test envoyé depuis OK Démarrage.\n\nConfiguration vérifiée avec succès le ${new Date().toLocaleString(locale)}.`,
    });
    if (result.ok) {
      showAlertPopup(`📧 Email de test envoyé à ${settings.emailRecipient} (via ${result.method})`, "success");
    }
    return result;
  }, [settings, showAlertPopup]);

  // ── Rappel plan d'action (à appeler au login ou périodiquement) ─
  const checkPlanActionRappels = useCallback((plans = []) => {
    if (!settings.alertePopup) return;
    const today = new Date();
    const seuil = settings.delaiRappelPlan || 3;
    plans.forEach(plan => {
      if (plan.statut === "CLOS" || !plan.dateEcheance) return;
      const echeance  = new Date(plan.dateEcheance);
      const diffDays  = Math.ceil((echeance - today) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= seuil) {
        showAlertPopup(
          `⏰ Plan d'action "${plan.titre || "N/A"}" — échéance dans ${diffDays} jour${diffDays > 1 ? "s" : ""}`,
          diffDays === 0 ? "danger" : "warning"
        );
      }
    });
  }, [settings.alertePopup, settings.delaiRappelPlan, showAlertPopup]);

  // ── update / save / reset ─────────────────────────────────────
  const update = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const save = useCallback(() => {
    setSettings(prev => {
      saveSettings(prev);
      // Sync language to the key used by I18nContext so it persists on reload
      try { localStorage.setItem('app-lang', prev.lang || 'fr'); } catch {}
      return prev;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  const reset = useCallback(() => {
    if (!window.confirm("Réinitialiser tous les paramètres par défaut ?")) return;
    setSettings({ ...defaultSettings });
    saveSettings(defaultSettings);
    try { localStorage.setItem('app-lang', defaultSettings.lang || 'fr'); } catch {}
    applyTheme(defaultSettings.theme);
    applyAccentColor(defaultSettings.accentColor);
    applyFontSize(defaultSettings.fontSize);
    applyAnimations(defaultSettings.animationsEnabled);
  }, []);

  const setLogoutFn = useCallback((fn) => { logoutRef.current = fn; }, []);

  return (
    <SettingsContext.Provider value={{
      settings, update, save, reset, saved,
      // alertes
      playAlertSound, showAlertPopup, shouldAlertNC, confirmSubmit,
      // notifications fonctionnelles
      notifyNonConformite, notifyValidation, notifyRejet, notifyPlanAction,
      sendTestEmail, checkPlanActionRappels,
      // checklist draft
      saveChecklistDraft, loadChecklistDraft, clearChecklistDraft,
      // session
      setLogoutFn,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings doit être utilisé dans SettingsProvider");
  return ctx;
}