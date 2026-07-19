import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";
import { useOperateurSession } from "../../components/Operateursessioncontext";
import Pagination from "../../components/Pagination";
import { useI18n } from "../../context/I18nContext";
import { getCritereNom, getCritereDescription } from "../../utils/critereUtils";
import {
  getCriteresByProcessus,
  getAllProcessus,
  soumettreChecklist,
  getMonProfil,
  getAllChecklists,
  utilisateurAPI,
  planActionAPI,
  getMachinesByProcessus,   
} from "../../api";
/* ─────────────────────────────────────────────── constants ── */
const SESSION_META_BASE = [
  { value: "M", labelKey: "operator.sessions.morning", hoursKey: "operator.sessions.morningHours", icon: "🌅", accent: "#d97706", soft: "#fffbeb", ring: "#fcd34d", gradient: "linear-gradient(135deg,#fef3c7,#fffbeb)" },
  { value: "S", labelKey: "operator.sessions.evening", hoursKey: "operator.sessions.eveningHours", icon: "🌆", accent: "#4f46e5", soft: "#eef2ff", ring: "#a5b4fc", gradient: "linear-gradient(135deg,#e0e7ff,#eef2ff)" },
  { value: "N", labelKey: "operator.sessions.night",   hoursKey: "operator.sessions.nightHours",   icon: "🌙", accent: "#1e293b", soft: "#f1f5f9", ring: "#94a3b8", gradient: "linear-gradient(135deg,#e2e8f0,#f1f5f9)" },
];

const RESULTATS_BASE = {
  VERT:  { labelKey: "operator.results.conforme",    icon: "✓", bg: "#f0fdf4", color: "#15803d", border: "#86efac", dot: "#16a34a" },
  JAUNE: { labelKey: "operator.results.watch",       icon: "⚠", bg: "#fefce8", color: "#a16207", border: "#fde047", dot: "#ca8a04" },
  ROUGE: { labelKey: "operator.results.nonconforme", icon: "✕", bg: "#fff1f2", color: "#be123c", border: "#fda4af", dot: "#e11d48" },
  NA:    { labelKey: "operator.results.na",          icon: "–", bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#94a3b8" },
};

const RESULT_BUTTON_ORDER = ["VERT", "ROUGE", "NA"];

const RESULT_BUTTON_LABELS = {
  VERT: "1",
  JAUNE: "0",
  ROUGE: "0",
  NA: "NA",
};

const NON_CONFORME_FLAG = {
  rouge: { bg: "#ef4444", text: "#fff", shadow: "rgba(239,68,68,0.35)" },
  jaune: { bg: "#f59e0b", text: "#111827", shadow: "rgba(245,158,11,0.35)" },
};

const TYPE_META_BASE = {
  SECURITE:  { labelKey: "operator.types.security",  color: "#dc2626", bg: "#fff1f2",  icon: "🛡️", accentBg: "rgba(220,38,38,0.06)" },
  QUALITE:   { labelKey: "operator.types.quality",   color: "#059669", bg: "#f0fdf4",  icon: "🎯", accentBg: "rgba(5,150,105,0.06)" },
  TECHNIQUE: { labelKey: "operator.types.technical", color: "#2563eb", bg: "#eff6ff",  icon: "⚙️", accentBg: "rgba(37,99,235,0.06)" },
};

// ── Flux : 3 étapes ──
const STEPS = ["session", "machine", "checklist"];
const STEP_META_BASE = [
  { key: "session",   labelKey: "operator.steps.session",   icon: "⏱"  },
  { key: "machine",   labelKey: "operator.steps.machine",   icon: "⚙️" },
  { key: "checklist", labelKey: "operator.steps.checklist", icon: "📋" },
];

const VALIDATION_STEPS_BASE = [
  { key: "SOUMIS",       labelKey: "status.checklist.submitted",     icon: "📤", color: "#3b82f6" },
  { key: "VALIDE_N1",    labelKey: "status.checklist.validatedN1",   icon: "✅", color: "#7c3aed" },
  { key: "VALIDE_N2",    labelKey: "status.checklist.validatedN2",   icon: "✅", color: "#0284c7" },
  { key: "VALIDE_FINAL", labelKey: "status.checklist.validatedFinal",icon: "🏆", color: "#16a34a" },
];

function extractApiError(err, fallbackMessage, t) {
  const status = err?.response?.status;
  const data   = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    for (const k of ["message","erreur","error","detail","title"]) {
      if (typeof data[k] === "string" && data[k].trim()) return data[k];
    }
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      const text = data.errors.map(e => typeof e === "string" ? e : e?.message).filter(Boolean).join(" | ");
      if (text) return text;
    }
  }
  if (!err?.response) return err?.message?.trim() || t("operator.errors.serverUnreachable");
  if (status === 401) return t("operator.errors.sessionExpired");
  if (status === 403) return t("operator.errors.accessDenied");
  if (status) return `${fallbackMessage} (HTTP ${status})`;
  try { return data && typeof data === "object" ? JSON.stringify(data) : fallbackMessage; } catch { return fallbackMessage; }
}

function resolveCritereImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const clean = rawUrl.trim().replace(/\\/g, "/");
  if (!clean) return "";
  if (clean.startsWith("data:image/")) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  const apiBase      = api.defaults?.baseURL || `${window.location.origin}/api`;
  const backendOrigin = String(apiBase).replace(/\/api\/?$/, "");
  const uploadsIndex = clean.toLowerCase().indexOf("/uploads/");
  if (uploadsIndex >= 0) return `${backendOrigin}${clean.slice(uploadsIndex)}`;
  if (clean.startsWith("uploads/"))    return `${backendOrigin}/${clean}`;
  if (clean.startsWith("/api/uploads/")) return `${backendOrigin}${clean.slice(4)}`;
  if (clean.startsWith("/"))           return `${backendOrigin}${clean}`;
  return `${backendOrigin}/${clean}`;
}

function normalizeCritereCouleur(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "jaune") return "jaune";
  if (value === "rouge") return "rouge";
  return "rouge";
}

