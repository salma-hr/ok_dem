/**
 * ImportChecklistModal.jsx
 * ─────────────────────────────────────────────────────────────────
 * Import robuste de checklist PDF LEONI → extraction bilingue FR/AR
 * avec validation, déduplication, gestion d'erreurs et UX optimisée
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createCritere, getMonProfil, previewCriteresPdf, regenerateCritereImage } from "../../api";
import { clearAuthStorage, getUsableStoredToken } from "../../utils/authToken";
import { useI18n } from "../../context/I18nContext";


const CONFIG = {
  MAX_FILE_SIZE_MB: 10,
  SUPPORTED_TYPES: ["application/pdf"],
  BATCH_SIZE: 5, // Import par lots pour éviter les timeouts
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 500,
  DESCRIPTION_MAX_LENGTH: 500,
  ARABIC_MAX_LENGTH: 500,
  PREVIEW_MAX_LENGTH: 2000,
};

const TYPE_MAPPING = {
  // FR
  "qualité": "QUALITE", "qualite": "QUALITE", "critéres qualité": "QUALITE",
  "technique": "TECHNIQUE", "critéres technique": "TECHNIQUE",
  "sécurité": "SECURITE", "securite": "SECURITE", "critéres sécurité": "SECURITE", "5s": "SECURITE",
  // AR (translittération courante)
  "ةدوجلا": "QUALITE", "ةينقت": "TECHNIQUE", "ةملاسلا": "SECURITE",
};

const COULEUR_MAPPING = {
  "rouge": "Rouge", "rouge rmhأ": "Rouge", "رمحأ": "Rouge",
  "jaune": "Jaune", "jaune rfsأ": "Jaune", "رفصأ": "Jaune",
};

const MOYEN_MAPPING = {
  "visuel": "VISUEL", "👁": "VISUEL",
  "simulation": "SIMULATION", "🔄": "SIMULATION",
  "en production": "EN_PRODUCTION", "en_production": "EN_PRODUCTION", "🎬": "EN_PRODUCTION",
};

const CATEGORIE_MAPPING = {
  "m méthode": "Méthode", "méthode": "Méthode", "ةقيرطلا": "Méthode",
  "m machine": "Machine", "machine": "Machine", "ةللآا": "Machine",
  "m matière": "Matière", "matière": "Matière", "مادة": "Matière", "ةداملا": "Matière",
  "m œuvre": "Main-d'œuvre", "main-d'œuvre": "Main-d'œuvre", "لماعلا": "Main-d'œuvre",
  "m milieu": "Milieu", "milieu": "Milieu", "ةئيبلا": "Milieu",
};

const MACHINE_STATE_MAPPING = {
  "m": "MARCHE", "machine en marche": "MARCHE", "حابصلا": "MARCHE",
  "a": "ARRET", "machine en arrêt": "ARRET", "ءاسملا": "ARRET", "ليللا": "ARRET",
};

const TYPE_LABELS = {
  QUALITE: "Qualité",
  TECHNIQUE: "Technique",
  SECURITE: "Sécurité",
};

const MOYEN_LABELS = {
  VISUEL: "Visuel",
  SIMULATION: "Simulation",
  EN_PRODUCTION: "En production",
};

// ─────────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────────
const utils = {
  sanitizeText: (text, maxLength = CONFIG.DESCRIPTION_MAX_LENGTH) => {
    if (!text) return "";
    return text
      .replace(/\u00A0/g, " ")
      .replace(/[\u200E\u200F\u202A-\u202E]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^\S\r\n]+/g, " ")
      .trim()
      .substring(0, maxLength);
  },

  cleanExtractionText: (text = "") => {
    if (!text) return "";
    return text
      .replace(/\u00A0/g, " ")
      .replace(/[\u200E\u200F\u202A-\u202E]/g, " ")
      .replace(/\b([AMSN])\s+(Visuel|Simulation|En\s*production)\b/gi, " ")
      .replace(/\b(Visuel|Simulation|En\s*production)\b\s*$/gi, " ")
      // Supprime les numéros de ligne isolés ex: "9 :" ou "11 M"
      .replace(/^\s*\d{1,2}\s*[:]?\s*[AMSN]?\s*/g, "")
      .replace(/\b\d{1,2}\s+[AMSN]\b/g, " ")
      // Supprime les artefacts OCR type: "9 : é ' à"
      .replace(/\b\d{1,2}\s*[:.)-]+\s*[’'`´a-zàâéèêëîïôùûüç\s]{0,8}(?=\s|$)/gi, " ")
      // Supprime les états machine isolés (A/M/S/N) en fin de texte
      .replace(/\b([AMSN])\b\s*$/gi, " ")
      // Nettoie les apostrophes et guillemets parasites
      .replace(/["'""«»]+\s*["'""«»]+/g, " ")
      // Supprime les séquences de ponctuation seules
      .replace(/\s[/:;,.]+\s/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[;,:-]+\s*$/g, "")
      .trim();
  },

  repairFrenchAccents: (text = "") => {
    let out = text || "";
    for (let i = 0; i < 3; i++) {
      const before = out;
      out = out
        // Ex: "V é rifier" -> "Vérifier"
        .replace(/([A-Za-z])\s+([àâäéèêëîïôöùûüçœ])\s+([A-Za-z]{2,})/giu, "$1$2$3")
        // Ex: "pr é sence" -> "présence"
        .replace(/([A-Za-z]{2,})\s+([àâäéèêëîïôöùûüçœ])\s+([A-Za-z]{2,})/giu, "$1$2$3")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (out === before) break;
    }
    return out;
  },

  cleanFrenchText: (text = "") => {
    const cleaned = utils.repairFrenchAccents(utils.cleanExtractionText(text))
      .replace(/\s*[:;,.-]+\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const latinCount = (cleaned.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    return latinCount >= 4 ? cleaned : "";
  },

  cleanArabicText: (text = "") => {
    if (!text) return "";
    let cleaned = text
      .replace(/[\u200E\u200F\u202A-\u202E]/g, " ")
      .replace(/\b(Rouge|Jaune|Vert|Visuel|Simulation|En\s*production|VISUEL|SIMULATION)\b/gi, " ")
      .replace(/[A-Za-zÀ-ÿ]{2,}/g, " ")
      .replace(/\b\d{1,2}\s*[:.)-]\s*/g, " ")
      .replace(/[(){}]/g, " ")
      .replaceAll("[", " ")
      .replaceAll("]", " ")
      .replace(/\s*[:;/]+\s*/g, " ")
      .replace(/^[\s,;:."'`´«»-]+/g, "")
      .replace(/[\s,;:."'`´«»-]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    cleaned = cleaned
      .replace(/^\s*(الطريقة|الآلة|الماكينة|المادة|البيئة|العامل)\s*[:\-–—]*\s*/g, "")
      .replace(/\s*[:\-–—]*\s*(الطريقة|الآلة|الماكينة|المادة|البيئة|العامل)\s*$/g, "")
      .replace(/^[\s،؛,.]+/g, "")
      .replace(/[\s،؛,.]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    return utils.hasSignificantArabic(cleaned) ? cleaned : "";
  },

  hasSignificantArabic: (text = "") => {
    const count = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
    return count >= 4;
  },

  hasArabic: (text = "") => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text),

  splitBilingualText: (frText = "", arText = "") => {
    const rawFr = frText || "";
    const rawAr = arText || "";

    // Regex bloc arabe étendu (inclut les diacritiques et ponctuation arabe)
    const AR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const AR_BLOCK = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u064B-\u065F\s\d.,;:()\-/'"]+/g;

    // Si rawFr ne contient pas d'arabe, garder la fidélité des textes backend.
    if (rawAr && !AR_REGEX.test(rawFr)) {
      const cleanFr = utils.cleanFrenchText(rawFr);
      const cleanAr = utils.cleanArabicText(rawAr);
      return {
        nom: utils.sanitizeText(cleanFr, CONFIG.DESCRIPTION_MAX_LENGTH),
        nomAr: utils.sanitizeText(cleanAr, CONFIG.ARABIC_MAX_LENGTH),
      };
    }

    // Sinon : extraire l'arabe du texte FR mélangé
    const arabicChunks = rawFr.match(AR_BLOCK) || [];
    const extractedAr = arabicChunks.join(" ").trim();
    const extractedFr = utils.cleanFrenchText(
      rawFr.replace(AR_BLOCK, " ").replace(/\s+/g, " ").trim()
    );

    return {
      nom: utils.sanitizeText(extractedFr, CONFIG.DESCRIPTION_MAX_LENGTH),
      nomAr: utils.sanitizeText(utils.cleanArabicText(rawAr || extractedAr), CONFIG.ARABIC_MAX_LENGTH),
    };
  },

  inferMoyenFromText: (text = "") => {
    const t = text.toLowerCase();
    if (/en\s*production/.test(t)) return "EN_PRODUCTION";
    if (/simulation/.test(t)) return "SIMULATION";
    if (/visuel/.test(t)) return "VISUEL";
    return null;
  },

  inferMachineStateFromText: (text = "") => {
    const m = text.match(/\b([AMSN])\b(?=\s*(visuel|simulation|en\s*production)\b)/i);
    if (!m) return null;
    const key = m[1].toLowerCase();
    return MACHINE_STATE_MAPPING[key] || null;
  },

  inferCategorieFromText: (text = "") => {
    const t = text.toLowerCase();
    if (/m\s*m[ée]thode|méthode|طريقة/.test(t)) return "Méthode";
    if (/m\s*machine|machine|الآلة|ةللاا/.test(t)) return "Machine";
    if (/m\s*milieu|milieu|البيئة|ةئيبلا/.test(t)) return "Milieu";
    if (/m\s*mati[èe]re|mati[èe]re|المادة|ةداملا/.test(t)) return "Matière";
    if (/m\s*[œo]uvre|main.?d.?[’']?œuvre|main.?d.?[’']?oeuvre|العامل/.test(t)) return "Main-d'œuvre";
    return null;
  },

  normalizeKey: (str) => {
    if (!str) return "";
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_");
  },

  detectType: (description, category) => {
    const text = (description + " " + category).toLowerCase();
    if (/qualit|dوج|flash|enregistrement|surveillance/i.test(text)) return "QUALITE";
    if (/techni|pression|bar|sonotrode|positionneur|poka.yoke|réglage/i.test(text)) return "TECHNIQUE";
    if (/sécurit|5s|éclairage|propret|urgence|gants|avertissement/i.test(text)) return "SECURITE";
    return "QUALITE"; // Default
  },

  deduplicateCriteres: (criteres) => {
    const seen = new Set();
    return criteres.filter(c => {
      const nameKey = utils.normalizeKey(c.nomPreview || c.nom || "");
      const arKey = utils.normalizeKey(c.nomAr || "");
      const catKey = utils.normalizeKey(c.categorie || "");
      const typeKey = utils.normalizeKey(c.type || "");
      const key = `${nameKey}|${arKey}|${catKey}|${typeKey}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  validateCritere: (c) => {
    const errors = [];
    if (!c.nom || c.nom.trim().length < 5) errors.push("Description trop courte");
    if (c.nom && c.nom.length > CONFIG.DESCRIPTION_MAX_LENGTH) errors.push("Description trop longue");
    if (!["QUALITE", "TECHNIQUE", "SECURITE"].includes(c.type)) errors.push("Type invalide");
    if (!["Rouge", "Jaune"].includes(c.couleur)) errors.push("Couleur invalide");
    if (!["VISUEL", "SIMULATION", "EN_PRODUCTION"].includes(c.moyenVerification)) {
      errors.push("Moyen de vérification invalide");
    }
    return { valid: errors.length === 0, errors };
  },

  retryWithBackoff: async (fn, attempts = CONFIG.RETRY_ATTEMPTS, delay = CONFIG.RETRY_DELAY_MS) => {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        // Ne jamais retenter sur erreurs d'authentification/autorisation :
        // un retry avec le même token (ou sans token) ne résoudra rien.
        const status = err?.response?.status;
        if (status === 401 || status === 403) throw err;
        if (i < attempts - 1) {
          await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  },
};

// ─────────────────────────────────────────────────────────────────
// STYLES (optimisés)
// ─────────────────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(15, 23, 42, 0.58)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: {
    background: "var(--bg-1)",
    borderRadius: 20,
    boxShadow: "0 24px 80px rgba(0, 0, 0, 0.32)",
    width: 920,
    maxWidth: "94vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid rgba(148, 163, 184, 0.22)",
    transform: "translateY(0)",
  },
  header: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "20px 24px 18px", borderBottom: "1px solid var(--bd-1)",
    flexShrink: 0,
  },
  headerIcon: {
    width: 48, height: 48, borderRadius: 14,
    background: "var(--grd-h)", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontSize: 22, boxShadow: "var(--sh-blue)", flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: 900, color: "var(--tx-1)", margin: 0 },
  sub: { fontSize: 12, color: "var(--tx-3)", margin: "3px 0 0", lineHeight: 1.4 },
  closeBtn: {
    marginLeft: "auto", background: "var(--bg-3)", border: "none",
    width: 36, height: 36, borderRadius: 10, cursor: "pointer",
    fontSize: 15, color: "var(--tx-3)", display: "flex",
    alignItems: "center", justifyContent: "center",
    transition: "all .15s",
  },
  body: { flex: 1, overflowY: "auto", padding: "22px 24px", scrollBehavior: "smooth" },
  footer: {
    padding: "16px 24px", borderTop: "1px solid var(--bd-1)",
    display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0,
    background: "var(--bg-1)",
  },

  // Drop zone
  dropZone: (active, error) => ({
    border: `2.5px dashed ${error ? "#ef4444" : active ? "#6366f1" : "var(--bd-1)"}`,
    borderRadius: 16, padding: "36px 24px", textAlign: "center",
    background: active ? "#f5f3ff" : error ? "#fef2f2" : "var(--bg-2)",
    cursor: "pointer", transition: "all .2s ease",
    marginBottom: 20,
  }),
  dropIcon: { fontSize: 40, marginBottom: 10, lineHeight: 1, display: "block" },
  dropTitle: { fontSize: 15, fontWeight: 800, color: "var(--tx-1)", marginBottom: 6 },
  dropSub: { fontSize: 12, color: "var(--tx-3)", lineHeight: 1.5 },
  dropHint: { fontSize: 11, color: "var(--tx-4)", marginTop: 8, fontStyle: "italic" },

  // File chip
  fileChip: {
    display: "flex", alignItems: "center", gap: 12,
    background: "var(--bg-2)", border: "1.5px solid var(--bd-2)",
    borderRadius: 12, padding: "12px 16px", marginBottom: 20,
  },
  fileChipIcon: { fontSize: 24 },
  fileChipInfo: { flex: 1, minWidth: 0 },
  fileChipName: { fontWeight: 700, color: "var(--tx-1)", fontSize: 14, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  fileChipMeta: { fontSize: 11, color: "var(--tx-3)", display: "flex", gap: 8 },
  removeFile: {
    background: "#fef2f2", border: "none", borderRadius: 8,
    color: "#ef4444", cursor: "pointer", fontSize: 18,
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, transition: "background .15s",
  },

  // Fields
  field: { marginBottom: 18 },
  label: {
    display: "block", marginBottom: 6, fontSize: 11,
    fontWeight: 700, color: "var(--tx-3)",
    textTransform: "uppercase", letterSpacing: "0.5px",
  },
  select: {
    width: "100%", padding: "11px 14px",
    border: "1.5px solid var(--bd-1)", borderRadius: 10,
    fontSize: 13, fontFamily: "var(--fb)",
    background: "var(--bg-2)", color: "var(--tx-1)", outline: "none",
    cursor: "pointer", transition: "border-color .15s",
  },

  // Progress
  progressWrap: {
    background: "var(--bg-2)", borderRadius: 14,
    padding: "18px 20px", marginBottom: 18,
    border: "1px solid var(--bd-1)",
  },
  progressHeader: { display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" },
  progressText: { fontSize: 13, fontWeight: 600, color: "var(--tx-2)", display: "flex", alignItems: "center", gap: 8 },
  progressPct: { fontSize: 13, fontWeight: 800, color: "var(--l5)" },
  progressBg: {
    height: 8, borderRadius: 99,
    background: "var(--bd-1)", overflow: "hidden",
  },
  progressBar: (pct, color = "var(--grd-h)") => ({
    height: "100%", borderRadius: 99,
    background: color,
    width: `${Math.min(100, Math.max(0, pct))}%`,
    transition: "width .3s ease",
  }),

  // Preview
  previewBox: {
    background: "var(--bg-2)", borderRadius: 14,
    border: "1px solid var(--bd-1)",
    maxHeight: 280, overflowY: "auto", marginBottom: 18,
  },
  previewHeader: {
    padding: "10px 16px", borderBottom: "1px solid var(--bd-1)",
    fontSize: 11, fontWeight: 700, color: "var(--tx-4)",
    textTransform: "uppercase", letterSpacing: "0.6px",
    position: "sticky", top: 0, background: "var(--bg-2)", zIndex: 1,
  },
  previewItem: (i, isHovered) => ({
    padding: "12px 16px",
    borderBottom: "1px solid var(--bd-1)",
    background: isHovered ? "var(--bg-1)" : (i % 2 === 0 ? "transparent" : "var(--bg-1)"),
    transition: "background .15s",
    cursor: "default",
  }),
  previewRow: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  previewBadge: (type) => {
    const map = {
      QUALITE: { bg: "#ecfdf5", color: "#059669", label: "✓ Qualité" },
      TECHNIQUE: { bg: "#eff6ff", color: "#2563eb", label: "⚙ Technique" },
      SECURITE: { bg: "#fff1f2", color: "#e11d48", label: "⚠ Sécurité" },
    };
    const c = map[type] || map.QUALITE;
    return {
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 700, background: c.bg, color: c.color,
      flexShrink: 0,
    };
  },
  previewContent: { flex: 1, minWidth: 0 },
  previewFr: { fontSize: 12, color: "var(--tx-1)", fontWeight: 600, marginBottom: 3, lineHeight: 1.4 },
  previewAr: { fontSize: 11, color: "var(--tx-3)", direction: "rtl", textAlign: "right", lineHeight: 1.4 },
  previewMeta: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" },
  previewMetaTag: (text, icon) => ({
    fontSize: 10, color: "var(--tx-4)", background: "var(--bg-3)",
    borderRadius: 6, padding: "2px 7px", display: "inline-flex",
    alignItems: "center", gap: 3, fontWeight: 500,
  }),

  // Stats
  statsRow: { display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  statPill: (color, count) => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
    background: color + "15", color,
    display: "flex", alignItems: "center", gap: 6,
  }),

  // Alerts
  alert: (type) => ({
    padding: "12px 16px", borderRadius: 12, fontSize: 13, marginBottom: 16,
    background: type === "error" ? "#fef2f2" : type === "warning" ? "#fffbeb" : "#f0fdf4",
    color: type === "error" ? "#dc2626" : type === "warning" ? "#b45309" : "#15803d",
    border: `1px solid ${type === "error" ? "#fecaca" : type === "warning" ? "#fcd34d" : "#86efac"}`,
    display: "flex", alignItems: "flex-start", gap: 10,
  }),

  // Info box
  infoBox: {
    background: "#eff6ff", border: "1px solid #bfdbfe",
    borderRadius: 12, padding: "12px 16px", fontSize: 12,
    color: "#1d4ed8", lineHeight: 1.6,
  },

  // Buttons
  btnBase: {
    borderRadius: 12, padding: "11px 24px", fontWeight: 700,
    fontSize: 13, cursor: "pointer", transition: "all .15s",
    display: "inline-flex", alignItems: "center", gap: 8,
  },
  btnPrimary: {
    background: "var(--grd-h)", color: "#fff", border: "none",
    boxShadow: "var(--sh-blue)",
  },
  btnPrimaryDisabled: {
    background: "var(--bd-2)", color: "var(--tx-4)",
    boxShadow: "none", cursor: "not-allowed",
  },
  btnCancel: {
    background: "var(--bg-3)", color: "var(--tx-2)",
    border: "1.5px solid var(--bd-1)",
  },
  btnGhost: {
    background: "#f5f3ff", color: "#7c3aed",
    border: "1.5px solid #e9d5ff",
  },
  btnDanger: {
    background: "#fef2f2", color: "#ef4444",
    border: "1.5px solid #fecaca",
  },

  // Spinner
  spinner: (size = 18, color = "currentColor") => ({
    width: size, height: size,
    border: `2.5px solid ${color}20`,
    borderTop: `2.5px solid ${color}`,
    borderRadius: "50%", animation: "spin .7s linear infinite",
    display: "inline-block", flexShrink: 0,
  }),

  // Success animation
  successIcon: {
    fontSize: 64, marginBottom: 16,
    animation: "bounceIn .4s ease",
  },

  // Validation errors list
  errorList: {
    fontSize: 12, color: "#dc2626", marginTop: 6, paddingLeft: 18,
  },
};

// ─────────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────────
export default function ImportChecklistModal({
  processus = [],
  currentProcessusId = "",
  onImport,
  onClose,
  checklistName = "",
}) {
  const inputRef = useRef();
  const { t } = useI18n();
  const ts = (key, fb) => (typeof t === 'function' ? (t(key) || fb || key) : (fb || key));

  // Plus de traduction automatique (LibreTranslate/Docker retiré) :
  // le PDF fournit FR + AR, les champs EN/DE restent vides et sont
  // à saisir manuellement par l'utilisateur.
  const buildTranslatedFields = async () => ({
    nomEn: "", descriptionEn: "", nomDe: "", descriptionDe: "",
  });

  // États
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [procId, setProcId] = useState(String(currentProcessusId));
  const [step, setStep] = useState("idle"); // idle | parsing | preview | importing | done | error
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [parsed, setParsed] = useState([]);
  const [extractedTotal, setExtractedTotal] = useState(0);
  const [imported, setImported] = useState(0);
  const [importErrors, setImportErrors] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [hoveredPreview, setHoveredPreview] = useState(-1);
  const [imagesFound, setImagesFound] = useState(0); // nb d'images auto trouvées (Wikipedia)
  const [imageGenStep, setImageGenStep] = useState(false); // post-import image generation in progress
  const [imageGenCount, setImageGenCount] = useState(0); // images générées en post-import

  const activeChecklistLabel = checklistName || file?.name || "";

  const filteredProcessus = useMemo(() => {
    if (!activeChecklistLabel) return processus;

    const stopWords = new Set([
      "checklist", "checklists", "verif", "vérif", "verification", "vérification",
      "pdf", "fr", "ar", "frar", "arfr", "leoni", "de", "du", "des", "la", "le",
      "les", "et", "ou", "pour", "avec", "sans", "processus"
    ]);

    const keywords = activeChecklistLabel
      .replace(/\.[^/.]+$/, "")
      .replace(/[(){}_,;:./\\-]/g, " ")
      .replaceAll("[", " ")
      .replaceAll("]", " ")
      .split(/\s+/)
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word.length >= 3 && !stopWords.has(word));

    if (keywords.length === 0) return processus;

    const matches = processus.filter((proc) => {
      const name = String(proc?.nom || "").toLowerCase();
      return keywords.some((keyword) => name.includes(keyword));
    });

    // Never block selection: fallback to full list when keyword matching is too strict
    return matches.length > 0 ? matches : processus;
  }, [activeChecklistLabel, processus]);

  useEffect(() => {
    if (!filteredProcessus.length) return;
    const stillVisible = filteredProcessus.some((pr) => String(pr.id) === String(procId));
    if (!stillVisible) {
      setProcId(String(filteredProcessus[0].id));
    }
  }, [filteredProcessus, procId]);

  // Reset au montage
  useEffect(() => {
    return () => {
      if (file?.preview) URL.revokeObjectURL(file.preview);
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [file, filePreviewUrl]);

  const handleAuthExpired = useCallback((message) => {
      setErrorMsg(message || "⛔ Session expirée ou non authentifié. Veuillez vous reconnecter et réessayer.");
    setStep("error");
    clearAuthStorage();
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    setTimeout(() => {
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }, 120);
  }, []);

  const ensureServerSession = useCallback(async () => {
    try {
      await getMonProfil();
      return true;
    } catch (err) {
      if (err?.response?.status === 401) {
        handleAuthExpired("⛔ Session invalide côté serveur. Reconnectez-vous puis relancez l'import.");
        return false;
      }
      return true;
    }
  }, [handleAuthExpired]);

  // ── Validation fichier ──────────────────────────────────────────
  const validateFile = useCallback((f) => {
    if (!f) return "Aucun fichier sélectionné";
    if (!CONFIG.SUPPORTED_TYPES.includes(f.type)) {
      return "Format non supporté. Veuillez utiliser un fichier PDF.";
    }
    if (f.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return `Fichier trop volumineux (max ${CONFIG.MAX_FILE_SIZE_MB} Mo)`;
    }
    return null;
  }, []);

  // ── Drag & Drop ─────────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    
    const f = e.dataTransfer.files?.[0];
    const error = validateFile(f);
    
    if (error) {
      setFileError(error);
      return;
    }

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    const previewUrl = URL.createObjectURL(f);
    
    setFile(f);
    setFilePreviewUrl(previewUrl);
    setFileError("");
    setErrorMsg("");
  }, [validateFile, filePreviewUrl]);

  const onFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    const error = validateFile(f);
    
    if (error) {
      setFileError(error);
      return;
    }

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    const previewUrl = URL.createObjectURL(f);
    
    setFile(f);
    setFilePreviewUrl(previewUrl);
    setFileError("");
    setErrorMsg("");
  }, [validateFile, filePreviewUrl]);

  // ── Parsing PDF via API ─────────────────────────────────────────
  const handleParse = async () => {
    if (!file) return;
    if (!procId) {
      setErrorMsg("Veuillez sélectionner un processus cible.");
      return;
    }

    const token = getUsableStoredToken();
    if (!token) {
      handleAuthExpired();
      return;
    }

    const serverSessionOk = await ensureServerSession();
    if (!serverSessionOk) return;

    setStep("parsing");
    setProgress(10);
    setErrorMsg("");
    setFileError("");
    setExtractedTotal(0);
    setProgressMsg("📤 Envoi du PDF au serveur…");

    try {
      // Étape 1: Upload & extraction
      setProgress(20);
      setProgressMsg("🔍 Analyse du PDF + recherche d'images automatiques…");

      const { data } = await utils.retryWithBackoff(
        () => previewCriteresPdf(file, parseInt(procId, 10))
      );

      // Nombre d'images trouvées automatiquement par le backend (Wikipedia)
      const foundImages = Number.isFinite(Number(data?.imagesFound)) ? Number(data.imagesFound) : 0;
      setImagesFound(foundImages);

      setProgress(60);
      setProgressMsg(
        foundImages > 0
          ? `🖼️ ${foundImages} image(s) illustrative(s) trouvée(s) — normalisation…`
          : "🧹 Normalisation et validation des critères…"
      );

      // Étape 2: Normalisation fidèle (préserve les textes backend)
      const rawCriteres = Array.isArray(data?.criteres) ? data.criteres : [];
      const backendTotal = Number.isFinite(Number(data?.total))
        ? Number(data.total)
        : Number.isFinite(Number(data?.nbCriteres))
          ? Number(data.nbCriteres)
          : rawCriteres.length;
      
      const normalized = rawCriteres
        .map((c) => {
          const frFromApiRaw = utils.sanitizeText(
            [c?.nom, c?.description].filter(Boolean).join(" "),
            CONFIG.PREVIEW_MAX_LENGTH
          );
          const arFromApiRaw = utils.sanitizeText(
            [c?.nomAr, c?.descriptionAr].filter(Boolean).join(" "),
            CONFIG.PREVIEW_MAX_LENGTH
          );
          const sourceText = `${frFromApiRaw} ${arFromApiRaw}`.trim();

          // Fallback uniquement si l'arabe est mélangé dans le champ FR.
          let nomPreview = utils.cleanFrenchText(frFromApiRaw);
          let nomArPreview = utils.cleanArabicText(arFromApiRaw);

          if (utils.hasArabic(nomPreview)) {
            const split = utils.splitBilingualText(nomPreview, nomArPreview);
            nomPreview = split.nom || nomPreview;
            nomArPreview = split.nomAr || nomArPreview;
          } else if (!nomArPreview && utils.hasArabic(frFromApiRaw)) {
            const split = utils.splitBilingualText(frFromApiRaw, "");
            nomPreview = split.nom || nomPreview;
            nomArPreview = split.nomAr || "";
          }

          if (!nomPreview) {
            nomPreview = utils.cleanFrenchText(frFromApiRaw) || utils.cleanExtractionText(frFromApiRaw) || "Critère importé";
          }
          nomArPreview = utils.cleanArabicText(nomArPreview);

          const cleanedForInference = utils.cleanExtractionText(sourceText || `${nomPreview} ${nomArPreview}`.trim());
          const inferredMoyen = utils.inferMoyenFromText(cleanedForInference);
          const inferredState = utils.inferMachineStateFromText(cleanedForInference);
          const inferredCategorie = utils.inferCategorieFromText(
            `${sourceText} ${c?.categorie || ""}`
          );

          const nomDb = nomPreview.substring(0, CONFIG.DESCRIPTION_MAX_LENGTH).trim();
          const descriptionDb = nomPreview.length > CONFIG.DESCRIPTION_MAX_LENGTH
            ? nomPreview.substring(CONFIG.DESCRIPTION_MAX_LENGTH).trim()
            : "";

          const nomArDb = nomArPreview.substring(0, CONFIG.ARABIC_MAX_LENGTH).trim();
          const descriptionArDb = nomArPreview.length > CONFIG.ARABIC_MAX_LENGTH
            ? nomArPreview.substring(CONFIG.ARABIC_MAX_LENGTH).trim()
            : "";
          
          // Détection/Mapping des champs
          const type = TYPE_MAPPING[c?.type?.toLowerCase()] || 
                      utils.detectType(nomPreview, c?.categorie);
          const couleur = COULEUR_MAPPING[c?.couleur?.toLowerCase()] || "Jaune";
          const moyenVerification = inferredMoyen || MOYEN_MAPPING[c?.moyenVerification?.toLowerCase()] || "VISUEL";
          const categorie = inferredCategorie || CATEGORIE_MAPPING[c?.categorie?.toLowerCase()] || "Machine";
          const machineState = inferredState || MACHINE_STATE_MAPPING[c?.machineState?.toLowerCase()] || "ARRET";

          return {
            nom: nomDb,
            description: descriptionDb,
            nomAr: nomArDb,
            descriptionAr: descriptionArDb,
            nomPreview,
            nomArPreview,
            type,
            couleur,
            moyenVerification,
            categorie,
            machineState,
            processusId: parseInt(procId, 10),
            // Image illustrative récupérée automatiquement par le backend (Wikipedia)
            // null = pas d'image trouvée → section image masquée dans l'aperçu
            image: c?.image || null,
            // Métadonnées pour débogage
            _original: { ...c },
          };
        });

      const withTranslations = await Promise.all(
        normalized.map(async (c) => ({
          ...c,
          ...(await buildTranslatedFields(c.nom, c.description)),
        }))
      );

      const normalizedValidated = withTranslations
        .map(c => {
          const validation = utils.validateCritere(c);
          return { ...c, _validation: validation };
        });
      
      // Stats
      const stats = {
        total: backendTotal,
        afterFilter: normalized.length,
        afterDedup: normalized.length,
        removed: 0,
      };

      setExtractedTotal(stats.total);

      setProgress(90);
      setProgressMsg(`✅ ${stats.afterDedup} critère(s) prêt(s) à importer`);

      setParsed(normalizedValidated);
      setProgress(100);
      
      // Message contextuel
      const messages = [];
      if (foundImages > 0) messages.push(`🖼️ ${foundImages} image(s) illustrative(s) ajoutée(s) automatiquement`);
      if (stats.total > 0) messages.push(`PDF=${stats.total}`);
      if (stats.afterFilter < stats.total) messages.push(`${stats.total - stats.afterFilter} critère(s) filtré(s)`);
      
      setStep("preview");
      
      if (messages.length > 0) {
        setErrorMsg(`ℹ️ ${messages.join(" • ")}`);
      }

    } catch (err) {
      console.error("Parse error:", err);
      setStep("error");
      
      const status = err?.response?.status;

      // Erreurs d'authentification — message dédié, pas de retry
      if (status === 401) {
        handleAuthExpired();
        return;
      }
      if (status === 403) {
        setErrorMsg("⛔ Accès refusé. Seuls les rôles PPO et ADMIN peuvent importer des critères.");
        return;
      }
      
      const apiError = err?.response?.data?.erreur || err?.response?.data?.message || err?.response?.data?.error;
      const networkError = err?.message === "Network Error" 
        ? "⚠️ Impossible de joindre le serveur. Vérifiez que l'API est démarrée sur http://localhost:8080"
        : null;
      
      setErrorMsg(networkError || apiError || `Erreur d'extraction : ${err.message}`);
    }
  };

  // ── Import en base avec gestion par lots ────────────────────────
  const handleImport = async () => {
    if (!procId || parsed.length === 0) return;

    const token = getUsableStoredToken();
    if (!token) {
      handleAuthExpired();
      return;
    }

    const serverSessionOk = await ensureServerSession();
    if (!serverSessionOk) return;
    
    setStep("importing");
    setImported(0);
    setProgress(0);
    setImportErrors([]);
    setProgressMsg("🚀 Démarrage de l'import…");

    const results = { success: 0, failed: 0, errors: [] };
    
    const toImportAll = parsed;

    // Import par lots pour éviter la surcharge
    for (let i = 0; i < toImportAll.length; i += CONFIG.BATCH_SIZE) {
      const batch = toImportAll.slice(i, i + CONFIG.BATCH_SIZE);
      
      for (const [idx, critere] of batch.entries()) {
        const globalIdx = i + idx;
        
        try {
          // Validation finale avant insertion
          if (!critere._validation?.valid) {
            throw new Error(`Validation échouée : ${critere._validation.errors.join(", ")}`);
          }

          const targetProcessusId = Number.parseInt(String(critere.processusId ?? procId), 10);
          if (!Number.isInteger(targetProcessusId) || targetProcessusId <= 0) {
            throw new Error("Processus cible invalide.");
          }

          const translatedFields = critere.nomEn || critere.nomDe || critere.descriptionEn || critere.descriptionDe
            ? {
                nomEn: critere.nomEn,
                descriptionEn: critere.descriptionEn,
                nomDe: critere.nomDe,
                descriptionDe: critere.descriptionDe,
              }
            : await buildTranslatedFields(critere.nom, critere.description);

          const createRes = await createCritere({
            nom: critere.nom,
            description: critere.description,
            nomAr: critere.nomAr,
            descriptionAr: critere.descriptionAr,
            ...translatedFields,
            type: critere.type,
            couleur: critere.couleur,
            moyenVerification: critere.moyenVerification,
            categorie: critere.categorie,
            processusId: targetProcessusId,
            // Image enrichie automatiquement (URL Wikipedia ou null)
            image: critere.image || undefined,
          });

          // Collecter l'ID des critères sans image pour génération post-import
          const createdId = createRes?.data?.id;
          if (createdId && !critere.image) {
            results.noImageIds = results.noImageIds || [];
            results.noImageIds.push({ id: createdId, nom: critere.nom });
          }

          results.success++;
          setImported(results.success);
          const done = results.success + results.failed;
          const totalToImport = toImportAll.length || 0;
          setProgress(Math.round((done / Math.max(1, totalToImport)) * 100));
          setProgressMsg(`✅ ${results.success}/${totalToImport} importés…`);

        } catch (e) {
          const status = e?.response?.status;
          if (status === 401) {
            handleAuthExpired();
            return;
          }
          if (status === 403) {
            setStep("error");
            setErrorMsg("⛔ Accès refusé. Seuls les rôles PPO et ADMIN peuvent importer des critères.");
            return;
          }

          const apiError = e?.response?.data;
          const errorMessage =
            (typeof apiError === "string" && apiError.trim())
              ? apiError
              : (apiError?.message || apiError?.error || e?.message || "Erreur inconnue");

          results.failed++;
          results.errors.push({
            index: globalIdx,
            nom: critere.nom?.substring(0, 80),
            error: errorMessage,
          });
          console.warn(`Critère #${globalIdx} échoué :`, critere.nom, errorMessage, e);
        }
      }
      
      // Pause entre les lots
      if (i + CONFIG.BATCH_SIZE < toImportAll.length) {
        await new Promise(res => setTimeout(res, 100));
      }
    }

    // ── Génération des images manquantes (post-import) ──────────────
    const missingImages = results.noImageIds || [];
    if (missingImages.length > 0 && results.success > 0) {
      setImageGenStep(true);
      setProgressMsg(`🖼️ Génération des images pour ${missingImages.length} critère(s) sans image…`);
      setProgress(95);

      // Générer les images par lots de 5 pour éviter la surcharge
      const IMG_BATCH = 5;
      let generated = 0;

      const generateMissingImage = async (id, nom) => {
        try {
          // keyword vide → backend utilise buildPrompt() avec FR_TO_EN → prompt EN précis
          await regenerateCritereImage(id, "");
          generated += 1;
          setImageGenCount(generated);
          setProgressMsg(`🖼️ Images : ${generated}/${missingImages.length} générée(s)…`);
        } catch (e) {
          console.warn('Image generation failed for critère', id, e?.message);
        }
      };

      for (let i = 0; i < missingImages.length; i += IMG_BATCH) {
        const imgBatch = missingImages.slice(i, i + IMG_BATCH);
        await Promise.allSettled(imgBatch.map(({ id, nom }) => generateMissingImage(id, nom)));
        // Pause entre les lots d'images
        if (i + IMG_BATCH < missingImages.length) {
          await new Promise(res => setTimeout(res, 800));
        }
      }
      setImageGenStep(false);
    }

    // Résultat final
    setImportErrors(results.errors);
    
    if (results.failed > 0) {
      setStep("done-with-errors");
      setProgressMsg(`⚠️ ${results.success} importés, ${results.failed} échoués`);
    } else {
      setStep("done");
      setProgressMsg(`🎉 ${results.success} critère(s) importé(s) avec succès !`);
    }
  };

  // ── Stats calculées ─────────────────────────────────────────────
  const stats = ["QUALITE", "TECHNIQUE", "SECURITE"].map((t) => ({
    type: t,
    count: parsed.filter((c) => c.type === t).length,
    color: t === "QUALITE" ? "#059669" : t === "TECHNIQUE" ? "#2563eb" : "#e11d48",
    label: t === "QUALITE" ? "Qualité" : t === "TECHNIQUE" ? "Technique" : "Sécurité",
  })).filter(s => s.count > 0);

  const hasErrors = parsed.some(c => !c._validation?.valid);
  const previewTotal = extractedTotal || parsed.length;
  const canParse = file && procId && step === "idle" && !fileError;
  const canImport = step === "preview" && procId && parsed.length > 0;

  // ── Handlers UI ─────────────────────────────────────────────────
  const handleReset = () => {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFile(null);
    setFilePreviewUrl("");
    setFileError("");
    setParsed([]);
    setExtractedTotal(0);
    setImported(0);
    setImportErrors([]);
    setErrorMsg("");
    setStep("idle");
    setProgress(0);
    setImagesFound(0);
    setImageGenStep(false);
    setImageGenCount(0);
  };

  const handleClose = () => {
    if (step === "parsing" || step === "importing") {
      if (!window.confirm("L'import est en cours. Voulez-vous vraiment annuler ?")) {
        return;
      }
    }
    onClose();
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounceIn { 
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn { 
          from { opacity: 0; transform: translateY(8px); } 
          to { opacity: 1; transform: none; } 
        }
        .im-drop:hover { border-color: #6366f1 !important; background: #f5f3ff !important; }
        .im-btn:not(:disabled):hover { 
          filter: brightness(0.95); 
          transform: translateY(-1px); 
          box-shadow: var(--sh-blue) !important;
        }
        .im-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; }
        .preview-item:hover { background: var(--bg-1) !important; }
      `}</style>

      <div style={styles.overlay} onClick={handleClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>

          {/* ── HEADER ── */}
          <div style={styles.header}>
            <div style={styles.headerIcon}>📥</div>
            <div>
              <h2 style={styles.title}>{ts('sprint2.checklist.landing.title', 'Importer une checklist PDF')}</h2>
              <p style={styles.sub}>{ts('sprint2.checklist.landing.dropSubtitle', 'Extraction automatique FR/AR • USS & Processus Coupe')}</p>
            </div>
            <button style={styles.closeBtn} onClick={handleClose} title={ts('common.close', 'Fermer')}>✕</button>
          </div>

          {/* ── BODY ── */}
          <div style={styles.body}>

            {/* Message d'erreur global */}
            {errorMsg && (
              <div style={styles.alert(errorMsg.toLowerCase().includes("erreur") || errorMsg.startsWith("⚠️") ? "error" : "warning")}>
                <span style={{ fontSize: 16 }}>{errorMsg.startsWith("⚠️") || errorMsg.startsWith("ℹ️") || errorMsg.startsWith("✅") ? "" : "⚠️"}</span>
                <span style={{ flex: 1 }}>{errorMsg.replace(/^[⚠️✅ℹ️]\s*/, "")}</span>
                {!errorMsg.startsWith("ℹ️") && (
                  <button
                    style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 16, fontWeight: 800 }}
                    onClick={() => setErrorMsg("")}
                    title="Fermer"
                  >✕</button>
                )}
              </div>
            )}

            {/* ── ÉTAPE 1 : Sélection ── */}
            {(step === "idle" || step === "error") && (
              <>
                {/* Drop zone */}
                {!file ? (
                  <div
                    className="im-drop"
                    style={styles.dropZone(dragOver, !!fileError)}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                    onClick={() => !file && inputRef.current?.click()}
                  >
                    <input 
                      ref={inputRef} 
                      type="file" 
                      accept="application/pdf" 
                      style={{ display: "none" }} 
                      onChange={onFileChange} 
                    />
                    <span style={styles.dropIcon}>{dragOver ? "📂" : "📄"}</span>
                    <div style={styles.dropTitle}>
                      {dragOver ? ts('sprint2.checklist.landing.dropTitle', 'Déposez le PDF ici') : ts('sprint2.checklist.landing.dropTitle', 'Glissez votre checklist LEONI')}
                    </div>
                    <div style={styles.dropSub}>{ts('sprint2.checklist.landing.dropSubtitle', 'PDF bilingue FR/AR • USS ou Processus Coupe')}</div>
                    <div style={styles.dropHint}>{ts('sprint2.checklist.landing.maxSize', `Max ${CONFIG.MAX_FILE_SIZE_MB} Mo • Cliquez pour parcourir`)}</div>
                  </div>
                ) : (
                  <div style={styles.fileChip}>
                    <span style={styles.fileChipIcon}>📄</span>
                    <div style={styles.fileChipInfo}>
                      <div style={styles.fileChipName} title={file.name}>{file.name}</div>
                      <div style={styles.fileChipMeta}>
                        <span>{(file.size / 1024).toFixed(1)} Ko</span>
                        <span>•</span>
                        <span>PDF</span>
                        {file.lastModified && (
                          <>
                            <span>•</span>
                            <span>{new Date(file.lastModified).toLocaleDateString("fr-FR")}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <button 
                      style={styles.removeFile} 
                      onClick={() => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl); setFile(null); setFilePreviewUrl(""); setFileError(""); }}
                      title="Supprimer le fichier"
                    >✕</button>
                  </div>
                )}

                {/* Sélection processus */}
                <div style={styles.field}>
                  <label style={styles.label}>{ts('sprint2.checklist.landing.targetProcessLabel', 'Processus cible *')}</label>
                  <select
                    style={styles.select}
                    value={procId}
                    onChange={(e) => setProcId(e.target.value)}
                    disabled={step !== "idle" && step !== "error"}
                  >
                    <option value="">— Sélectionner un processus —</option>
                    {filteredProcessus.map((pr) => (
                      <option key={pr.id} value={String(pr.id)}>{pr.nom}</option>
                    ))}
                  </select>
                </div>

                {/* Info contextuelle */}
                <div style={styles.infoBox}>
                  <div style={{fontWeight:700}}>{ts('sprint2.checklist.landing.formatsInfo', 'ℹ️ Formats supportés : Checklists LEONI bilingues FR/AR (USS-PDCA, Processus Coupe, ou structure similaire).')}</div>
                  <div style={{marginTop:8}}>{ts('sprint2.checklist.landing.extractorDetects', "L'extracteur détecte automatiquement : Qualité • Technique • Sécurité/5S")}</div>
                  <div style={{marginTop:6}}>{ts('sprint2.checklist.landing.imagesNote', '🖼️ Images illustratives ajoutées automatiquement depuis Wikipedia (gratuit, optionnel)')}</div>
                  {fileError && <><br/><strong style={{color: "#dc2626"}}>⚠️ {fileError}</strong></>}
                </div>
              </>
            )}

            {/* ── ÉTAPE 2 : Parsing ── */}
            {step === "parsing" && (
              <div style={styles.progressWrap}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressText}>
                    <span style={styles.spinner(16, "#6366f1")} />
                    {progressMsg}
                  </span>
                  <span style={styles.progressPct}>{progress}%</span>
                </div>
                <div style={styles.progressBg}>
                  <div style={styles.progressBar(progress)} />
                </div>
                {progress >= 20 && progress < 60 && (
                  <div style={{
                    marginTop: 10, padding: "8px 12px",
                    background: "#f0fdf4", border: "1px solid #bbf7d0",
                    borderRadius: 8, fontSize: 12, color: "#15803d",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <span style={styles.spinner(12, "#15803d")} />
                    Recherche d'images illustratives sur Wikipedia (gratuit)…
                  </div>
                )}
              </div>
            )}

            {/* ── ÉTAPE 3 : Prévisualisation ── */}
            {step === "preview" && (
              <>
                <div style={styles.alert("success")}>
                  ✅ <strong>{previewTotal} critères détectés</strong> dans « {file?.name} »
                  {imagesFound > 0 && (
                    <> — 🖼️ <strong>{imagesFound} image{imagesFound > 1 ? "s" : ""}</strong> trouvée{imagesFound > 1 ? "s" : ""} automatiquement</>
                  )}
                  {hasErrors && <><br/>⚠️ Certains critères nécessitent une attention (voir aperçu)</>}
                </div>

                {/* Stats */}
                <div style={styles.statsRow}>
                  {stats.map((st) => (
                    <span key={st.type} style={styles.statPill(st.color, st.count)}>
                      {st.label} : {st.count}
                    </span>
                  ))}
                  {imagesFound > 0 && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      background: "#f0fdf4", color: "#15803d",
                      border: "1px solid #bbf7d0", borderRadius: 20,
                      padding: "3px 12px", fontSize: 13, fontWeight: 600,
                    }}>
                      🖼️ {imagesFound} image{imagesFound > 1 ? "s" : ""} auto
                    </span>
                  )}
                </div>

                {/* Rappel processus */}
                <div style={styles.field}>
                  <label style={styles.label}>{ts('sprint2.checklist.landing.targetProcessLabel', 'Importer dans *')}</label>
                  <select style={styles.select} value={procId} onChange={(e) => setProcId(e.target.value)}>
                    <option value="">— Sélectionner —</option>
                    {filteredProcessus.map((pr) => (
                      <option key={pr.id} value={String(pr.id)}>{pr.nom}</option>
                    ))}
                  </select>
                </div>

                {/* Aperçu liste */}
                <div style={styles.previewBox}>
                  <div style={styles.previewHeader}>Aperçu des critères extraits</div>
                  {parsed.map((c, i) => {
                    const isValid = c._validation?.valid;
                    return (
                      <div 
                        key={i} 
                        className="preview-item"
                        style={styles.previewItem(i, hoveredPreview === i)}
                        onMouseEnter={() => setHoveredPreview(i)}
                        onMouseLeave={() => setHoveredPreview(-1)}
                        title={!isValid ? c._validation?.errors?.join("\n") : undefined}
                      >
                        <div style={styles.previewRow}>
                          {/* Miniature image Wikipedia — masquée si pas d'image */}
                          {c.image ? (
                            <div style={{ position: "relative", flexShrink: 0 }} title="Image illustrative trouvée automatiquement (Wikipedia)">
                              <img
                                src={c.image}
                                alt={c.nomPreview || c.nom}
                                style={{
                                  width: 56, height: 56, objectFit: "cover",
                                  borderRadius: 10, flexShrink: 0,
                                  border: "2px solid #bbf7d0",
                                  background: "var(--bg-3)",
                                  display: "block",
                                }}
                                onError={(e) => { e.target.parentElement.style.display = "none"; }}
                              />
                              <span style={{
                                position: "absolute", bottom: -4, right: -4,
                                background: "#15803d", color: "#fff",
                                borderRadius: "50%", width: 16, height: 16,
                                fontSize: 9, display: "flex", alignItems: "center",
                                justifyContent: "center", fontWeight: 700,
                                boxShadow: "0 1px 3px rgba(0,0,0,.3)",
                              }}>🖼</span>
                            </div>
                          ) : (
                            <div style={{
                              width: 56, height: 56, flexShrink: 0,
                              borderRadius: 10, border: "1.5px dashed var(--bd-1)",
                              background: "var(--bg-2)", display: "flex",
                              alignItems: "center", justifyContent: "center",
                              fontSize: 20, color: "var(--text-3)",
                            }} title="Aucune image trouvée pour ce critère">
                              📋
                            </div>
                          )}
                          <span style={styles.previewBadge(c.type)}>
                            {c.type === "QUALITE" ? "✓" : c.type === "TECHNIQUE" ? "⚙" : "⚠"} {TYPE_LABELS[c.type] || c.type}
                          </span>
                          <div style={styles.previewContent}>
                            <div style={{...styles.previewFr, opacity: isValid ? 1 : 0.7}}>
                              {c.nomPreview || c.nom}
                            </div>

                            {/* Arabic line (RTL) */}
                            {(c.nomArPreview || c.nomAr) && (
                              <div style={styles.previewAr}>{c.nomArPreview || c.nomAr}</div>
                            )}

                            {/* English / German compact lines for QA review */}
                            <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              {c.nomEn && (
                                <div style={{ fontSize: 12, color: 'var(--tx-4)' }} title={c.nomEn}>
                                  EN: <span style={{ fontWeight: 600 }}>{c.nomEn}</span>
                                </div>
                              )}
                              {c.nomDe && (
                                <div style={{ fontSize: 12, color: 'var(--tx-4)' }} title={c.nomDe}>
                                  DE: <span style={{ fontWeight: 600 }}>{c.nomDe}</span>
                                </div>
                              )}

                              {/* Indicateur source arabe */}
                              {((c._original && (c._original.nomAr || c._original.descriptionAr)) || c.nomAr) && (
                                <div style={{ fontSize: 11, color: '#0f172a', background: '#eef2ff', padding: '4px 8px', borderRadius: 8, fontWeight:700 }}>
                                  AR: extrait backend
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={styles.previewMeta}>
                          <span style={styles.previewMetaTag(c.categorie)}>📁 {c.categorie}</span>
                          <span style={styles.previewMetaTag(c.couleur === "Rouge" ? "#ef4444" : "#eab308")}>
                            {c.couleur === "Rouge" ? "🔴" : "🟡"} {c.couleur}
                          </span>
                          <span style={styles.previewMetaTag()}>👁 {MOYEN_LABELS[c.moyenVerification] || c.moyenVerification}</span>
                          {c.image && (
                            <span style={{...styles.previewMetaTag(), background: "#f0fdf4", color: "#15803d"}}>
                              🖼️ Image auto
                            </span>
                          )}
                          {!isValid && (
                            <span style={{...styles.previewMetaTag("#ef4444"), background: "#fef2f2"}}>
                              ⚠️ Validation
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── ÉTAPE 4 : Import en cours ── */}
            {step === "importing" && (
              <div style={styles.progressWrap}>
                <div style={styles.progressHeader}>
                  <span style={styles.progressText}>
                    <span style={styles.spinner(16, "#6366f1")} />
                    {progressMsg}
                  </span>
                  <span style={styles.progressPct}>{progress}%</span>
                </div>
                <div style={styles.progressBg}>
                  <div style={styles.progressBar(progress)} />
                </div>
                <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 8, textAlign: "center" }}>
                  {imageGenStep ? (
                    <span style={{ color: "#7c3aed", fontWeight: 700 }}>
                      🖼️ Génération des images manquantes : {imageGenCount}/{(parsed.filter(c => !c.image).length)} — veuillez patienter…
                    </span>
                  ) : (
                    <>{imported} / {parsed.length} critères • Lot {Math.min(Math.ceil((imported + importErrors.length) / CONFIG.BATCH_SIZE), Math.ceil(parsed.length / CONFIG.BATCH_SIZE))}/{Math.ceil(parsed.length / CONFIG.BATCH_SIZE)}</>
                  )}
                </div>
              </div>
            )}

            {/* ── ÉTAPE 5 : Succès ── */}
            {step === "done" && (
              <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
                <div style={styles.successIcon}>🎉</div>
                <div style={{ fontSize: 19, fontWeight: 900, color: "var(--tx-1)", marginBottom: 8 }}>
                  Import réussi !
                </div>
                <div style={{ fontSize: 14, color: "var(--tx-3)", marginBottom: 22 }}>
                  <strong>{imported}</strong> critère(s) importé(s) depuis « {file?.name} »
                  {(imagesFound + imageGenCount) > 0 && (
                    <div style={{ marginTop: 6, fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>
                      🖼️ {imagesFound + imageGenCount} image(s) générée(s) sur {imported}
                      {imagesFound + imageGenCount < imported && (
                        <span style={{ color: "var(--tx-4)", fontWeight: 400 }}> — les autres peuvent être ajoutées via "Régénérer IA"</span>
                      )}
                    </div>
                  )}
                </div>
                <div style={styles.statsRow}>
                  {stats.map((st) => (
                    <span key={st.type} style={{...styles.statPill(st.color, st.count), margin: "0 4px"}}>
                      {st.label} : {st.count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── ÉTAPE 5b : Succès partiel ── */}
            {step === "done-with-errors" && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--tx-1)", marginBottom: 6 }}>
                  Import partiellement réussi
                </div>
                <div style={{ fontSize: 14, color: "var(--tx-3)", marginBottom: 16 }}>
                  ✅ <strong>{imported}</strong> importés • ❌ <strong>{importErrors.length}</strong> échoués
                </div>
                
                {importErrors.length > 0 && (
                  <div style={{ 
                    background: "#fef2f2", border: "1px solid #fecaca", 
                    borderRadius: 12, padding: "12px 16px", textAlign: "left",
                    fontSize: 12, color: "#dc2626", marginBottom: 16, maxHeight: 120, overflowY: "auto"
                  }}>
                    <strong>Erreurs :</strong>
                    <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                      {importErrors.slice(0, 5).map((err, i) => (
                        <li key={i} style={{ marginBottom: 4 }}>
                          #{err.index + 1} « {err.nom} » : {err.error}
                        </li>
                      ))}
                      {importErrors.length > 5 && (
                        <li style={{ fontStyle: "italic", color: "#991b1b" }}>
                          + {importErrors.length - 5} autre(s)…
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── FOOTER ── */}
          <div style={styles.footer}>
            {step === "done" ? (
              <button
                className="im-btn"
                style={styles.btnPrimary}
                  onClick={() => onImport?.(procId, file, file?.name)}
              >
                ✓ Voir les critères
              </button>
            ) : step === "done-with-errors" ? (
              <>
                <button style={styles.btnCancel} onClick={handleClose}>Fermer</button>
                <button
                  className="im-btn"
                  style={styles.btnPrimary}
                  onClick={() => onImport?.(procId, file, file?.name)}
                >
                  ✓ Voir les critères importés
                </button>
              </>
            ) : (
              <>
                <button 
                  className="im-btn" 
                  style={styles.btnCancel} 
                  onClick={handleClose}
                  disabled={step === "parsing" || step === "importing"}
                >
                  Annuler
                </button>

                {(step === "idle" || step === "error") && (
                  <button
                    className="im-btn"
                    style={{ 
                      ...styles.btnPrimary, 
                      ...(canParse ? {} : styles.btnPrimaryDisabled) 
                    }}
                    disabled={!canParse}
                    onClick={handleParse}
                  >
                    {step === "parsing" ? <span style={styles.spinner(14, "#fff")} /> : "🔍"}
                    Analyser le PDF
                  </button>
                )}

                {step === "preview" && (
                  <>
                    <button
                      className="im-btn"
                      style={styles.btnGhost}
                      onClick={handleReset}
                    >
                      ↩ Recommencer
                    </button>
                    <button
                      className="im-btn"
                      style={{ 
                        ...styles.btnPrimary, 
                        ...(canImport ? {} : styles.btnPrimaryDisabled) 
                      }}
                      disabled={!canImport}
                      onClick={handleImport}
                    >
                      {step === "importing" ? <span style={styles.spinner(14, "#fff")} /> : "📥"}
                      Importer {parsed.length} critère(s)
                    </button>
                  </>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}