function normalizeProcessName(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/* ══════════════════════════════════════ COMPOSANT PRINCIPAL ══ */
export default function OperateurChecklistPage() {
  const { user }             = useAuth();
  const { setActiveSession } = useOperateurSession();
  const { t, lang } = useI18n();
  const navigate   = useNavigate();
  const translate  = (value) => value;
  const scrollRef  = useRef(null);
  const startTimeRef = useRef(Date.now());

  const [submittedChecklistId, setSubmittedChecklistId] = useState(null);
  const [existingChecklistId,  setExistingChecklistId]  = useState(null);

  const [step,     setStep]     = useState("session");
  const [session,  setSession]  = useState(null);
  const [selProc,  setSelProc]  = useState(null);
  const [criteres, setCriteres] = useState([]);
  const [reponses, setReponses] = useState({});
  const [loading,  setLoading]  = useState(false);
  const [fetchingCriteres, setFetchingCriteres] = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");
  const [requestingNc, setRequestingNc] = useState(false);
  const [requestNcResult, setRequestNcResult] = useState(null);
  const [activeType, setActiveType] = useState(null);
  const [critPage,   setCritPage]   = useState(1);
  const CRIT_PAGE_SIZE = 20;

  // ── Machine selection state ──
  const [machines,        setMachines]        = useState([]);
  const [fetchingMachines, setFetchingMachines] = useState(false);
  const [selMachine,      setSelMachine]      = useState(null);
  const [machineSearch,   setMachineSearch]   = useState("");

  // ── État : opérateur a déjà soumis aujourd'hui pour ce processus ──
  const [dejasoumisAujourdhui, setDejasoumisAujourdhui] = useState(false);
  const [checkingEtat, setCheckingEtat] = useState(false);
  const [checklistsCache, setChecklistsCache] = useState([]);
  const [showConsignes, setShowConsignes] = useState(false);
  const [draftExists, setDraftExists] = useState(false);
  const [draftData,   setDraftData]   = useState(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [autoRestoreDisabled, setAutoRestoreDisabled] = useState(false);
  const [showUssModal, setShowUssModal] = useState(false);
  const [ussVariant, setUssVariant] = useState(null);

  const handleSetActiveType = (tp) => { setActiveType(tp); setCritPage(1); };
  const isAr = lang === "ar";

  const locale   = lang === "ar" ? "ar-MA" : lang === "en" ? "en-US" : "fr-FR";
  const today    = new Date().toLocaleDateString(locale, { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const todayISO = new Date().toISOString().split("T")[0];

  const sessions  = useMemo(() => SESSION_META_BASE.map(s => ({ ...s, label: t(s.labelKey), hours: t(s.hoursKey) })), [t]);
  const resultats = useMemo(() => { const o={}; Object.entries(RESULTATS_BASE).forEach(([k,v])=>{ o[k]={...v,label:t(v.labelKey)}; }); return o; }, [t]);
  const VALIDATION_STEPS = useMemo(() => VALIDATION_STEPS_BASE.map(s => ({ ...s, label: t(s.labelKey) })), [t]);
  const typeMeta  = useMemo(() => { const o={}; Object.entries(TYPE_META_BASE).forEach(([k,v])=>{ o[k]={...v,label:t(v.labelKey)}; }); return o; }, [t]);
  const stepMeta  = useMemo(() => STEP_META_BASE.map(s => ({ ...s, label: t(s.labelKey) ?? s.key })), [t]);

  useEffect(() => {
    if (!user?.id) return;
    const operateurId = Number(user.id);
    getAllChecklists()
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        setChecklistsCache(all);
        const submitted = all.find(
          c =>
            Number(c.operateurId) === operateurId &&
            String(c.date ?? "").startsWith(todayISO) &&
            String(c.status ?? c.statut ?? "") !== "EN_COURS"
        );
        if (submitted) {
          setDejasoumisAujourdhui(true);
          if (submitted.id) setExistingChecklistId(submitted.id);
        }
      })
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line

  // Sync session label on lang change
  useEffect(() => {
    if (!session) return;
    const updated = sessions.find(s => s.value === session.value);
    if (updated && updated.label !== session.label) { setSession(updated); setActiveSession(updated); }
  }, [lang, session, sessions, setActiveSession]);

  /* ── Résoudre le processus de l'opérateur ── */
  useEffect(() => {
    let cancelled = false;
    const resolveAndApply = async (procIdRaw, procNomRaw = "") => {
      const procId  = Number(procIdRaw);
      const procNom = String(procNomRaw || "").trim();
      if (Number.isFinite(procId) && procId > 0) {
        if (!cancelled) {
          setSelProc({ id: procId, nom: procNom });
          const normalized = normalizeProcessName(procNom);
          if (normalized.includes("uss") && !ussVariant) setShowUssModal(true);
        }
        return true;
      }
      if (!procNom) return false;
      try {
        const res  = await getAllProcessus();
        const list = Array.isArray(res?.data) ? res.data : [];
        const wanted = normalizeProcessName(procNom);
        const found  = list.find(p => normalizeProcessName(p?.nom) === wanted);
        const fid    = Number(found?.id);
        if (Number.isFinite(fid) && fid > 0 && !cancelled) {
          setSelProc({ id: fid, nom: found?.nom || procNom });
          const normalized = normalizeProcessName(found?.nom || procNom);
          if (normalized.includes("uss") && !ussVariant) setShowUssModal(true);
          return true;
        }
      } catch (_) {}
      return false;
    };

    if (!user) return () => { cancelled = true; };
    const procIdFromSession  = user.processusId || user.processus?.id;
    const procNomFromSession = user.processusNom || user.processus?.nom || "";

    (async () => {
      const ok = await resolveAndApply(procIdFromSession, procNomFromSession);
      if (ok || cancelled) return;
      try {
        const res     = await getMonProfil();
        const profile = res?.data || {};
        await resolveAndApply(profile.processusId || profile.processus?.id, profile.processusNom || profile.processus?.nom || "");
      } catch (_) {}
    })();

    return () => { cancelled = true; };
  }, [user, ussVariant]);

  /* ── Charger les machines dès que processus est connu ── */
  useEffect(() => {
  if (!selProc?.id) return;
  let cancelled = false;
  setFetchingMachines(true);
  setSelMachine(null);
  setMachineSearch("");

  getMachinesByProcessus(selProc.id)   // ← remplace api.get(...)
    .then(res => {
      if (cancelled) return;
      const all = Array.isArray(res.data) ? res.data : [];

      const opSiteId  = Number(user?.siteId  || user?.site?.id);
      const opPlantId = Number(user?.plantId || user?.plant?.id);

      const filtered = all.filter(m => {
        const matchSite  = !opSiteId  || Number(m.siteId)  === opSiteId;
        const matchPlant = !opPlantId || Number(m.plantId) === opPlantId;
        return matchSite && matchPlant;
      });

      setMachines(filtered.length > 0 ? filtered : all);
    })
    .catch(() => { if (!cancelled) setMachines([]); })
    .finally(() => { if (!cancelled) setFetchingMachines(false); });

  return () => { cancelled = true; };
}, [selProc?.id, user?.siteId, user?.plantId]);
  /* ── Charger les critères dès que processus + session + machine sont connus ── */
  useEffect(() => {
    if (!selProc?.id || !session?.value || !selMachine?.id) return;

    let cancelled = false;
    setFetchingCriteres(true);
    setCheckingEtat(true);
    setDejasoumisAujourdhui(false);
    setExistingChecklistId(null);

    const operateurId = Number(user?.id);

    Promise.all([
      getCriteresByProcessus(Number(selProc.id), ussVariant),
      getAllChecklists(),
    ])
      .then(([critRes, allRes]) => {
        if (cancelled) return;

        const list = Array.isArray(critRes.data) ? critRes.data : [];
        setCriteres(list);
        const init = {};
        list.forEach(c => { init[c.id] = { valeur: "VERT", commentaire: "" }; });
        setReponses(init);
        const types = [...new Set(list.map(c => c.type).filter(Boolean))];
        setActiveType(types[0] || null);

        const all = Array.isArray(allRes.data) ? allRes.data : [];
        setChecklistsCache(all);

        // Vérifier unicité journalière par machine
        const submitted = all.find(
          c =>
            Number(c.operateurId) === operateurId &&
            Number(c.machineId)   === Number(selMachine.id) &&
            String(c.date ?? "").startsWith(todayISO) &&
            String(c.status ?? c.statut ?? "") !== "EN_COURS"
        );
        if (submitted) {
          setDejasoumisAujourdhui(true);
          if (submitted.id) setExistingChecklistId(submitted.id);
        }
      })
      .catch(() => {
        if (cancelled) return;
        getCriteresByProcessus(Number(selProc.id), ussVariant).then(r => {
          const list = Array.isArray(r.data) ? r.data : [];
          setCriteres(list);
          const init = {};
          list.forEach(c => { init[c.id] = { valeur: "VERT", commentaire: "" }; });
          setReponses(init);
          setActiveType([...new Set(list.map(c => c.type).filter(Boolean))][0] || null);
        }).catch(() => {});
      })
      .finally(() => {
        if (!cancelled) { setFetchingCriteres(false); setCheckingEtat(false); }
      });

    return () => { cancelled = true; };
  }, [selProc?.id, session?.value, selMachine?.id, ussVariant]); // ← ussVariant ajouté aux dépendances

  /* ── Draft autosave ── */
  const autosaveRef = useRef({});
  autosaveRef.current = { selProc, session, reponses, ussVariant, selMachine, userId: user?.id };

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const { selProc: sp, session: se, reponses: rp, ussVariant: uv, selMachine: sm, userId } = autosaveRef.current;
        const payload = {
          timestamp: Date.now(),
          selProc:   sp ? { id: sp.id, nom: sp.nom } : null,
          session:   se ? { value: se.value, label: se.label } : null,
          selMachine: sm ? { id: sm.id, nom: sm.nom } : null,
          reponses:  rp,
          ussVariant: uv,
        };
        const raw = localStorage.getItem("operateur_checklist_drafts_v1");
        const all = raw ? (JSON.parse(raw) || {}) : {};
        all[String(userId || "anon")] = payload;
        localStorage.setItem("operateur_checklist_drafts_v1", JSON.stringify(all));
      } catch (_) {}
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ── Préférences consignes + reprise de brouillon ── */
  useEffect(() => {
    try {
      const raw  = localStorage.getItem("operateur_checklist_prefs_v1");
      const prefs = raw ? (JSON.parse(raw) || {}) : {};
      const mineP = prefs[String(user?.id)] || {};
      if (mineP && typeof mineP.showConsignes === "boolean") setShowConsignes(Boolean(mineP.showConsignes));
      if (mineP && typeof mineP.autoRestoreDisabled === "boolean") setAutoRestoreDisabled(Boolean(mineP.autoRestoreDisabled));
    } catch (_) {}

    try {
      const raw2 = localStorage.getItem("operateur_checklist_drafts_v1");
      if (!raw2) return;
      const all2 = JSON.parse(raw2 || "{}") || {};
      const mine2 = all2[String(user?.id)];
      if (!mine2 || !mine2.timestamp) return;
      setDraftExists(true);
      setDraftData(mine2);
      const rawPrefs = localStorage.getItem("operateur_checklist_prefs_v1");
      const prefsAll = rawPrefs ? (JSON.parse(rawPrefs) || {}) : {};
      const minePref  = prefsAll[String(user?.id)] || {};
      const disabled = Boolean(minePref.autoRestoreDisabled);
      setAutoRestoreDisabled(disabled);
      if (!disabled) {
        if (mine2.selProc)    setSelProc(mine2.selProc);
        if (mine2.session)   { setSession(mine2.session); setActiveSession(mine2.session); }
        if (mine2.selMachine) setSelMachine(mine2.selMachine);
        if (mine2.reponses)   setReponses(mine2.reponses);
        if (mine2.ussVariant) setUssVariant(mine2.ussVariant);
        setDraftLoaded(true);
      }
    } catch (_) {}
  }, [user?.id]); // eslint-disable-line

  const toggleConsignes = () => {
    const next = !showConsignes;
    setShowConsignes(next);
    try {
      const raw  = localStorage.getItem("operateur_checklist_prefs_v1");
      const all  = raw ? (JSON.parse(raw) || {}) : {};
      const mine = all[String(user?.id)] || {};
      mine.showConsignes = next;
      all[String(user?.id)] = mine;
      localStorage.setItem("operateur_checklist_prefs_v1", JSON.stringify(all));
    } catch (_) {}
  };

  const handleRestoreDraft = () => {
    if (!draftData) return;
    if (draftData.selProc)    setSelProc(draftData.selProc);
    if (draftData.session)   { setSession(draftData.session); setActiveSession(draftData.session); }
    if (draftData.selMachine) setSelMachine(draftData.selMachine);
    if (draftData.reponses)   setReponses(draftData.reponses);
    if (draftData.ussVariant) setUssVariant(draftData.ussVariant);
    setDraftLoaded(true);
  };
  const handleDeleteDraft = () => {
    try {
      const raw = localStorage.getItem("operateur_checklist_drafts_v1");
      const all = raw ? (JSON.parse(raw) || {}) : {};
      delete all[String(user?.id)];
      localStorage.setItem("operateur_checklist_drafts_v1", JSON.stringify(all));
    } catch (_) {}
    setDraftExists(false); setDraftData(null); setDraftLoaded(false);
  };
  const setAutoRestorePref = (disabled) => {
    try {
      const raw = localStorage.getItem("operateur_checklist_prefs_v1");
      const all = raw ? (JSON.parse(raw) || {}) : {};
      const mine = all[String(user?.id)] || {};
      mine.autoRestoreDisabled = disabled;
      all[String(user?.id)] = mine;
      localStorage.setItem("operateur_checklist_prefs_v1", JSON.stringify(all));
    } catch (_) {}
    setAutoRestoreDisabled(Boolean(disabled));
  };

  const goTo = useCallback((s) => {
    setStep(s);
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);
  }, []);

  /* ── Sélection de session → passe à l'étape machine ── */
  const pickSession = (s) => {
    setSession(s);
    setActiveSession(s);
    setSelMachine(null);
    goTo("machine");
  };

  /* ── Sélection de machine → passe à la checklist ── */
  const pickMachine = (m) => {
    // Vérifier si déjà soumis pour cette machine aujourd'hui
    const operateurId = Number(user?.id);
    const alreadyDone = checklistsCache.some(
      c =>
        Number(c.operateurId) === operateurId &&
        Number(c.machineId)   === Number(m.id) &&
        String(c.date ?? "").startsWith(todayISO) &&
        String(c.status ?? c.statut ?? "") !== "EN_COURS"
    );
    setSelMachine(m);
    if (alreadyDone) setDejasoumisAujourdhui(true);
    else setDejasoumisAujourdhui(false);
    goTo("checklist");
  };

  const setVal = (id, v) => setReponses(r => ({ ...r, [id]: { ...r[id], valeur: v } }));
  const setCmt = (id, v) => setReponses(r => ({ ...r, [id]: { ...r[id], commentaire: v } }));

  const nbNcRouge = criteres.filter(c => {
    const rep = reponses[c.id];
    return rep?.valeur === "ROUGE" && normalizeCritereCouleur(c.couleur || c.flag_color || c.flagColor) === "rouge";
  }).length;

  const nbNcJaune = criteres.filter(c => {
    const rep = reponses[c.id];
    return rep?.valeur === "ROUGE" && normalizeCritereCouleur(c.couleur || c.flag_color || c.flagColor) === "jaune";
  }).length;

  const submitBucket = nbNcRouge > 0 ? "ROUGE" : nbNcJaune > 0 ? "JAUNE" : "VERT";
  const critByType = criteres.reduce((acc, c) => {
    const tp = c.type || "AUTRE";
    if (!acc[tp]) acc[tp] = [];
    acc[tp].push(c);
    return acc;
  }, {});
  const types = Object.keys(critByType);

  /* ── Soumission ── */
  const handleSubmit = async () => {
    setError("");
    if (!session?.value)   { setError(t("operator.errors.sessionNotSelected")); return; }
    if (!selProc?.id)      { setError(t("operator.errors.processNotFound"));    return; }
    if (!selMachine?.id)   { setError("Veuillez sélectionner une machine."); return; }

    const operateurId = Number(user?.id);
    if (!Number.isFinite(operateurId) || operateurId <= 0) {
      setError(t("operator.errors.userNotAuthenticated"));
      return;
    }
    if (!criteres.length || !Object.keys(reponses).length) {
      setError(t("operator.errors.noResponses"));
      return;
    }

    setLoading(true);
    try {
      const freshRes = await getAllChecklists();
      const freshAll = Array.isArray(freshRes.data) ? freshRes.data : [];
      setChecklistsCache(freshAll);

      const hasAlreadySubmittedToday = freshAll.some(
        c =>
          Number(c.operateurId) === operateurId &&
          Number(c.machineId)   === Number(selMachine.id) &&
          String(c.date ?? "").startsWith(todayISO) &&
          String(c.status ?? c.statut ?? "") !== "EN_COURS"
      );
      if (hasAlreadySubmittedToday) {
        setDejasoumisAujourdhui(true);
        setError("Vous avez déjà soumis une checklist pour cette machine aujourd'hui.");
        setLoading(false);
        return;
      }
    } catch (_) {
      setLoading(false);
    }

    setLoading(true);
    try {
      const payload = {
        date:        todayISO,
        session:     session.value,
        processusId: Number(selProc.id),
        machineId:   Number(selMachine.id),
        operateurId,
        ...(user?.siteId ? { siteId: Number(user.siteId) } : {}),
        reponses: Object.entries(reponses).map(([critereId, r]) => {
          const crit = criteres.find(c => c.id === Number(critereId));
          const critCouleur = normalizeCritereCouleur(
            crit?.couleur || crit?.flag_color || crit?.flagColor
          );
          const valeurFinale =
            r.valeur === "ROUGE" && critCouleur === "jaune" ? "JAUNE" : r.valeur;
          return {
            critereId:   Number(critereId),
            valeur:      valeurFinale,
            commentaire: r.commentaire || "",
          };
        }),
        dureeFillSec: Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000)),
        ...(ussVariant && { ussVariant }),
      };

      try {
        await soumettreChecklist(payload);
      } catch (submitErr) {
        const errMsg = extractApiError(submitErr, "", t).toLowerCase();
        const isJourneeError =
          errMsg.includes("une seule fois par journ") ||
          errMsg.includes("déjà soumis une checklist aujourd") ||
          errMsg.includes("limitée à une seule fois par journée");
        if (isJourneeError) {
          setDejasoumisAujourdhui(true);
          setError("Vous avez déjà soumis une checklist pour cette machine aujourd'hui.");
          return;
        }
        throw submitErr;
      }

      try {
        const r2  = await getAllChecklists();
        const all = Array.isArray(r2.data) ? r2.data : [];
        const found = all.find(
          c =>
            Number(c.operateurId) === operateurId &&
            Number(c.machineId)   === Number(selMachine.id) &&
            String(c.date ?? "") === todayISO &&
            String(c.status ?? c.statut ?? "") !== "EN_COURS"
        );
        if (found) setSubmittedChecklistId(found.id);
      } catch (_) {}

      setSuccess(true);

      try {
        const raw = localStorage.getItem("operateur_checklist_drafts_v1");
        if (raw) {
          const all = JSON.parse(raw) || {};
          delete all[String(operateurId)];
          localStorage.setItem("operateur_checklist_drafts_v1", JSON.stringify(all));
        }
      } catch (_) {}

      // Affichage automatique du drapeau LTPM plein écran, sans action de l'opérateur :
      // dès la soumission, on redirige directement vers la page dédiée.
      try {
        const raw = localStorage.getItem("ltpm_flag_display_v1");
        const all = raw ? JSON.parse(raw) : {};
        all[selMachine?.id || "default"] = {
          bucket: submitBucket,
          machineNom: selMachine?.nom || "",
          processusNom: selProc?.nom || "",
          date: new Date().toISOString(),
          updatedAt: Date.now(),
        };
        localStorage.setItem("ltpm_flag_display_v1", JSON.stringify(all));
      } catch { /* ignore */ }
      const ltpmQuery = new URLSearchParams({
        machineId: selMachine?.id ?? "",
        machineNom: selMachine?.nom ?? "",
        processusNom: selProc?.nom ?? "",
        auto: "1",
      }).toString();
      navigate(`/checklist/operateur/drapeau?${ltpmQuery}`, { replace: true });
    } catch (err) {
      console.error("Soumission checklist échouée", { status: err?.response?.status, data: err?.response?.data });
      setError(extractApiError(err, t("operator.errors.submitFailed"), t));
    } finally {
      setLoading(false);
    }
  };

  /* ── Demande création NC ── */
  const handleRequestNcToChef = async () => {
    setRequestNcResult(null);
    setRequestingNc(true);
    try {
      const usersRes = await utilisateurAPI.findAll();
      const users = Array.isArray(usersRes.data) ? usersRes.data : [];
      const candidates = users.filter(u => u.role === 'CHEF_LIGNE' && (Number(u.siteId) === Number(user?.siteId) || Number(u.processusId) === Number(selProc?.id)));
      const chef = candidates.length ? candidates[0] : users.find(u => u.role === 'CHEF_LIGNE');

      const titre = `Demande création NC - ${selMachine?.nom || selProc?.nom || ''} - ${todayISO}`;
      const description = `Opérateur ${user?.nom || user?.matricule || user?.id} a détecté ${nbNcRouge} NC rouge et ${nbNcJaune} NC jaune sur la machine ${selMachine?.nom || ''}. Merci de créer la NC.`;

      if (chef) {
        const payload = {
          titre,
          description,
          assignedTo: chef.id,
          metadata: { type: 'DEMANDE_NC', processusId: selProc?.id || null, machineId: selMachine?.id || null, operateurId: user?.id, rouge: nbNcRouge, jaune: nbNcJaune },
        };
        await planActionAPI.creer(payload);
        setRequestNcResult({ ok: true, message: t('operator.requestNc.createdChef', { name: chef.nom || chef.matricule || chef.id }) || 'Demande envoyée au chef de ligne.' });
      } else {
        const text = `${titre}\n\n${description}`;
        await navigator.clipboard.writeText(text);
        setRequestNcResult({ ok: true, message: t('operator.requestNc.copiedToClipboard') || 'Texte copié dans le presse-papiers. Veuillez contacter le chef de ligne.' });
      }
    } catch (err) {
      console.error(err);
      setRequestNcResult({ ok: false, message: extractApiError(err, t('operator.errors.requestNcFailed'), t) });
    } finally {
      setRequestingNc(false);
    }
  };

  /* ── Bouton "Consulter ma checklist" ── */
  const consultId = submittedChecklistId || existingChecklistId;
  const BtnConsulter = ({ style = {} }) => (
    <button
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: "13px 28px", borderRadius: 14,
        background: "linear-gradient(135deg,#1e293b,#334155)",
        color: "#fff", border: "none", cursor: "pointer",
        fontSize: 15, fontWeight: 800,
        boxShadow: "0 4px 18px rgba(15,23,42,0.25)",
        transition: "opacity .2s",
        ...style,
      }}
      onClick={() =>
        consultId
          ? navigate(`/checklist/operateur/consultation?consultId=${consultId}`)
          : navigate(`/checklist/operateur/consultation`)
      }
    >
      👁️ {t("operator.success.consultBtn")}
    </button>
  );

  /* ── Filtrage machines par recherche ── */
  const filteredMachines = useMemo(() => {
    if (!machineSearch.trim()) return machines;
    const q = machineSearch.toLowerCase().trim();
    return machines.filter(
      m =>
        (m.nom || "").toLowerCase().includes(q) ||
        (m.description || "").toLowerCase().includes(q) ||
        (m.segmentNom || "").toLowerCase().includes(q)
    );
  }, [machines, machineSearch]);

  /* ─────────── ÉCRAN DE SUCCÈS ── */
  if (success) {
    const ltpmBucket = nbNcRouge > 0 ? "ROUGE" : nbNcJaune > 0 ? "JAUNE" : "VERT";
    const LTPM_CFG = {
      ROUGE: { title: "LTPM", gradient: "linear-gradient(135deg,#ef4444,#b91c1c)", glow: "0 10px 36px rgba(220,38,38,0.45)" },
      JAUNE: { title: "LTPM", gradient: "linear-gradient(135deg,#eab308,#a16207)", glow: "0 10px 36px rgba(202,138,4,0.45)" },
      VERT:  { title: "LTPM", gradient: "linear-gradient(135deg,#22c55e,#15803d)", glow: "0 10px 36px rgba(22,163,74,0.45)" },
    };
    const lcfg = LTPM_CFG[ltpmBucket];

    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "65vh", padding: "24px" }}>
        <style>{keyframes}</style>
        <style>{`@keyframes ltpmIn{from{opacity:0;transform:translateY(18px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <div style={{ maxWidth: 420, width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Machine badge */}
          {selMachine && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "#f1f5f9", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 20 }}>⚙️</span>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".5px" }}>Machine</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#1e293b" }}>{selMachine.nom}</div>
              </div>
            </div>
          )}

          {/* Carreau LTPM */}
          <div style={{
            background: lcfg.gradient, borderRadius: 20, padding: "90px 40px",
            maxWidth: 650, textAlign: "center", boxShadow: lcfg.glow,
            position: "relative", overflow: "hidden", fontSize: 42,
            animation: "ltpmIn .45s cubic-bezier(0.22,1,0.36,1) both",
          }}>
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 55%)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", width:240, height:240, background:"rgba(255,255,255,0.1)", borderRadius:"50%", bottom:-120, right:-70, pointerEvents:"none" }} />
            <div style={{ position:"relative", zIndex:1, fontSize:22, fontWeight:900, color:"#fff", fontFamily:"var(--fh)", letterSpacing:"-0.2px" }}>
              {lcfg.title}
            </div>
          </div>

          <BtnConsulter style={{ width: "100%", justifyContent: "center" }} />

          <button
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", padding: "13px 28px", borderRadius: 14,
              background: lcfg.gradient, color: "#fff", border: "none", cursor: "pointer",
              fontSize: 14.5, fontWeight: 800, boxShadow: lcfg.glow, transition: "opacity .2s",
            }}
            onClick={() => {
              try {
                const raw = localStorage.getItem("ltpm_flag_display_v1");
                const all = raw ? JSON.parse(raw) : {};
                all[selMachine?.id || "default"] = {
                  bucket: ltpmBucket,
                  machineNom: selMachine?.nom || "",
                  processusNom: selProc?.nom || "",
                  date: new Date().toISOString(),
                  updatedAt: Date.now(),
                };
                localStorage.setItem("ltpm_flag_display_v1", JSON.stringify(all));
              } catch { /* ignore */ }
              const q = new URLSearchParams({
                machineId: selMachine?.id ?? "",
                machineNom: selMachine?.nom ?? "",
                processusNom: selProc?.nom ?? "",
              }).toString();
              window.open(`/checklist/operateur/drapeau?${q}`, "_blank");
            }}
          >
            🖥️ {t("operator.success.fullscreenFlagBtn")}
          </button>

          <div style={{ background: "var(--bg-1)", borderRadius: 12, padding: "14px 16px", border: "1px solid var(--bd-1)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 12 }}>
              {t("operator.success.validationTracking")}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              {VALIDATION_STEPS.map((vs, idx) => {
                const done    = idx === 0;
                const current = idx === 0;
                return (
                  <div key={vs.key} style={{ display: "flex", alignItems: "center", flex: idx < VALIDATION_STEPS.length - 1 ? 1 : "0 0 auto" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: done ? 13 : 11, fontWeight: 700,
                        background: done ? vs.color : "#f1f5f9",
                        color: done ? "#fff" : "#94a3b8",
                        border: current ? `3px solid ${vs.color}` : "2px solid transparent",
                        boxShadow: done ? `0 3px 10px ${vs.color}40` : "none",
                      }}>
                        {done ? vs.icon : idx + 1}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: done ? 700 : 500, color: done ? vs.color : "#94a3b8", textAlign: "center" }}>
                        {vs.label}
                      </span>
                    </div>
                    {idx < VALIDATION_STEPS.length - 1 && (
                      <div style={{ height: 2, flex: 1, background: idx === 0 ? vs.color : "#e2e8f0", borderRadius: 2, margin: "0 4px 18px" }} />
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "7px 12px", background: "#fef9c3", borderRadius: 8, border: "1px solid #fde047", fontSize: 12, color: "#854d0e", fontWeight: 600 }}>
              ⏳ {t("operator.success.waitingChef")}
            </div>
          </div>

        </div>
      </div>
    );
  }

  const stepIdx = STEPS.indexOf(step);
  const draftDateStr = draftData?.timestamp ? new Date(draftData.timestamp).toLocaleDateString(locale) : null;

  /* ─────────── RENDU PRINCIPAL ── */
  return (
    <div style={S.page}>
      <style>{keyframes}</style>

      {/* ════ USS VARIANT MODAL ════ */}
      {showUssModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center",
          justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease",
        }}>
          <div style={{
            background: "white", borderRadius: 20, padding: "40px 32px",
            maxWidth: 500, width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "slideUp 0.3s ease",
          }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
              <h2 style={{ fontSize: 24, fontWeight: 900, color: "var(--tx-1)", marginBottom: 8 }}>
                Sélectionner le type USS
              </h2>
              <p style={{ fontSize: 14, color: "var(--tx-3)", lineHeight: 1.6 }}>
                Vous êtes assigné au processus USS. Veuillez choisir le type :
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              <button
                onClick={() => { setUssVariant("USS"); setShowUssModal(false); }}
                style={{ padding: "16px 20px", borderRadius: 12, border: "2px solid #059669", background: "#f0fdf4", color: "#059669", fontSize: 16, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#dcfce7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#f0fdf4"; }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>✓ USS (Standard)</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Processus USS standard</div>
              </button>
              <button
                onClick={() => { setUssVariant("USS_CONTACT"); setShowUssModal(false); }}
                style={{ padding: "16px 20px", borderRadius: 12, border: "2px solid #3b82f6", background: "#eff6ff", color: "#3b82f6", fontSize: 16, fontWeight: 700, cursor: "pointer", textAlign: "left" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#eff6ff"; }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>📞 USS sur contact</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>Processus USS sur contact</div>
              </button>
            </div>
            {ussVariant && (
              <div style={{ padding: "12px 16px", borderRadius: 8, background: "#f0fdf4", color: "#059669", fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                ✓ Vous avez sélectionné: <strong>{ussVariant === "USS" ? "USS (Standard)" : "USS sur contact"}</strong>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ ...S.container, fontFamily: isAr ? "var(--fa)" : "var(--fd)" }} ref={scrollRef}>

        {/* ══ STEPPER (3 étapes) ══ */}
        <div style={S.stepper}>
          {stepMeta.map((sm, i) => {
            const done   = i < stepIdx;
            const active = sm.key === step;
            return (
              <div key={sm.key} style={S.stepItem}>
                <div style={{ ...S.stepDot, ...(active ? S.stepDotActive : done ? S.stepDotDone : {}) }}>
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <div style={S.stepInfo}>
                  <span style={{ ...S.stepLabel, ...(active ? S.stepLabelActive : done ? S.stepLabelDone : {}) }}>
                    {sm.label}
                  </span>
                </div>
                {i < stepMeta.length - 1 && (
                  <div style={{ ...S.stepLine, ...(done ? S.stepLineDone : {}) }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ══ STEP 1 : SESSION ══ */}
        {step === "session" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div style={S.panelHeaderIcon}>⏱</div>
              <div>
                <h2 style={S.panelTitle}>{t("operator.steps.sessionTitle")}</h2>
                <p style={S.panelSub}>{t("operator.steps.sessionSubtitle")}</p>
              </div>
            </div>
            <div style={S.shiftGrid}>
              {sessions.map(s => {
                const isSelected = session?.value === s.value;
                return (
                  <button key={s.value} onClick={() => pickSession(s)} style={{
                    ...S.shiftCard,
                    background: isSelected ? s.gradient : "var(--bg-1)",
                    border: `2px solid ${isSelected ? s.ring : "var(--bd-1)"}`,
                    boxShadow: isSelected ? `0 8px 24px ${s.ring}60` : S.shiftCard.boxShadow,
                    transform: isSelected ? "translateY(-3px)" : "none",
                  }}>
                    <div style={S.shiftEmoji}>{s.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.accent, fontFamily: "var(--fh)", lineHeight: 1 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "var(--tx-4)", marginTop: 4, letterSpacing: ".4px" }}>{s.hours}</div>
                    {isSelected && (
                      <div style={{ ...S.shiftCheck, background: s.accent }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ STEP 2 : MACHINE ══ */}
        {step === "machine" && (
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <div style={{ ...S.panelHeaderIcon, background: "linear-gradient(135deg,#dbeafe,#ffffff)", borderColor: "#bfdbfe", boxShadow: "0 6px 16px rgba(59,130,246,0.18)" }}>
                ⚙️
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={S.panelTitle}>Sélectionner la machine</h2>
                <p style={S.panelSub}>
                  {selProc?.nom && <span style={{ fontWeight: 700, color: "var(--l5)" }}>{translate(selProc.nom)}</span>}
                  {selProc?.nom && " · "}
                  Session <strong>{session?.label}</strong>
                </p>
              </div>
              <button style={S.btnBack} onClick={() => goTo("session")}>← {t("common.back")}</button>
            </div>

            {/* Chargement */}
            {fetchingMachines && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "32px 0", color: "var(--tx-3)", fontSize: 14 }}>
                <div style={S.spinner} />
                Chargement des machines...
              </div>
            )}

            {/* Aucune machine */}
            {!fetchingMachines && machines.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--tx-4)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
                <p style={{ fontSize: 14 }}>Aucune machine trouvée pour ce processus.</p>
                <p style={{ fontSize: 12, color: "var(--tx-5)" }}>Contactez votre administrateur.</p>
              </div>
            )}

            {/* Liste machines */}
            {!fetchingMachines && machines.length > 0 && (
              <>
                {/* Barre de recherche */}
                {machines.length > 4 && (
                  <div style={{ position: "relative", marginBottom: 16 }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--tx-4)", pointerEvents: "none" }}>🔍</span>
                    <input
                      type="text"
                      value={machineSearch}
                      onChange={e => setMachineSearch(e.target.value)}
                      placeholder="Rechercher une machine..."
                      style={{
                        width: "100%", padding: "11px 14px 11px 42px",
                        border: "1.5px solid var(--bd-1)", borderRadius: 12,
                        fontSize: 14, color: "var(--tx-1)", background: "#fff",
                        outline: "none", boxSizing: "border-box",
                        fontFamily: "var(--fd)",
                        boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    />
                  </div>
                )}

                {/* Compteur */}
                <div style={{ fontSize: 12, color: "var(--tx-4)", marginBottom: 12, fontWeight: 600 }}>
                  {filteredMachines.length} machine{filteredMachines.length !== 1 ? "s" : ""} disponible{filteredMachines.length !== 1 ? "s" : ""}
                  {(user?.siteId || user?.plantId) && (
                    <span style={{ marginLeft: 8, color: "var(--l5)" }}>
                      · filtrées selon votre site/plant
                    </span>
                  )}
                </div>

                <div style={S.machineGrid}>
                  {filteredMachines.map(m => {
                    const isSelected = selMachine?.id === m.id;
                    // Vérifier si déjà soumis pour cette machine aujourd'hui
                    const alreadyDoneForMachine = checklistsCache.some(
                      c =>
                        Number(c.operateurId) === Number(user?.id) &&
                        Number(c.machineId)   === Number(m.id) &&
                        String(c.date ?? "").startsWith(todayISO) &&
                        String(c.status ?? c.statut ?? "") !== "EN_COURS"
                    );
                    return (
                      <button
                        key={m.id}
                        onClick={() => pickMachine(m)}
                        disabled={false} // toujours cliquable (on affiche le blocage à l'étape suivante)
                        style={{
                          ...S.machineCard,
                          border: isSelected
                            ? "2px solid #2563eb"
                            : alreadyDoneForMachine
                              ? "2px solid #f59e0b"
                              : "1.5px solid var(--bd-1)",
                          background: isSelected
                            ? "#eff6ff"
                            : alreadyDoneForMachine
                              ? "#fffbeb"
                              : "var(--bg-1)",
                          boxShadow: isSelected ? "0 6px 20px rgba(37,99,235,0.18)" : "0 2px 8px rgba(15,23,42,0.05)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                              background: isSelected ? "#dbeafe" : alreadyDoneForMachine ? "#fef3c7" : "#f1f5f9",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 20,
                            }}>
                              {alreadyDoneForMachine ? "✅" : "⚙️"}
                            </div>
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontWeight: 800, fontSize: 14, color: isSelected ? "#1d4ed8" : "var(--tx-1)", lineHeight: 1.3 }}>
                                {m.nom}
                              </div>
                              {m.description && (
                                <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 2, lineHeight: 1.4 }}>
                                  {m.description}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5l2.5 2.5 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* Localisation */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {m.segmentNom && (
                            <span style={S.locTag}>📍 {m.segmentNom}</span>
                          )}
                          {m.plantNom && (
                            <span style={{ ...S.locTag, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }}>🏭 {m.plantNom}</span>
                          )}
                          {m.siteNom && (
                            <span style={{ ...S.locTag, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>📌 {m.siteNom}</span>
                          )}
                        </div>

                        {/* Badge déjà soumis */}
                        {alreadyDoneForMachine && (
                          <div style={{ marginTop: 8, padding: "5px 10px", borderRadius: 8, background: "#fef9c3", border: "1px solid #fde047", fontSize: 11, color: "#854d0e", fontWeight: 700 }}>
                            ⚠ Checklist déjà soumise aujourd'hui pour cette machine
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {filteredMachines.length === 0 && machineSearch && (
                  <div style={{ textAlign: "center", padding: "28px", color: "var(--tx-4)", fontSize: 13 }}>
                    Aucun résultat pour «&nbsp;<strong>{machineSearch}</strong>&nbsp;»
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ STEP 3 : CHECKLIST ══ */}
        {step === "checklist" && (
          <div>
            {/* Résumé session + machine */}
            <div style={S.contextBar}>
              <div style={S.contextItem}>
                <span style={S.contextIcon}>⏱</span>
                <div>
                  <div style={S.contextLabel}>Session</div>
                  <div style={S.contextValue}>{session?.icon} {session?.label}</div>
                </div>
              </div>
              <div style={S.contextDivider} />
              <div style={S.contextItem}>
                <span style={S.contextIcon}>⚙️</span>
                <div>
                  <div style={S.contextLabel}>Machine</div>
                  <div style={S.contextValue}>{selMachine?.nom || "—"}</div>
                </div>
              </div>
              {selMachine?.segmentNom && (
                <>
                  <div style={S.contextDivider} />
                  <div style={S.contextItem}>
                    <span style={S.contextIcon}>📍</span>
                    <div>
                      <div style={S.contextLabel}>Segment</div>
                      <div style={S.contextValue}>{selMachine.segmentNom}</div>
                    </div>
                  </div>
                </>
              )}
              <button
                style={{ marginLeft: "auto", ...S.btnBack, padding: "8px 14px", fontSize: 12 }}
                onClick={() => goTo("machine")}
              >
                ← Changer
              </button>
            </div>

            {/* Chargement en cours */}
            {(checkingEtat || fetchingCriteres) && (
              <div style={{ ...S.panel, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={S.spinner} />
                <span style={{ color: "var(--tx-3)", fontSize: 14 }}>{t("operator.checking")}</span>
              </div>
            )}

            {/* ── DÉJÀ SOUMIS AUJOURD'HUI ── */}
            {!checkingEtat && !fetchingCriteres && dejasoumisAujourdhui && (
              <div style={{ ...S.panel, textAlign: "center", padding: "52px 36px" }}>
                <div style={S.blockedIconWrap}>🔒</div>
                <h2 style={S.blockedTitle}>{t("operator.alreadySubmitted.title")}</h2>
                <p style={S.blockedMsg}>
                  Vous avez déjà soumis une checklist aujourd'hui pour la machine{" "}
                  <strong>{selMachine?.nom}</strong>.
                </p>
                <p style={{ color: "var(--tx-4)", fontSize: 13, marginBottom: 32 }}>
                  {t("operator.alreadySubmitted.note")}
                </p>
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  <BtnConsulter />
                  <button style={S.btnBack} onClick={() => goTo("machine")}>← Changer de machine</button>
                </div>
              </div>
            )}

            {/* ── FORMULAIRE ── */}
            {!checkingEtat && !fetchingCriteres && !dejasoumisAujourdhui && (
              <>
                {/* Consignes */}
                <div style={S.instructionsBox}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <button onClick={toggleConsignes} style={{ background: "transparent", border: "none", color: "var(--l5)", fontWeight: 700, cursor: "pointer" }}>
                        Voir les consignes
                      </button>
                      <div style={{ fontSize: 12, color: "var(--tx-4)" }}>
                        {showConsignes ? "Consignes affichées" : "Consignes masquées"}
                      </div>
                    </div>
                  </div>

                  {showConsignes && (
                    <div style={{ marginTop: 12 }}>
                      <div style={S.instructionsTitle}>Consignes / تعليمات</div>
                      <div style={S.instructionsGrid}>
                        <div style={S.instructionsCol}>
                          <ul style={S.instructionsList}>
                            <li>Mettre "1" si la tâche ou le résultat du check est OK.</li>
                            <li>Mettre "0" si la tâche ou le résultat du check est NOK.</li>
                            <li>Mettre "NA" si Non Applicable.</li>
                            <li>En cas de "0", mettre carte rouge LTPM sur le défaut ; alerter le contremaître et mettre drapeau jaune ou rouge selon criticité du défaut. La machine sera arrêtée pour le cas du drapeau rouge.</li>
                          </ul>
                        </div>
                        <div style={{ ...S.instructionsCol, direction: "rtl", textAlign: "right" }}>
                          <div style={S.instructionsNote}>يجب ترك الخانة فارغة وملؤها عند العمل مع (C1 أو C2 أو C3) في حالة بدء المشغل العمل مع جانب واحد فقط.</div>
                          <ul style={S.instructionsListRtl}>
                            <li>ضع "1" إذا كانت المهمة أو نتيجة الاختبار على ما يرام.</li>
                            <li>ضع "0" إذا كانت المهمة أو نتيجة الاختبار ليست على ما يرام.</li>
                            <li>ضع "NA" إذا كان غير قابل للتطبيق.</li>
                            <li>تنبيه المشرف لتغيير لون العلم إلى أصفر أو أحمر حسب حرجية العيب.</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Onglets par type */}
                {types.length > 1 && (
                  <div style={S.typeTabs}>
                    {types.map(tp => {
                      const meta     = typeMeta[tp] || { label: tp, color: "#6b7280", bg: "#f8fafc", icon: "📌" };
                      const isActive = activeType === tp;
                      return (
                        <button key={tp} onClick={() => handleSetActiveType(tp)} style={{
                          ...S.typeTab,
                          background:   isActive ? meta.bg    : "transparent",
                          color:        isActive ? meta.color : "var(--tx-4)",
                          borderBottom: `3px solid ${isActive ? meta.color : "transparent"}`,
                          fontWeight:   isActive ? 700 : 500,
                        }}>
                          <span>{meta.icon}</span>
                          <span>{meta.label}</span>
                          <span style={{ ...S.typeCount, background: isActive ? meta.color : "var(--bg-3)", color: isActive ? "#fff" : "var(--tx-4)" }}>
                            {critByType[tp]?.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Critères */}
                {criteres.length === 0 ? (
                  <div style={S.emptyStateBox}>
                    Aucun critère actif n'est configuré pour le processus sélectionné.
                  </div>
                ) : (
                  (activeType ? [activeType] : types).map(type => {
                    const meta       = typeMeta[type] || { label: type, color: "#6b7280", bg: "#f8fafc", icon: "📌" };
                    const items      = critByType[type] || [];
                    const isActiveTab= activeType === type || types.length === 1;
                    const totalPages = Math.ceil(items.length / CRIT_PAGE_SIZE);
                    const pagedItems = isActiveTab ? items.slice((critPage - 1) * CRIT_PAGE_SIZE, critPage * CRIT_PAGE_SIZE) : items;

                    return (
                      <div key={type} style={S.typeSection}>
                        {types.length === 1 && (
                          <div style={{ ...S.typeHeading, borderLeft: `4px solid ${meta.color}`, background: meta.bg }}>
                            <span style={{ fontWeight: 700, color: meta.color, fontSize: 13 }}>{meta.icon} {meta.label}</span>
                            <span style={{ fontSize: 12, color: meta.color, opacity: 0.65 }}>
                              {t("operator.criteria.count", { count: items.length })}
                            </span>
                          </div>
                        )}

                        <div style={S.critereList}>
                          {pagedItems.map((c, idx) => {
                            const globalIdx  = isActiveTab ? (critPage - 1) * CRIT_PAGE_SIZE + idx : idx;
                            const rep        = reponses[c.id] || { valeur: "VERT", commentaire: "" };
                            const rv         = resultats[rep.valeur] || resultats.VERT;
                            const imageRef   = resolveCritereImageUrl(c.image);
                            const critNom    = getCritereNom(c, lang);
                            const critDesc   = getCritereDescription(c, lang);
                            const critCouleur= normalizeCritereCouleur(c.couleur || c.flag_color || c.flagColor);
                            const isRouge    = rep.valeur === "ROUGE" && critCouleur === "rouge";
                            const isJaune    = rep.valeur === "ROUGE" && critCouleur === "jaune";
                            const isNonConforme = isRouge || isJaune;
                            const ncFlag     = NON_CONFORME_FLAG[critCouleur] || NON_CONFORME_FLAG.rouge;
                            const rowStyle   = imageRef ? S.critereRow : S.critereRowNoImage;
                            const critereShadow = critCouleur === "jaune" ? NON_CONFORME_FLAG.jaune : NON_CONFORME_FLAG.rouge;

                            return (
                              <div key={c.id} style={{
                                ...S.critereCard,
                                borderLeft: isJaune ? "5px solid #f59e0b" : isRouge ? "5px solid #ef4444" : "5px solid #16a34a",
                                boxShadow: isNonConforme ? `0 0 0 3px ${critereShadow.shadow}` : "0 4px 12px rgba(15,23,42,0.06)",
                                transition: "all .2s ease",
                              }}>
                                <div style={S.critereHeader}>
                                  <div style={S.critereIndex}>{globalIdx + 1}</div>
                                  <div style={S.critereInfo}>
                                    <div style={{ ...S.critereNom, ...(isAr ? { direction: "rtl", textAlign: "right" } : {}) }}>
                                      {critNom}
                                    </div>
                                    {critDesc && (
                                      <div style={{ ...S.critereDesc, ...(isAr ? { direction: "rtl", textAlign: "right" } : {}) }}>
                                        {critDesc}
                                      </div>
                                    )}
                                    <div style={{
                                      display: "inline-flex", alignItems: "center", gap: 6,
                                      padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, marginTop: 10,
                                      background: critCouleur === "jaune" ? "#fef3c7" : "#fee2e2",
                                      color: critCouleur === "jaune" ? "#b45309" : "#b91c1c",
                                    }}>
                                      {critCouleur === "jaune" ? "🟡 Machine" : "🔴 Visuel"}
                                    </div>
                                  </div>
                                  <div style={S.headerRight}>
                                    {isNonConforme && (
                                      <div style={S.ncWrap} title="LTPM">
                                        <div style={{ ...S.ncTitle, color: ncFlag.bg }}>LTPM</div>
                                        <div style={{ ...S.ncTriangle, background: ncFlag.bg, color: ncFlag.text, boxShadow: `0 4px 10px ${ncFlag.shadow}` }}>
                                          LTPM
                                        </div>
                                      </div>
                                    )}
                                    <div style={{ ...S.resultBadge, background: rv.bg, color: rv.color, border: `1.5px solid ${rv.border}` }}>
                                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: rv.dot, display: "inline-block", flexShrink: 0 }} />
                                      {rv.label}
                                    </div>
                                  </div>
                                </div>

                                <div style={S.critereBody} className="critere-body">
                                  <div style={rowStyle} className={imageRef ? "critere-row" : "critere-row no-image"}>
                                    {imageRef && (
                                      <div style={S.imageWrap}>
                                        <div style={{ ...S.imageLbl, ...(isAr ? { direction: "rtl", textAlign: "right" } : {}) }}>
                                          {t("operator.criteria.referenceImage")}
                                        </div>
                                        <img
                                          src={imageRef}
                                          alt={t("operator.criteria.referenceImageAlt")}
                                          style={{ ...S.imagePreview, borderRadius: 14, border: "1px solid #e2e8f0" }}
                                          onError={(e) => { e.target.parentElement.style.display = "none"; }}
                                        />
                                      </div>
                                    )}
                                    <div style={S.critereCol}>
                                      <div style={{ ...S.blockLabel, ...(isAr ? { direction: "rtl", textAlign: "right" } : {}) }}>
                                        {t("operator.criteria.evaluation")}
                                      </div>
                                      <div style={S.valBtns}>
                                        {RESULT_BUTTON_ORDER.map(key => {
                                          const r2 = resultats[key];
                                          if (!r2) return null;
                                          const isSelected = rep.valeur === key;
                                          const btnLabel   = RESULT_BUTTON_LABELS[key] || r2.label;
                                          return (
                                            <button key={key} onClick={() => setVal(c.id, key)} style={{
                                              ...S.valBtn,
                                              background:  isSelected ? r2.bg    : "var(--bg-1)",
                                              color:       isSelected ? r2.color : "var(--tx-3)",
                                              border:      `2px solid ${isSelected ? r2.border : "var(--bd-1)"}`,
                                              fontWeight:  isSelected ? 700 : 500,
                                              transform:   isSelected ? "translateY(-1px)" : "none",
                                              boxShadow:   isSelected ? `0 4px 12px ${r2.border}60` : "none",
                                            }}>
                                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isSelected ? r2.dot : "var(--bd-1)", display: "inline-block", flexShrink: 0 }} />
                                              {btnLabel}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div style={S.critereCol}>
                                      <div style={{ ...S.blockLabel, marginTop: 0, ...(isAr ? { direction: "rtl", textAlign: "right" } : {}) }}>
                                        {t("operator.criteria.comment")}
                                      </div>
                                      <textarea
                                        rows={3}
                                        style={{
                                          ...S.commentBox,
                                          borderColor: isRouge ? "#fda4af" : isJaune ? "#fde047" : "var(--bd-1)",
                                          ...(isAr ? { direction: "rtl", textAlign: "right" } : {}),
                                        }}
                                        placeholder={isJaune ? t("operator.placeholders.commentRecommended") : t("operator.placeholders.commentOptional")}
                                        value={rep.commentaire}
                                        onChange={e => setCmt(c.id, e.target.value)}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {isActiveTab && totalPages > 1 && (
                          <Pagination page={critPage} totalPages={totalPages} onChange={setCritPage} totalItems={items.length} pageSize={CRIT_PAGE_SIZE} />
                        )}
                      </div>
                    );
                  })
                )}

                {/* Erreur */}
                {error && (
                  <div style={S.errBox}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div style={S.actionRow}>
                  <button style={S.btnBack} onClick={() => goTo("machine")}>
                    ← {t("common.back")}
                  </button>
                  <button
                    disabled={criteres.length === 0 || loading}
                    onClick={handleSubmit}
                    style={{
                      ...S.btnSubmit,
                      background:
                        submitBucket === "ROUGE" ? "linear-gradient(90deg,#9f1239,#be123c)" :
                        submitBucket === "JAUNE" ? "linear-gradient(90deg,#b45309,#d97706)" :
                        "var(--grd-h)",
                      opacity: (criteres.length === 0 || loading) ? 0.55 : 1,
                      cursor:  (criteres.length === 0 || loading) ? "not-allowed" : "pointer",
                    }}
                  >
                    {loading ? (
                      <><div style={{ ...S.spinner, borderTopColor: "#fff", width: 15, height: 15, borderWidth: 2 }} />{t("operator.submit.loading")}</>
                    ) : submitBucket === "ROUGE" ? (
                      `⚠ ${t("operator.submit.withIssues", { count: nbNcRouge })}`
                    ) : submitBucket === "JAUNE" ? (
                      `⚠ ${t("operator.submit.withIssues", { count: nbNcJaune })}`
                    ) : (
                      `✓ ${t("operator.submit.submit")}`
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════ KEYFRAMES ══ */
const keyframes = `
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:none; } }
  @keyframes scaleIn { from { opacity:0; transform:scale(0.94); } to { opacity:1; transform:scale(1); } }
  @keyframes bounceIn{ 0%{opacity:0;transform:scale(.7)} 60%{transform:scale(1.08)} 80%{transform:scale(.96)} 100%{opacity:1;transform:scale(1)} }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }

  @media (max-width: 900px) {
    .critere-body { overflow-x: visible !important; }
    .critere-row,
    .critere-row.no-image {
      grid-template-columns: 1fr !important;
      gap: 10px !important;
    }
  }
`;

/* ══════════════════ STYLES ══ */
const S = {
  page: {
    minHeight: "100%",
    background: "radial-gradient(900px 360px at 8% -10%, rgba(59,130,246,0.18), transparent 60%), radial-gradient(700px 320px at 92% -10%, rgba(245,158,11,0.18), transparent 60%), linear-gradient(180deg, #f8fafc 0%, #ffffff 45%, #f4f7fb 100%)",
    padding: "18px 16px 64px",
  },
  container: {
    maxWidth: 1020, margin: "0 auto",
    padding: "0 6px 56px", color: "var(--tx-1)",
  },
  stepper: {
    display: "flex", alignItems: "center",
    background: "rgba(255,255,255,0.9)", border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: "var(--r-2xl)", padding: "16px 24px", marginBottom: 20,
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)", backdropFilter: "blur(6px)",
    animation: "fadeUp .35s var(--ease) .05s both",
  },
  stepItem:  { display: "flex", alignItems: "center", flex: 1 },
  stepDot: {
    width: 32, height: 32, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, flexShrink: 0,
    background: "#fff", color: "var(--tx-4)", border: "1.5px solid var(--bd-1)",
    transition: "all .25s var(--ease)",
  },
  stepDotActive: { background: "var(--l6)", color: "#fff", border: "2px solid var(--l5)", boxShadow: "0 0 0 6px rgba(0,87,168,0.12)" },
  stepDotDone:   { background: "#16a34a", color: "#fff", border: "2px solid #16a34a" },
  stepInfo:      { marginLeft: 10 },
  stepLabel:     { fontSize: 12, color: "var(--tx-4)", fontWeight: 500, whiteSpace: "nowrap", transition: "color .2s" },
  stepLabelActive: { color: "var(--l5)", fontWeight: 700 },
  stepLabelDone:   { color: "#16a34a",   fontWeight: 600 },
  stepLine: { flex: 1, height: 2, margin: "0 10px", background: "rgba(15,23,42,0.1)", borderRadius: 2, transition: "background .3s" },
  stepLineDone: { background: "#16a34a" },
  panel: {
    background: "rgba(255,255,255,0.94)", border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: "var(--r-2xl)", padding: "30px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)", marginBottom: 18,
    backdropFilter: "blur(6px)", animation: "fadeUp .32s var(--ease) both",
  },
  panelHeader:     { display: "flex", alignItems: "center", gap: 18, marginBottom: 24 },
  panelHeaderIcon: {
    width: 46, height: 46, background: "linear-gradient(135deg,#e0f2fe,#ffffff)",
    border: "1px solid #cfe3ff", borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, flexShrink: 0, boxShadow: "0 6px 16px rgba(59,130,246,0.18)",
  },
  panelTitle: { fontSize: 17, fontWeight: 800, color: "var(--tx-1)", fontFamily: "var(--fh)", margin: "0 0 4px" },
  panelSub:   { fontSize: 13, color: "var(--tx-4)", margin: 0 },
  shiftGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 26 },
  shiftCard: {
    position: "relative", display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, padding: "32px 20px", borderRadius: "var(--r-xl)", cursor: "pointer",
    transition: "all .2s var(--ease)", background: "rgba(255,255,255,0.92)",
    boxShadow: "0 10px 24px rgba(15,23,42,0.08)", border: "1px solid rgba(15,23,42,0.08)",
  },
  shiftEmoji: { fontSize: 40, lineHeight: 1 },
  shiftCheck: {
    position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  // ── Machine step styles ──
  machineGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: 12,
  },
  machineCard: {
    display: "flex", flexDirection: "column", padding: "16px 18px",
    borderRadius: 16, cursor: "pointer", textAlign: "left",
    transition: "all .18s ease", fontFamily: "var(--fd)",
  },
  locTag: {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0",
  },
  // ── Context bar (above checklist) ──
  contextBar: {
    display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap",
    background: "rgba(255,255,255,0.94)", border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: "var(--r-2xl)", padding: "14px 20px", marginBottom: 14,
    boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
    animation: "fadeUp .28s var(--ease) both",
  },
  contextItem: { display: "flex", alignItems: "center", gap: 10 },
  contextIcon: { fontSize: 20, flexShrink: 0 },
  contextLabel: { fontSize: 10, fontWeight: 700, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: ".6px" },
  contextValue: { fontSize: 13, fontWeight: 800, color: "var(--tx-1)" },
  contextDivider: { width: 1, height: 32, background: "var(--bd-1)", margin: "0 16px", flexShrink: 0 },
  // ── shared ──
  instructionsBox: {
    background: "linear-gradient(180deg,#ffffff,#f8fafc)", border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: "var(--r-2xl)", padding: "16px 18px", marginBottom: 16,
    display: "flex", flexDirection: "column", gap: 10,
    boxShadow: "0 10px 22px rgba(15,23,42,0.06)", animation: "fadeUp .3s var(--ease) both",
  },
  instructionsTitle:   { fontSize: 13, fontWeight: 800, color: "var(--tx-1)", fontFamily: "var(--fh)", letterSpacing: ".2px" },
  instructionsGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 },
  instructionsCol:     { display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: "var(--tx-3)", lineHeight: 1.55 },
  instructionsNote:    { fontWeight: 600, color: "var(--tx-2)" },
  instructionsList:    { margin: 0, paddingLeft: 18 },
  instructionsListRtl: { margin: 0, paddingRight: 18, paddingLeft: 0 },
  typeTabs: { display: "flex", gap: 4, marginBottom: 18, borderBottom: "2px solid var(--bd-1)", paddingBottom: 0, overflowX: "auto" },
  typeTab: {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", border: "none",
    cursor: "pointer", fontSize: 13, transition: "all .18s ease",
    borderRadius: "var(--r-md) var(--r-md) 0 0", whiteSpace: "nowrap", fontFamily: "var(--fb)",
  },
  typeCount:   { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: "var(--r-f)" },
  typeSection: { marginBottom: 16 },
  emptyStateBox: {
    marginTop: 8, marginBottom: 16, padding: "14px 16px", borderRadius: "var(--r-lg)",
    border: "1px dashed var(--bd-1)", background: "var(--bg-2)", color: "var(--tx-3)",
    fontSize: 13, textAlign: "center",
  },
  typeHeading: {
    padding: "10px 16px", borderRadius: "var(--r-lg) var(--r-lg) 0 0",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 0, border: "1px solid rgba(0,0,0,0.06)", borderBottom: "none",
  },
  critereList: { display: "flex", flexDirection: "column", gap: 10 },
  critereCard: {
    background: "rgba(255,255,255,0.94)", border: "1px solid rgba(15,23,42,0.08)",
    borderRadius: "var(--r-2xl)", padding: "18px",
    transition: "box-shadow .2s ease", display: "flex", flexDirection: "column", gap: 14,
    animation: "fadeUp .25s var(--ease) both",
  },
  critereHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  headerRight:   { display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 },
  critereIndex:  {
    width: 28, height: 28, borderRadius: "var(--r-sm)",
    background: "var(--l1)", border: "1.5px solid var(--l3)", color: "var(--l6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 800, flexShrink: 0,
  },
  critereInfo: { flex: 1, minWidth: 0 },
  critereNom:  { fontWeight: 700, color: "var(--tx-1)", fontSize: 14, lineHeight: 1.4, marginBottom: 3 },
  critereDesc: { fontSize: 12, color: "var(--tx-3)", lineHeight: 1.5 },
  resultBadge: {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
    borderRadius: "var(--r-f)", fontSize: 11.5, fontWeight: 800, letterSpacing: ".2px",
    whiteSpace: "nowrap", flexShrink: 0,
  },
  ncWrap:     { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, lineHeight: 1 },
  ncTitle:    { fontSize: 10, fontWeight: 800, letterSpacing: ".6px", textTransform: "uppercase", color: "var(--tx-4)" },
  ncTriangle: { width: 26, height: 22, clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, lineHeight: 1 },
  imageWrap:    { display: "flex", flexDirection: "column", gap: 8, width: "100%", padding: "12px 14px", borderRadius: "var(--r-lg)", border: "1px solid rgba(15,23,42,0.08)", background: "#fff" },
  imageLbl:     { fontSize: 10, fontWeight: 800, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: ".8px", display: "flex", alignItems: "center", gap: 6 },
  imagePreview: { width: "100%", height: 90, objectFit: "contain", borderRadius: 8, border: "1px solid var(--bd-1)", background: "#f8fafc" },
  critereBody: {
    display: "flex", flexDirection: "column", gap: 10,
    background: "rgba(248,250,252,0.9)", border: "1px solid rgba(15,23,42,0.06)",
    borderRadius: "var(--r-xl)", padding: "16px", overflowX: "auto",
  },
  critereRow:        { display: "grid", gridTemplateColumns: "minmax(140px, 180px) minmax(210px, 260px) minmax(260px, 1fr)", gap: 12, alignItems: "start" },
  critereRowNoImage: { display: "grid", gridTemplateColumns: "minmax(210px, 260px) minmax(260px, 1fr)", gap: 12, alignItems: "start" },
  critereCol:  { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 },
  blockLabel:  { fontSize: 10, fontWeight: 800, color: "var(--tx-4)", textTransform: "uppercase", letterSpacing: ".8px", display: "flex", alignItems: "center", gap: 4 },
  valBtns:     { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 },
  valBtn: {
    display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 12px", borderRadius: 10,
    cursor: "pointer", fontSize: 13, transition: "all .15s ease", fontFamily: "var(--fh)",
    letterSpacing: ".3px", justifyContent: "center", width: "100%", minHeight: 36,
  },
  commentBox: {
    width: "100%", padding: "10px 13px", border: "1.5px solid", borderRadius: "var(--r-lg)",
    fontSize: 13, lineHeight: 1.55, resize: "vertical", fontFamily: "var(--fd)",
    background: "#fff", color: "var(--tx-1)", outline: "none",
    boxSizing: "border-box", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.03)",
    minHeight: 90, transition: "border-color .15s",
  },
  errBox: {
    display: "flex", alignItems: "center", gap: 10, background: "var(--r0)", color: "var(--r7)",
    padding: "12px 16px", borderRadius: "var(--r-md)", fontSize: 13, marginTop: 12,
    border: "1px solid var(--r1)", animation: "fadeUp .2s var(--ease) both",
  },
  spinner:    { width: 20, height: 20, borderRadius: "50%", border: "3px solid var(--bd-1)", borderTopColor: "var(--l5)", animation: "spin .7s linear infinite", flexShrink: 0 },
  actionRow:  { display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", alignItems: "center" },
  btnBack: {
    background: "#ffffff", color: "var(--tx-2)", border: "1px solid rgba(15,23,42,0.12)", borderRadius: 12,
    padding: "11px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--fd)",
    display: "inline-flex", alignItems: "center", gap: 6,
    boxShadow: "0 6px 14px rgba(15,23,42,0.06)", transition: "all .2s var(--ease)",
  },
  btnSubmit: {
    flex: 1, color: "#fff", border: "none", borderRadius: 14, padding: "13px 24px",
    fontWeight: 700, fontSize: 14, fontFamily: "var(--fd)",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 12px 26px rgba(26,111,196,0.28)", transition: "all .2s var(--ease)",
  },
  blockedIconWrap: {
    width: 72, height: 72, borderRadius: "50%", background: "#fefce8", border: "2px solid #fde047",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px",
  },
  blockedTitle: { fontSize: 20, fontWeight: 900, color: "var(--tx-1)", fontFamily: "var(--fh)", margin: "0 0 12px" },
  blockedMsg:   { color: "var(--tx-3)", fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: "0 auto 8px" },
  draftBanner: { display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fde3a7", marginBottom: 14 },
  draftBannerActions: { marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" },
};