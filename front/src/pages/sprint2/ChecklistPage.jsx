import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllSites, getPlantsBySite, getSegmentsByPlant, getChecklistById,
  getAllProcessus, getMachinesByProcessus, getCriteresByProcessus,
  soumettreChecklist, getAllChecklists,
  validerChecklistN1, validerChecklistN2, validerChecklistFinal, rejeterChecklist,
  deleteChecklist, planActionAPI, utilisateurAPI, checklistAPI,
} from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import api from "../../api/axiosInstance";
import { getCritereNom, getCritereDescription } from "../../utils/critereUtils";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── helpers ─────────────────────────────────────────────────────────── */
function resolveCritereImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const clean = rawUrl.trim().replace(/\\/g, "/");
  if (!clean) return "";
  if (clean.startsWith("data:image/")) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;
  const apiBase = api.defaults?.baseURL || `${window.location.origin}/api`;
  const backendOrigin = String(apiBase).replace(/\/api\/?$/, "");
  const uploadsIndex = clean.toLowerCase().indexOf("/uploads/");
  if (uploadsIndex >= 0) return `${backendOrigin}${clean.slice(uploadsIndex)}`;
  if (clean.startsWith("uploads/")) return `${backendOrigin}/${clean}`;
  if (clean.startsWith("/")) return `${backendOrigin}${clean}`;
  return `${backendOrigin}/${clean}`;
}

function uniquePlansById(plans) {
  const map = new Map();
  (Array.isArray(plans) ? plans : []).forEach(plan => {
    if (!plan) return;
    const key = plan.id != null
      ? String(plan.id)
      : `${plan.description || ""}|${plan.dateEcheance || ""}|${plan.responsableMatricule || ""}`;
    map.set(key, plan);
  });
  return [...map.values()];
}

const isPlanClosed = (plan) =>
  plan?.statut === "CLOS" ||
  plan?.statut === "EN_ATTENTE_VALIDATION_AQ" ||
  plan?.statut === "VALIDE_AQ" ||
  !!plan?.closLe;

const buildSessions = (t) => [
  { value: "M", label: t("layout.session.morning"),  icon: "☀️" },
  { value: "S", label: t("layout.session.evening"),  icon: "🌆" },
  { value: "N", label: t("layout.session.night"),    icon: "🌙" },
];

const STATUS_CFG = (t) => ({
  EN_COURS:     { label: t("sprint2.checklist.status.inProgress"),    color: "#92400e", bg: "#fef3c7", dot: "#f59e0b" },
  SOUMIS:       { label: t("sprint2.checklist.status.submitted"),      color: "#1e40af", bg: "#dbeafe", dot: "#3b82f6" },
  VALIDE_N1:    { label: t("sprint2.checklist.status.validatedN1"),    color: "#5b21b6", bg: "#ede9fe", dot: "#7c3aed" },
  VALIDE_N2:    { label: t("sprint2.checklist.status.validatedN2"),    color: "#075985", bg: "#e0f2fe", dot: "#0284c7" },
  VALIDE_FINAL: { label: t("sprint2.checklist.status.validatedFinal"), color: "#14532d", bg: "#dcfce7", dot: "#16a34a" },
  REJETE:       { label: t("sprint2.checklist.status.rejected"),       color: "#7f1d1d", bg: "#fee2e2", dot: "#dc2626" },
});

const RESULT_CFG = (t) => ({
  VERT:  { label: t("sprint2.checklist.results.green"),  color: "#14532d", bg: "#dcfce7", border: "#16a34a", dot: "#16a34a" },
  JAUNE: { label: t("sprint2.checklist.results.yellow"), color: "#713f12", bg: "#fef9c3", border: "#ca8a04", dot: "#ca8a04" },
  ROUGE: { label: t("sprint2.checklist.results.red"),    color: "#7f1d1d", bg: "#fee2e2", border: "#dc2626", dot: "#dc2626" },
  NA:    { label: t("sprint2.checklist.results.na"),     color: "#374151", bg: "#f3f4f6", border: "#d1d5db", dot: "#9ca3af" },
});

const TYPE_STYLE_CFG = {
  SECURITE:  { color: "#7f1d1d", bg: "#fee2e2" },
  QUALITE:   { color: "#14532d", bg: "#dcfce7" },
  TECHNIQUE: { color: "#1e3a5f", bg: "#dbeafe" },
};

const PROC_ICONS = ["⚙️","🔩","🏭","🔧","📦","🛠️","⚡","🔬","🖥️","🎯"];

const toYmd = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const isDateInPeriod = (value, period) => {
  if (period === "ALL") return true;
  const ymd = toYmd(value);
  if (!ymd) return false;
  const now = new Date();
  const today = toYmd(now);
  if (period === "TODAY") return ymd === today;
  if (period === "WEEK") {
    const start = new Date(now);
    const weekDay = (start.getDay() + 6) % 7;
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - weekDay);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const d = new Date(`${ymd}T00:00:00`);
    return d >= start && d < end;
  }
  return true;
};

/* ─── Design System CSS ─────────────────────────────────────────────────── */
const DS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

:root {
  --font-display: 'Syne', sans-serif;

  --ink-0: #080c14;
  --ink-1: #151c2c;
  --ink-2: #2d3a52;
  --ink-3: #5a6a85;
  --ink-4: #8a9ab5;
  --ink-5: #c4cdd8;

  --surface-0: #ffffff;
  --surface-1: #f7f9fc;
  --surface-2: #eef1f7;
  --surface-3: #e3e8f0;

  --accent: #2563eb;
  --accent-soft: #dbeafe;
  --accent-glow: rgba(37,99,235,0.15);

  --success: #059669;
  --warning: #d97706;
  --danger: #dc2626;

  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  --shadow-xs: 0 1px 2px rgba(8,12,20,0.06);
  --shadow-sm: 0 2px 8px rgba(8,12,20,0.07), 0 1px 2px rgba(8,12,20,0.04);
  --shadow-md: 0 8px 24px rgba(8,12,20,0.08), 0 2px 6px rgba(8,12,20,0.05);
  --shadow-lg: 0 20px 48px rgba(8,12,20,0.1), 0 4px 12px rgba(8,12,20,0.06);
  --shadow-xl: 0 32px 72px rgba(8,12,20,0.14);

  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --dur: 0.2s;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

.cl-root {
  font-family: var(--font-body);
  background: var(--surface-1);
  min-height: 100vh;
  color: var(--ink-1);
  -webkit-font-smoothing: antialiased;
}

/* ── Page layout ─── */
.cl-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 32px 28px;
}

/* ── Page header ─── */
.cl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 36px;
  gap: 16px;
}

.cl-header-left {}

.cl-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 4px 10px;
  border-radius: 100px;
  margin-bottom: 10px;
}

.cl-title {
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  color: var(--ink-0);
  letter-spacing: -0.5px;
  line-height: 1.15;
  margin-bottom: 5px;
}

.cl-subtitle {
  font-size: 13.5px;
  color: var(--ink-3);
  font-weight: 400;
}

/* ── Tabs ─── */
.cl-tabs {
  display: flex;
  background: var(--surface-0);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-md);
  padding: 4px;
  gap: 3px;
  box-shadow: var(--shadow-xs);
  align-self: flex-start;
}

.cl-tab {
  padding: 8px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--ink-3);
  transition: all var(--dur) var(--ease);
  font-family: var(--font-body);
  letter-spacing: 0.1px;
  white-space: nowrap;
}

.cl-tab:hover { color: var(--ink-1); background: var(--surface-1); }

.cl-tab-active {
  background: var(--ink-0);
  color: #fff;
  font-weight: 700;
  box-shadow: var(--shadow-sm);
}

/* ── Filter bar ─── */
.cl-filterbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  background: var(--surface-0);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-lg);
  padding: 8px 10px;
  margin-bottom: 28px;
  box-shadow: var(--shadow-sm);
}

.cl-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border-radius: 100px;
  background: var(--surface-1);
  border: 1px solid var(--surface-3);
  transition: all var(--dur) var(--ease);
  font-size: 12.5px;
  color: var(--ink-2);
}

.cl-filter-pill:focus-within {
  border-color: var(--accent);
  background: var(--surface-0);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.cl-filter-pill-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--ink-4);
  white-space: nowrap;
}

.cl-filter-pill input,
.cl-filter-pill select {
  border: none;
  background: transparent;
  outline: none;
  font-family: var(--font-body);
  font-size: 12.5px;
  color: var(--ink-1);
  min-width: 110px;
}

.cl-filter-pill-search { flex: 1; min-width: 220px; }
.cl-filter-pill-icon { font-size: 13px; color: var(--ink-4); }

.cl-filter-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cl-filter-clear {
  padding: 5px 10px;
  border-radius: 100px;
  border: 1px solid var(--surface-3);
  background: var(--surface-1);
  color: var(--ink-3);
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-body);
  transition: all var(--dur) var(--ease);
}
.cl-filter-clear:hover { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }

.cl-filter-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  background: var(--surface-1);
  border: 1px solid var(--surface-3);
  padding: 5px 12px;
  border-radius: 100px;
  white-space: nowrap;
}

/* ── LTPM Section header ─── */
.cl-ltpm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cl-section-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-1);
  letter-spacing: -0.2px;
}

.cl-section-desc {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 1px;
}

/* ── LTPM Grid ─── */
.cl-ltpm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 36px;
}

/* ── LTPM Cards (preserved + polished) ─── */
.cl-ltpm-card {
  border-radius: 18px;
  border: none;
  cursor: pointer;
  transition: transform 0.22s var(--ease), box-shadow 0.22s var(--ease);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 44px 20px;
  min-height: 250px;
  font-family: var(--font-display);
  position: relative;
  overflow: hidden;
}

.cl-ltpm-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%);
  pointer-events: none;
}

.cl-ltpm-card::after {
  content: '';
  position: absolute;
  width: 240px;
  height: 240px;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  bottom: -130px;
  right: -80px;
  pointer-events: none;
}

.cl-ltpm-card:hover {
  transform: translateY(-5px) scale(1.01);
}

.cl-ltpm-card-title {
  font-size: 16px;
  font-weight: 800;
  color: rgba(255,255,255,0.95);
  text-align: center;
  margin-bottom: 14px;
  letter-spacing: -0.2px;
  position: relative;
  z-index: 1;
}

.cl-ltpm-card-count {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(255,255,255,0.25);
  border: 2px solid rgba(255,255,255,0.35);
  color: #fff;
  font-size: 20px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(4px);
}

/* ── List rows ─── */
.cl-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cl-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--surface-0);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--dur) var(--ease);
  box-shadow: var(--shadow-xs);
}

.cl-row:hover {
  border-color: var(--ink-5);
  box-shadow: var(--shadow-sm);
  transform: translateX(3px);
  background: #fafbff;
}

.cl-row-icon {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.cl-row-body { flex: 1; min-width: 0; }

.cl-row-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-row-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 2px;
  flex-wrap: wrap;
}

.cl-row-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cl-row-date {
  font-size: 12px;
  color: var(--ink-4);
  white-space: nowrap;
}

/* ── Badge / Pill ─── */
.cl-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.5;
  white-space: nowrap;
  font-family: var(--font-body);
}

/* ── Form card ─── */
.cl-form-card {
  background: var(--surface-0);
  border: 1px solid var(--surface-3);
  border-radius: var(--radius-xl);
  padding: 32px;
  box-shadow: var(--shadow-sm);
}

/* ── Section header inside form ─── */
.cl-fsec {
  margin-bottom: 24px;
}

.cl-fsec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--surface-3);
}

.cl-fsec-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cl-fsec-icon {
  width: 28px;
  height: 28px;
  background: var(--surface-2);
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.cl-fsec-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.9px;
  color: var(--ink-2);
  font-family: var(--font-display);
}

/* ── Fields ─── */
.cl-field { display: flex; flex-direction: column; gap: 6px; }

.cl-field-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--ink-4);
}

.cl-input, .cl-select, .cl-textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--surface-3);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-family: var(--font-body);
  background: var(--surface-0);
  color: var(--ink-1);
  outline: none;
  transition: all var(--dur) var(--ease);
}

.cl-input:focus, .cl-select:focus, .cl-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
  background: var(--surface-0);
}

.cl-input:disabled, .cl-select:disabled {
  background: var(--surface-2);
  color: var(--ink-4);
  cursor: not-allowed;
}

/* ── Session buttons ─── */
.cl-session-btn {
  padding: 9px 16px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--surface-3);
  background: var(--surface-1);
  color: var(--ink-3);
  font-size: 13px;
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--dur) var(--ease);
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.cl-session-btn:hover { border-color: var(--ink-5); background: var(--surface-0); }
.cl-session-btn.active {
  background: var(--ink-0);
  color: #fff;
  border-color: var(--ink-0);
  box-shadow: var(--shadow-sm);
}

/* ── Criteria card ─── */
.cl-crit-card {
  background: var(--surface-0);
  border: 1.5px solid var(--surface-3);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 8px;
  transition: all var(--dur) var(--ease);
}

.cl-crit-card:hover { box-shadow: var(--shadow-sm); }

.cl-crit-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink-0);
  line-height: 1.45;
}

.cl-crit-desc {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 3px;
  line-height: 1.55;
}

/* ── Result buttons ─── */
.cl-result-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-family: var(--font-body);
  font-weight: 500;
  border: 1.5px solid var(--surface-3);
  background: var(--surface-1);
  color: var(--ink-3);
  cursor: pointer;
  transition: all 0.13s var(--ease);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* ── Process cards ─── */
.cl-proc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
  gap: 12px;
}

.cl-proc-card {
  background: var(--surface-0);
  border: 1.5px solid var(--surface-3);
  border-radius: var(--radius-lg);
  padding: 24px 18px;
  cursor: pointer;
  text-align: center;
  transition: all var(--dur) var(--ease);
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: var(--shadow-xs);
  position: relative;
  overflow: hidden;
}

.cl-proc-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), #7c3aed);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s var(--ease);
}

.cl-proc-card:hover::after { transform: scaleX(1); }

.cl-proc-card:hover {
  border-color: var(--ink-5);
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.cl-proc-emoji {
  font-size: 34px;
  line-height: 1;
}

.cl-proc-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-0);
  font-family: var(--font-display);
}

.cl-proc-desc {
  font-size: 12px;
  color: var(--ink-3);
  line-height: 1.45;
}

.cl-proc-cta {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

/* ── Machine cards ─── */
.cl-mach-card {
  background: var(--surface-0);
  border: 1.5px solid var(--surface-3);
  border-radius: var(--radius-lg);
  padding: 22px 16px;
  cursor: pointer;
  text-align: center;
  transition: all var(--dur) var(--ease);
  font-family: var(--font-body);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: var(--shadow-xs);
}

.cl-mach-card:hover {
  border-color: var(--success);
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(5,150,105,0.12);
}

/* ── Buttons ─── */
.cl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: var(--font-body);
  transition: all var(--dur) var(--ease);
  letter-spacing: 0.1px;
  white-space: nowrap;
}

.cl-btn:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
.cl-btn:not(:disabled):hover { transform: translateY(-1px); }

.cl-btn-primary { background: var(--ink-0); color: #fff; box-shadow: var(--shadow-sm); }
.cl-btn-primary:not(:disabled):hover { background: var(--ink-1); box-shadow: var(--shadow-md); }

.cl-btn-success { background: #059669; color: #fff; box-shadow: var(--shadow-sm); }
.cl-btn-success:not(:disabled):hover { background: #047857; }

.cl-btn-danger { background: #dc2626; color: #fff; box-shadow: var(--shadow-sm); }
.cl-btn-danger:not(:disabled):hover { background: #b91c1c; }

.cl-btn-secondary {
  background: var(--surface-0);
  color: var(--ink-2);
  border: 1.5px solid var(--surface-3);
  box-shadow: var(--shadow-xs);
}
.cl-btn-secondary:not(:disabled):hover { background: var(--surface-1); border-color: var(--ink-5); }

.cl-btn-ghost {
  background: none;
  color: var(--ink-3);
  border: none;
  padding: 6px 10px;
}
.cl-btn-ghost:not(:disabled):hover { color: var(--ink-1); background: var(--surface-2); }

/* ── Drawer ─── */
.cl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 12, 20, 0.3);
  z-index: 9000;
  backdrop-filter: blur(3px);
  transition: opacity 0.22s var(--ease);
}

.cl-drawer {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: clamp(340px, 94vw, 468px);
  background: var(--surface-0);
  border-left: 1px solid var(--surface-3);
  z-index: 9001;
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-xl);
}

.cl-drawer-head {
  padding: 22px 26px 18px;
  border-bottom: 1px solid var(--surface-2);
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.cl-drawer-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  color: var(--ink-0);
}

.cl-drawer-sub {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 3px;
}

.cl-drawer-close {
  width: 34px; height: 34px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--surface-3);
  background: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-3);
  font-size: 18px;
  transition: all var(--dur) var(--ease);
  flex-shrink: 0;
}

.cl-drawer-close:hover { background: var(--surface-2); color: var(--ink-1); }

.cl-drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-3) transparent;
}

.cl-drawer-footer {
  padding: 14px 26px;
  border-top: 1px solid var(--surface-2);
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
  background: var(--surface-1);
}

/* ── Info grid in drawer ─── */
.cl-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 20px;
}

.cl-info-item {
  background: var(--surface-1);
  border: 1px solid var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
}

.cl-info-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: var(--ink-4);
  margin-bottom: 3px;
}

.cl-info-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-1);
}

/* ── NC items ─── */
.cl-nc-item {
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  margin-bottom: 7px;
  border-left: 3px solid;
}

.cl-nc-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-0);
}

.cl-nc-comment {
  font-size: 12px;
  color: var(--ink-3);
  margin-top: 5px;
  font-style: italic;
}

/* ── Modal ─── */
.cl-modal-wrap {
  position: fixed;
  inset: 0;
  z-index: 9500;
  background: rgba(8, 12, 20, 0.45);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: cl-fadein 0.18s var(--ease);
}

.cl-modal {
  background: var(--surface-0);
  border-radius: var(--radius-xl);
  padding: 30px 30px 24px;
  width: 100%;
  max-width: 464px;
  border: 1px solid var(--surface-3);
  box-shadow: var(--shadow-xl);
  animation: cl-scalein 0.2s var(--ease);
}

.cl-modal-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--ink-0);
  margin-bottom: 16px;
}

.cl-modal-footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 22px;
}

/* ── LTPM modal ─── */
.cl-ltpm-modal-wrap {
  position: fixed;
  inset: 0;
  background: rgba(8, 12, 20, 0.45);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
  animation: cl-fadein 0.18s var(--ease);
}

.cl-ltpm-modal {
  background: var(--surface-0);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
  width: 90%;
  max-width: 580px;
  max-height: 82vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--surface-3);
  animation: cl-scalein 0.2s var(--ease);
}

.cl-ltpm-modal-head {
  padding: 22px 26px;
  border-bottom: 1px solid var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.cl-ltpm-modal-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 800;
  color: var(--ink-0);
}

.cl-ltpm-modal-sub {
  font-size: 12px;
  color: var(--ink-4);
  margin-top: 2px;
}

.cl-ltpm-modal-body {
  padding: 18px 26px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
  scrollbar-color: var(--surface-3) transparent;
}

.cl-ltpm-row {
  border: 1.5px solid var(--surface-3);
  border-radius: var(--radius-md);
  padding: 13px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all var(--dur) var(--ease);
  border-left-width: 4px;
}

.cl-ltpm-row:hover { background: var(--surface-1); border-color: var(--ink-5); }

.cl-ltpm-row-machine {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-0);
  margin-bottom: 5px;
}

.cl-ltpm-row-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--ink-3);
  margin-bottom: 9px;
}

/* ── Banner ─── */
.cl-banner {
  display: flex;
  border-radius: var(--radius-md);
  border: 1px solid var(--surface-3);
  overflow: hidden;
  margin-bottom: 24px;
  background: var(--surface-1);
}

.cl-banner-cell {
  flex: 1;
  padding: 13px 18px;
  border-right: 1px solid var(--surface-3);
}

.cl-banner-cell:last-child { border-right: none; }

.cl-banner-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: var(--ink-4);
  margin-bottom: 4px;
}

.cl-banner-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-1);
}

.cl-banner-value-accent { color: var(--accent); }

/* ── Bulk bar ─── */
.cl-bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-md);
  padding: 10px 16px;
  margin-bottom: 16px;
  gap: 12px;
}

.cl-bulk-text {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}

/* ── Empty state ─── */
.cl-empty {
  text-align: center;
  padding: 44px 20px;
  color: var(--ink-4);
  font-size: 13px;
  background: var(--surface-1);
  border-radius: var(--radius-lg);
  border: 1.5px dashed var(--surface-3);
}

.cl-empty-icon { font-size: 34px; margin-bottom: 10px; opacity: 0.7; }

/* ── Toast ─── */
.cl-toast {
  position: fixed;
  top: 22px; right: 22px;
  z-index: 9999;
  padding: 13px 18px;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-body);
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 360px;
  box-shadow: var(--shadow-lg);
  animation: cl-slidein 0.24s var(--ease);
}

/* ── Type tags ─── */
.cl-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 10px;
}

/* ── Breadcrumb ─── */
.cl-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ink-4);
  margin-bottom: 22px;
  flex-wrap: wrap;
}

.cl-breadcrumb-sep { color: var(--ink-5); }
.cl-breadcrumb-item { color: var(--ink-2); font-weight: 600; }

/* ── Spinner ─── */
.cl-spinner {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid var(--surface-3);
  border-top-color: var(--ink-2);
  animation: cl-spin 0.65s linear infinite;
  margin: 0 auto 14px;
}

/* ── Section divider label ─── */
.cl-divlabel {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.9px;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: 8px;
}

/* ── Plan action items ─── */
.cl-plan-item {
  border-radius: var(--radius-sm);
  padding: 11px 13px;
  margin-bottom: 7px;
  border-left: 3px solid;
}

/* ── Animations ─── */
@keyframes cl-fadein {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@keyframes cl-scalein {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}

@keyframes cl-slidein {
  from { transform: translateX(18px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}

@keyframes cl-spin {
  to { transform: rotate(360deg); }
}

/* ── Scrollbars ─── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: var(--ink-5); }

/* ── Responsive ─── */
@media (max-width: 680px) {
  .cl-shell { padding: 18px 16px; }
  .cl-header { flex-direction: column; }
  .cl-ltpm-grid { grid-template-columns: 1fr; gap: 10px; }
  .cl-info-grid { grid-template-columns: 1fr; }
  .cl-drawer { width: 100%; }
  .cl-filterbar { flex-direction: column; align-items: stretch; }
  .cl-filter-right { margin-left: 0; justify-content: flex-end; }
}
`;

/* ─── micro-components ─────────────────────────────────────────────────── */
const Pill = ({ label, color, bg, dot }) => (
  <span className="cl-badge" style={{ background: bg, color }}>
    {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
    {label}
  </span>
);

const SectionLabel = ({ children }) => (
  <div className="cl-divlabel">{children}</div>
);

/* ─── Toast ─── */
function Toast({ msg }) {
  if (!msg.text) return null;
  const ok = msg.type === "success";
  return (
    <div className="cl-toast" style={{
      background: ok ? "#f0fdf4" : "#fef2f2",
      border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
      color: ok ? "#15803d" : "#991b1b",
    }}>
      {ok ? "✓" : "⚠"} {msg.text}
    </div>
  );
}

/* ─── Buttons ─── */
const BtnPrimary    = ({ children, onClick, disabled, style = {} }) => (
  <button className="cl-btn cl-btn-primary"    disabled={disabled} onClick={onClick} style={style}>{children}</button>
);
const BtnSecondary  = ({ children, onClick, disabled, style = {} }) => (
  <button className="cl-btn cl-btn-secondary"  disabled={disabled} onClick={onClick} style={style}>{children}</button>
);
const BtnDanger     = ({ children, onClick, disabled, style = {} }) => (
  <button className="cl-btn cl-btn-danger"     disabled={disabled} onClick={onClick} style={style}>{children}</button>
);
const BtnSuccess    = ({ children, onClick, disabled, style = {} }) => (
  <button className="cl-btn cl-btn-success"    disabled={disabled} onClick={onClick} style={style}>{children}</button>
);

/* ─── Drawer ─── */
function Drawer({ open, onClose, children, title, subtitle, actions }) {
  const { t } = useI18n();
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <>
      <div onClick={onClose} className="cl-overlay" style={{ opacity: open ? 1 : 0, pointerEvents: open ? "all" : "none" }} />
      <div role="dialog" aria-modal="true" className="cl-drawer" style={{
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div className="cl-drawer-head">
          <div>
            <div className="cl-drawer-title">{title}</div>
            {subtitle && <div className="cl-drawer-sub">{subtitle}</div>}
          </div>
          <button className="cl-drawer-close" onClick={onClose} aria-label={t("sprint2.checklist.drawer.close")}>×</button>
        </div>
        <div className="cl-drawer-body" style={{ paddingBottom: actions ? 92 : 22 }}>{children}</div>
        {actions && (
          <div className="cl-drawer-footer" style={{
            position: "absolute", right: 0, left: 0, bottom: 0,
          }}>{actions}</div>
        )}
      </div>
    </>
  );
}

/* ─── Modal ─── */
function Modal({ open, onClose, title, children, actions }) {
  if (!open) return null;
  return (
    <div className="cl-modal-wrap" onClick={onClose}>
      <div className="cl-modal" onClick={e => e.stopPropagation()}>
        <div className="cl-modal-title">{title}</div>
        <div>{children}</div>
        {actions && <div className="cl-modal-footer">{actions}</div>}
      </div>
    </div>
  );
}

/* ─── FormSection / FormField ─── */
function FormSection({ icon, title, right, children }) {
  return (
    <div className="cl-fsec">
      <div className="cl-fsec-header">
        <div className="cl-fsec-label">
          <span className="cl-fsec-icon">{icon}</span>
          <span className="cl-fsec-title">{title}</span>
        </div>
        {right && <div>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function FormField({ label, required, children }) {
  return (
    <div className="cl-field">
      <div className="cl-field-label">{label}{required && <span style={{ color: "#dc2626" }}> *</span>}</div>
      {children}
    </div>
  );
}

const StyledSelect = ({ children, ...props }) => (
  <select className="cl-select" {...props}>{children}</select>
);
const StyledInput  = ({ style = {}, ...props }) => (
  <input  className="cl-input"  style={style} {...props} />
);
const EmptyState   = ({ icon, message }) => (
  <div className="cl-empty">
    <div className="cl-empty-icon">{icon}</div>
    {message}
  </div>
);

const extractApiErrorMessage = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  }
  return err?.message || fallback;
};

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function ChecklistPage() {
  const { t, lang } = useI18n();
  const locale      = lang === "ar" ? "ar-MA" : lang === "en" ? "en-US" : "fr-FR";
  const { user }    = useAuth();
  const navigate    = useNavigate();

  const sessions  = useMemo(() => buildSessions(t), [t]);
  const results   = useMemo(() => RESULT_CFG(t), [t]);
  const statusCfg = useMemo(() => STATUS_CFG(t), [t]);

  const canCreate       = ["OPERATEUR"].includes(user?.role);
  const canValiderN1    = ["ADMIN", "CHEF_LIGNE"].includes(user?.role);
  const canValiderN2    = ["ADMIN", "TECHNICIEN"].includes(user?.role);
  const canValiderFinal = ["ADMIN", "AGENT_QUALITE"].includes(user?.role);
  const canRejeter      = ["ADMIN", "AGENT_QUALITE"].includes(user?.role);
  const canDelete       = user?.role === "ADMIN";
  const isChefLigne     = user?.role === "CHEF_LIGNE";
  const isTechnicien    = user?.role === "TECHNICIEN";
  const isAgentQualite  = user?.role === "AGENT_QUALITE";
  const userMatricule   = String(user?.matricule || "").trim();

  const [view,     setView]     = useState(canCreate ? "form" : "list");
  const [formStep, setFormStep] = useState("process");
  const [ltpmModalBucket, setLtpmModalBucket] = useState(null);

  const [sites,      setSites]      = useState([]);
  const [plants,     setPlants]     = useState([]);
  const [segments,   setSegments]   = useState([]);
  const [processus,  setProcessus]  = useState([]);
  const [machines,   setMachines]   = useState([]);
  const [criteres,   setCriteres]   = useState([]);
  const [checklists, setChecklists] = useState([]);

  const sortChecklistsDesc = (arr) => (Array.isArray(arr) ? arr.slice().sort((a, b) => {
    const da = a?.date ? new Date(a.date) : null;
    const db = b?.date ? new Date(b.date) : null;
    if (da && db) { const diff = db - da; if (diff !== 0) return diff; }
    return (b?.id || 0) - (a?.id || 0);
  }) : []);

  const [selectedProc,    setSelectedProc]    = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);

  const [fStatus,    setFStatus]    = useState("");
  const [fProcessus, setFProcessus] = useState("");
  const [fPeriod,    setFPeriod]    = useState("TODAY");
  const [search,     setSearch]     = useState("");

  const [form, setForm] = useState({
    siteId: "", plantId: "", segmentId: "", processusId: "", machineId: "",
    date: new Date().toISOString().split("T")[0], session: "M",
  });
  const [reponses,        setReponses]        = useState({});
  const [formError,       setFormError]       = useState("");
  const [formSuccess,     setFormSuccess]     = useState(false);
  const [loadingCriteres, setLoadingCriteres] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected,   setSelected]   = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [toast,         setToast]         = useState({ type: "", text: "" });
  const [rejectModal,   setRejectModal]   = useState(null);
  const [motifRejet,    setMotifRejet]    = useState("");
  const [deleteModal,   setDeleteModal]   = useState(null);
  const [bulkModal,     setBulkModal]     = useState(false);

  const [planModal,       setPlanModal]       = useState(null);
  const [planForm,        setPlanForm]        = useState({ description: "", dateEcheance: "", responsableMatricule: "", responsableAutre: "" });
  const [planSuggest,     setPlanSuggest]     = useState(false);
  const [planFormError,   setPlanFormError]   = useState("");
  const [techniciens,     setTechniciens]     = useState([]);
  const [linkedPlans,     setLinkedPlans]     = useState({});

  const [validerAQPlanModal,   setValiderAQPlanModal]   = useState(null);
  const [validerAQPlanComment, setValiderAQPlanComment] = useState("");
  const [cloturePlanModal,   setCloturePlanModal]   = useState(null);
  const [cloturePlanComment, setCloturePlanComment] = useState("");
  const clotureSubmittingRef = useRef(false);
  const validerAQSubmittingRef = useRef(false);

  useEffect(() => {
    if (canCreate) {
      getAllSites().then(r => setSites(Array.isArray(r.data) ? r.data : [])).catch(() => {});
      getAllProcessus().then(r => setProcessus(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : []))).catch(() => {});
    utilisateurAPI.findAll().then(r => {
      const all = Array.isArray(r.data) ? r.data : [];
      setTechniciens(all.filter(u => u.role === "TECHNICIEN"));
    }).catch(() => {});
  }, [canCreate]);

  useEffect(() => {
    if (view === "list") getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : []))).catch(() => {});
  }, [view]);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: "", text: "" }), 4000);
  }, []);

  const handleSelectProcessus = async (proc) => {
    setSelectedProc(proc); setMachines([]); setFormStep("machine");
    try { const r = await getMachinesByProcessus(proc.id); setMachines(Array.isArray(r.data) ? r.data : []); } catch (_) {}
  };

  const handleSelectMachine = async (machine) => {
    setSelectedMachine(machine); setLoadingCriteres(true); setFormStep("form");
    setForm(f => ({ ...f, processusId: String(selectedProc.id), machineId: String(machine.id) }));
    try {
      const r = await getCriteresByProcessus(selectedProc.id);
      const cl = Array.isArray(r.data) ? r.data : [];
      setCriteres(cl);
      const init = {};
      cl.forEach(c => { init[c.id] = { valeur: "VERT", commentaire: "" }; });
      setReponses(init);
    } catch (_) {}
    finally { setLoadingCriteres(false); }
  };

  const resetForm = () => {
    setFormStep("process"); setSelectedProc(null); setSelectedMachine(null);
    setMachines([]); setCriteres([]); setReponses({});
    setForm({ siteId: "", plantId: "", segmentId: "", processusId: "", machineId: "", date: new Date().toISOString().split("T")[0], session: "M" });
    setPlants([]); setSegments([]); setFormError("");
  };

  const handleSiteChange = async (id) => {
    setForm(f => ({ ...f, siteId: id, plantId: "", segmentId: "", processusId: "" }));
    setPlants([]); setSegments([]);
    if (id) { try { const r = await getPlantsBySite(id); setPlants(Array.isArray(r.data) ? r.data : []); } catch (_) {} }
  };

  const handlePlantChange = async (id) => {
    setForm(f => ({ ...f, plantId: id, segmentId: "", processusId: "" }));
    setSegments([]);
    if (id) { try { const r = await getSegmentsByPlant(id); setSegments(Array.isArray(r.data) ? r.data : []); } catch (_) {} }
  };

  const handleValeur  = (id, v) => setReponses(r => ({ ...r, [id]: { ...r[id], valeur: v } }));
  const handleComment = (id, v) => setReponses(r => ({ ...r, [id]: { ...r[id], commentaire: v } }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError("");
    try {
      await soumettreChecklist({
        date: form.date, session: form.session,
        machineId: Number(form.machineId),
        operateurId: Number(user?.id),
        siteId: Number(form.siteId),
        reponses: Object.entries(reponses).map(([critereId, r]) => ({
          critereId: Number(critereId), valeur: r.valeur, commentaire: r.commentaire,
        })),
      });
      setFormSuccess(true);
    } catch (err) { setFormError(err.response?.data || t("sprint2.checklist.errors.submit")); }
  };

  const openDetail = async (c) => {
    setSelected(c); setDrawerOpen(true);
    try {
      const r = await planActionAPI.findByChecklist(c.id);
      const plans = Array.isArray(r.data) ? uniquePlansById(r.data) : [];
      setLinkedPlans(prev => ({ ...prev, [c.id]: plans }));
    } catch (_) {}
  };

  const closeDrawer = () => { setDrawerOpen(false); setTimeout(() => setSelected(null), 300); };

  const reloadPlans = async (checklistId) => {
    try {
      const r = await planActionAPI.findByChecklist(checklistId);
      const plans = Array.isArray(r.data) ? uniquePlansById(r.data) : [];
      setLinkedPlans(prev => ({ ...prev, [checklistId]: plans }));
      return plans;
    } catch (_) { return []; }
  };

  const withAction = (fn) => async (...args) => {
    setActionLoading(true);
    try { await fn(...args); }
    catch (err) {
      const message = err?.response?.data || err?.message || t("common.error") || "Une erreur est survenue.";
      showToast("error", typeof message === "string" ? message : "Une erreur est survenue.");
    }
    finally { setActionLoading(false); }
  };

  const doCreatePlan = withAction(async () => {
    const cl = planModal;
    if (!planForm.description.trim())     { setPlanFormError("La description est obligatoire."); return; }
    if (!planForm.responsableMatricule)   { setPlanFormError("Le responsable du plan est obligatoire."); return; }
    if (planForm.responsableMatricule === "AUTRES" && !planForm.responsableAutre.trim()) {
      setPlanFormError("Le champ Autres est obligatoire lorsque ce responsable est sélectionné.");
      return;
    }
    if (!planForm.dateEcheance)           { setPlanFormError("La date d'échéance est obligatoire."); return; }
    setPlanFormError("");
    let couleurCritere = "JAUNE";
    try {
      const detail = await getChecklistById(cl.id);
      const reponses = detail?.data?.reponses || [];
      const hasRedNc = reponses.some(r =>
        r.valeur === "ROUGE" || r.critereCouleur === "ROUGE"
      );
      couleurCritere = hasRedNc ? "ROUGE" : "JAUNE";
    } catch (_) {}
    const created = await planActionAPI.creer({
      checklistId: cl.id,
      description: planForm.description.trim(),
      dateEcheance: planForm.dateEcheance,
      responsableMatricule: planForm.responsableMatricule,
      responsableAutre: planForm.responsableMatricule === "AUTRES" ? planForm.responsableAutre.trim() : "",
      couleurCritere,
    });
    const createdPlan = created?.data || created;
    const shouldAutoClose = planForm.responsableMatricule === "AUTRES" && couleurCritere !== "ROUGE" && createdPlan?.id;
    if (shouldAutoClose) {
      await planActionAPI.cloturer(createdPlan.id, "");
      showToast("success", `✅ Plan d'action ${couleurCritere} créé et clôturé pour la checklist #${cl.id}`);
    } else {
      showToast("success", `✅ Plan d'action ${couleurCritere} créé pour la checklist #${cl.id}`);
    }
    setPlanModal(null); setPlanForm({ description: "", dateEcheance: "", responsableMatricule: "", responsableAutre: "" });
    await reloadPlans(cl.id);
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });

  const doCloturerPlan = withAction(async () => {
    if (clotureSubmittingRef.current) return;
    clotureSubmittingRef.current = true;
    try {
      await planActionAPI.cloturer(cloturePlanModal.id, cloturePlanComment.trim());
      const isRouge = cloturePlanModal.couleurCritere === "ROUGE";
      showToast("success", isRouge ? t("sprint2.checklist.toasts.planTreatedAqPending") : t("sprint2.checklist.toasts.planClosed"));
      setCloturePlanModal(null); setCloturePlanComment("");
      if (selected) await reloadPlans(selected.id);
      getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
    } finally {
      clotureSubmittingRef.current = false;
    }
  });

  const doValiderAQPlan = withAction(async () => {
    if (validerAQSubmittingRef.current) return;
    validerAQSubmittingRef.current = true;
    if (!validerAQPlanModal) {
      showToast("error", t("sprint2.checklist.toasts.noPlanSelectedForAqValidation"));
      validerAQSubmittingRef.current = false;
      return;
    }

    const latest = await planActionAPI.findById(validerAQPlanModal.id).then(r => r.data).catch(() => null);
    const currentPlan = latest || validerAQPlanModal;
    const isEnAttenteAQ = currentPlan?.enAttenteValidationAq || currentPlan?.statut === "EN_ATTENTE_VALIDATION_AQ";

    if (currentPlan?.couleurCritere !== "ROUGE" || !isEnAttenteAQ) {
      showToast("error", t("sprint2.checklist.toasts.planNotReadyForAqValidation"));
      validerAQSubmittingRef.current = false;
      return;
    }
    try {
      await planActionAPI.validerAQ(currentPlan.id, validerAQPlanComment.trim());
      showToast("success", t("sprint2.checklist.toasts.planValidatedByAq", { id: currentPlan.id }));
      setValiderAQPlanModal(null); setValiderAQPlanComment("");
      if (selected) await reloadPlans(selected.id);
      getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
    } catch (err) {
      showToast("error", extractApiErrorMessage(err, t("sprint2.checklist.toasts.validationAqFailed")));
    } finally {
      validerAQSubmittingRef.current = false;
    }
  });

  const doValiderN1 = withAction(async (cl) => {
    await validerChecklistN1(cl.id);
    showToast("success", t("sprint2.checklist.notifications.validationN1", { id: cl.id }));
    closeDrawer();
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });
  const doValiderN2 = withAction(async (cl) => {
    await validerChecklistN2(cl.id);
    showToast("success", t("sprint2.checklist.notifications.validationN2", { id: cl.id }));
    closeDrawer();
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });
  const doValiderFinal = withAction(async (cl) => {
    await validerChecklistFinal(cl.id);
    showToast("success", t("sprint2.checklist.notifications.validationFinal", { id: cl.id }));
    closeDrawer();
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });
  const doRejeter = withAction(async () => {
    if (!motifRejet.trim()) return;
    await rejeterChecklist(rejectModal.id, motifRejet);
    showToast("success", t("sprint2.checklist.notifications.rejected", { id: rejectModal.id }));
    setRejectModal(null); closeDrawer();
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });
  const doDelete = withAction(async () => {
    const plansRes = await planActionAPI.findByChecklist(deleteModal.id);
    await Promise.all(uniquePlansById(plansRes.data).map(p => planActionAPI.supprimer(p.id)));
    await deleteChecklist(deleteModal.id);
    showToast("success", t("sprint2.checklist.notifications.deleted", { id: deleteModal.id }));
    setDeleteModal(null); closeDrawer();
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });

  // ════════════════════════════════════════════════════════════════════
  // ✅ EXPORT PDF — Fonction corrigée avec autoTable
  // ════════════════════════════════════════════════════════════════════
  const doExportReport = withAction(async (cl) => {
    try {
      // Récupérer les données complètes de la checklist
      const response = await getChecklistById(cl.id);
      const data = response.data || cl;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      let y = 20;

      // ── Couleurs LEONI ──
      const C = {
        dark: [26, 42, 58],
        green: [46, 125, 50],
        amber: [245, 124, 0],
        red: [198, 40, 40],
        primary: [45, 106, 79],
        gray: [90, 110, 133],
        light: [245, 247, 252],
        white: [255, 255, 255],
        border: [226, 232, 240],
      };

      // ── HEADER ──
      doc.setFillColor(...C.dark);
      doc.rect(0, 0, W, 28, 'F');
      doc.setFillColor(...C.primary);
      doc.rect(0, 28, W, 1.5, 'F');

      // Logo LEONI
      doc.setFillColor(...C.primary);
      doc.roundedRect(14, 6, 16, 16, 2, 2, 'F');
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text('L', 22, 17, { align: 'center' });

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text('LEONI', 36, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 200, 220);
      doc.text('RAPPORT DE CHECKLIST', 36, 20.5);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 200, 220);
      doc.text(`Généré le ${new Date().toLocaleDateString()}`, W - 14, 20.5, { align: 'right' });

      y = 36;

      // ── TITRE ──
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.dark);
      doc.text('Rapport de contrôle', 14, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.gray);
      doc.text(`Processus: ${data.processusNom || '-'}  •  Machine: ${data.machineNom || '-'}`, 14, y);
      y += 14;

      // ── INFOS CHECKLIST (SANS L'ID) ──
      doc.setFillColor(...C.primary);
      doc.rect(14, y, 3, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.dark);
      doc.text('INFORMATIONS', 20, y + 6.5);
      y += 12;

      const infoItems = [
        { label: 'Date', value: data.date || '-' },
        { label: 'Session', value: data.session || '-' },
        { label: 'Statut', value: data.statut || '-' },
        { label: 'Opérateur', value: data.operateurNom || '-' },
        { label: 'Machine', value: data.machineNom || '-' },
        { label: 'Processus', value: data.processusNom || '-' },
        { label: 'Site', value: data.siteNom || '-' },
      ];

      // Tableau des infos en 2 colonnes
      const infoPerRow = 2;
      const infoWidth = (W - 28) / infoPerRow;
      let infoY = y;
      for (let i = 0; i < infoItems.length; i += infoPerRow) {
        for (let j = 0; j < infoPerRow && i + j < infoItems.length; j++) {
          const item = infoItems[i + j];
          const x = 14 + j * infoWidth;
          doc.setFillColor(...C.light);
          doc.roundedRect(x, infoY, infoWidth - 4, 10, 2, 2, 'F');
          doc.setDrawColor(...C.border);
          doc.setLineWidth(0.1);
          doc.roundedRect(x, infoY, infoWidth - 4, 10, 2, 2, 'S');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...C.gray);
          doc.text(item.label.toUpperCase(), x + 4, infoY + 4);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...C.dark);
          doc.text(String(item.value), x + 4, infoY + 8.5);
        }
        infoY += 12;
      }
      y = infoY + 6;

      // ── VALIDATIONS ──
      const validations = [
        { niveau: 'Niveau 1', date: data.dateValidationN1, par: data.valideN1Par, statut: data.statutN1 || (data.dateValidationN1 ? 'Validé' : 'En attente') },
        { niveau: 'Niveau 2', date: data.dateValidationN2, par: data.valideN2Par, statut: data.statutN2 || (data.dateValidationN2 ? 'Validé' : 'En attente') },
        { niveau: 'Finale', date: data.dateValidationFinale, par: data.valideParFinal, statut: data.statutFinal || (data.dateValidationFinale ? 'Validé' : 'En attente') },
      ];

      if (validations.some(v => v.date)) {
        doc.setFillColor(...C.primary);
        doc.rect(14, y, 3, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('VALIDATIONS', 20, y + 6.5);
        y += 12;

        autoTable(doc, {
          startY: y,
          head: [['Niveau', 'Date', 'Validé par', 'Statut']],
          body: validations
            .filter(v => v.date)
            .map(v => [
              v.niveau,
              new Date(v.date).toLocaleString(),
              v.par || '-',
              v.statut || 'Validé'
            ]),
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
            lineColor: C.border,
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: C.dark,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 8,
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 50 },
            2: { cellWidth: 45 },
            3: { cellWidth: 30, halign: 'center' },
          },
          didParseCell: (data) => {
            if (data.column.index === 3 && data.section === 'body') {
              const v = data.cell.text[0] || '';
              if (v === 'Validé' || v === 'Validée') {
                data.cell.styles.textColor = C.green;
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
          margin: { left: 14, right: 14 },
          alternateRowStyles: { fillColor: C.light },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── RÉPONSES PAR CRITÈRE ──
      if (data.reponses && data.reponses.length > 0) {
        if (y > 150) { doc.addPage(); y = 20; }

        doc.setFillColor(...C.primary);
        doc.rect(14, y, 3, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('RÉPONSES PAR CRITÈRE', 20, y + 6.5);
        y += 12;

        const responsesPerPage = 18;
        const totalResponses = data.reponses.length;
        const pages = Math.ceil(totalResponses / responsesPerPage);

        for (let page = 0; page < pages; page++) {
          if (page > 0) { doc.addPage(); y = 20; }

          const start = page * responsesPerPage;
          const end = Math.min(start + responsesPerPage, totalResponses);
          const pageResponses = data.reponses.slice(start, end);

          autoTable(doc, {
            startY: y,
            head: [['#', 'Valeur', 'Critère', 'Commentaire']],
            body: pageResponses.map(r => [
              r.numero || r.critereId || '-',
              r.valeur || '-',
              r.critereNom || '-',
              r.commentaire || ''
            ]),
            theme: 'grid',
            styles: {
              fontSize: 7.5,
              cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
              lineColor: C.border,
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: C.dark,
              textColor: C.white,
              fontStyle: 'bold',
              fontSize: 8,
            },
            columnStyles: {
              0: { cellWidth: 12, halign: 'center' },
              1: { cellWidth: 18, halign: 'center' },
              2: { cellWidth: 70, halign: 'left' },
              3: { cellWidth: 'auto', halign: 'left' },
            },
            didParseCell: (data) => {
              if (data.column.index === 1 && data.section === 'body') {
                const v = data.cell.text[0] || '';
                if (v === 'ROUGE') {
                  data.cell.styles.textColor = C.red;
                  data.cell.styles.fontStyle = 'bold';
                } else if (v === 'JAUNE') {
                  data.cell.styles.textColor = C.amber;
                  data.cell.styles.fontStyle = 'bold';
                } else if (v === 'VERT') {
                  data.cell.styles.textColor = C.green;
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            },
            margin: { left: 14, right: 14 },
            alternateRowStyles: { fillColor: C.light },
          });
          y = doc.lastAutoTable.finalY + 8;
        }
      }

      // ── PLANS D'ACTION ──
      if (data.plansAction && data.plansAction.length > 0) {
        if (y > 160) { doc.addPage(); y = 20; }

        doc.setFillColor(...C.primary);
        doc.rect(14, y, 3, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('PLANS D\'ACTION', 20, y + 6.5);
        y += 12;

        autoTable(doc, {
          startY: y,
          head: [['ID', 'Statut', 'Priorité', 'Responsable', 'Échéance', 'Description']],
          body: data.plansAction.map(p => [
            p.id || '-',
            p.statut || '-',
            p.priorite || '-',
            p.responsableNom || p.responsableMatricule || '-',
            p.dateEcheance || '-',
            p.description || ''
          ]),
          theme: 'grid',
          styles: {
            fontSize: 7,
            cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
            lineColor: C.border,
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: C.dark,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 7.5,
          },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 25 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 30 },
            4: { cellWidth: 25, halign: 'center' },
            5: { cellWidth: 'auto', halign: 'left' },
          },
          didParseCell: (data) => {
            if (data.column.index === 1 && data.section === 'body') {
              const v = data.cell.text[0] || '';
              if (v === 'CLOS' || v === 'VALIDE_AQ') {
                data.cell.styles.textColor = C.green;
                data.cell.styles.fontStyle = 'bold';
              } else if (v === 'EN_COURS') {
                data.cell.styles.textColor = C.amber;
                data.cell.styles.fontStyle = 'bold';
              } else if (v === 'OUVERT') {
                data.cell.styles.textColor = C.red;
                data.cell.styles.fontStyle = 'bold';
              }
            }
            if (data.column.index === 2 && data.section === 'body') {
              const v = data.cell.text[0] || '';
              if (v === 'CRITIQUE') {
                data.cell.styles.textColor = C.red;
                data.cell.styles.fontStyle = 'bold';
              } else if (v === 'NORMAL') {
                data.cell.styles.textColor = C.amber;
              }
            }
          },
          margin: { left: 14, right: 14 },
          alternateRowStyles: { fillColor: C.light },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── JOURNAL D'AUDIT ──
      const auditData = data.auditLog || [];
      if (auditData.length > 0) {
        if (y > 160) { doc.addPage(); y = 20; }

        // Titre avec icône
        doc.setFillColor(...C.primary);
        doc.rect(14, y, 3, 8, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('📋 HISTORIQUE DES ACTIONS', 20, y + 6.5);
        y += 8;

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.gray);
        doc.text('Suivi chronologique des validations et modifications', 20, y);
        y += 10;

        autoTable(doc, {
          startY: y,
          head: [['Date', 'Action', 'Statut', 'Utilisateur', 'Détails']],
          body: auditData.map(item => [
            new Date(item.date).toLocaleString(),
            item.action || '-',
            item.statut || '-',
            item.utilisateur || '-',
            item.details || '-'
          ]),
          theme: 'grid',
          styles: {
            fontSize: 7.5,
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
            lineColor: C.border,
            lineWidth: 0.1,
          },
          headStyles: {
            fillColor: C.dark,
            textColor: C.white,
            fontStyle: 'bold',
            fontSize: 7.5,
          },
          columnStyles: {
            0: { cellWidth: 28, halign: 'center' },
            1: { cellWidth: 30, halign: 'left' },
            2: { cellWidth: 30, halign: 'left' },
            3: { cellWidth: 30, halign: 'left' },
            4: { cellWidth: 'auto', halign: 'left' },
          },
          didParseCell: (data) => {
            // Colorer les statuts
            if (data.column.index === 2 && data.section === 'body') {
              const v = data.cell.text[0] || '';
              if (v.includes('VALIDE_FINAL')) {
                data.cell.styles.textColor = C.green;
                data.cell.styles.fontStyle = 'bold';
              } else if (v.includes('REJETE')) {
                data.cell.styles.textColor = C.red;
                data.cell.styles.fontStyle = 'bold';
              } else if (v.includes('VALIDE')) {
                data.cell.styles.textColor = [37, 99, 235];
              }
            }
            // Tronquer les détails longs
            if (data.column.index === 4 && data.section === 'body') {
              const text = data.cell.text[0] || '';
              if (text.length > 60) {
                data.cell.text = [text.substring(0, 57) + '...'];
              }
            }
            // Colorer les actions
            if (data.column.index === 1 && data.section === 'body') {
              const v = data.cell.text[0] || '';
              if (v.includes('Validation') || v.includes('validation')) {
                data.cell.styles.textColor = [37, 99, 235];
              } else if (v.includes('Rejet') || v.includes('rejet')) {
                data.cell.styles.textColor = C.red;
              } else if (v.includes('Soumission')) {
                data.cell.styles.textColor = C.amber;
              }
            }
          },
          margin: { left: 14, right: 14 },
          alternateRowStyles: { fillColor: C.light },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── FOOTER ──
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(...C.light);
        doc.rect(0, doc.internal.pageSize.getHeight() - 10, W, 10, 'F');
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.2);
        doc.line(14, doc.internal.pageSize.getHeight() - 10, W - 14, doc.internal.pageSize.getHeight() - 10);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.gray);
        doc.text('LEONI Quality — Rapport généré automatiquement', 14, doc.internal.pageSize.getHeight() - 3.5);
        doc.text(`Page ${i} / ${totalPages}`, W - 14, doc.internal.pageSize.getHeight() - 3.5, { align: 'right' });
      }

      // Sauvegarde
      doc.save(`rapport_checklist_${data.id}.pdf`);
      showToast("success", `📄 Rapport exporté pour la checklist #${data.id}`);

    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      showToast("error", 'Erreur lors de la génération du rapport');
    }
  });

  /* ── Filtering ── */
  const filtered = checklists.filter(c => {
    if (c.status === "EN_COURS") return false;
    if (fStatus    && c.status !== fStatus)                                          return false;
    if (fProcessus && String(c.processusId) !== fProcessus)                         return false;
    if (!isDateInPeriod(c.date || c.dateSoumission || c.creeLe, fPeriod))           return false;
    if (search && !(
      (c.machineNom    || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.operateurNom  || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.processusNom  || "").toLowerCase().includes(search.toLowerCase())
    )) return false;
    return true;
  });

  const resolveBucket = (r) => {
    const col = (r.critereCouleur || "").trim().toLowerCase();
    if (col === "jaune") return "JAUNE";
    if (col === "rouge") return "ROUGE";
    return r.valeur === "ROUGE" ? "ROUGE" : r.valeur === "JAUNE" ? "JAUNE" : r.valeur;
  };

  const getChecklistBucket = (c) => {
    const reps = c.reponses || [];
    const hasRouge = reps.some(r => (r.valeur === "ROUGE" || r.valeur === "JAUNE") && resolveBucket(r) === "ROUGE");
    if (hasRouge) return "ROUGE";
    const hasJaune = reps.some(r => (r.valeur === "ROUGE" || r.valeur === "JAUNE") && resolveBucket(r) === "JAUNE");
    if (hasJaune) return "JAUNE";
    return "VERT";
  };

  const ltpmRouge = filtered.filter(c => getChecklistBucket(c) === "ROUGE");
  const ltpmJaune = filtered.filter(c => getChecklistBucket(c) === "JAUNE");
  const ltpmVert  = filtered.filter(c => getChecklistBucket(c) === "VERT");

  const uniqueProcessus = [...new Map(
    checklists.filter(c => c.processusNom).map(c => [c.processusId, c.processusNom])
  ).entries()];

  const toutConf     = filtered.filter(c => getChecklistBucket(c) === "VERT");
  const bulkEligible = toutConf.filter(c =>
    (canValiderN1    && c.status === "SOUMIS")    ||
    (canValiderN2    && c.status === "VALIDE_N1") ||
    (canValiderFinal && c.status === "VALIDE_N2")
  );
  const canBulkValidate = (canValiderN1 || canValiderN2 || canValiderFinal) && bulkEligible.length > 0;

  const doBulkValider = withAction(async () => {
    let count = 0;
    for (const cl of bulkEligible) {
      try {
        if      (canValiderN1    && cl.status === "SOUMIS")    { await validerChecklistN1(cl.id);    count++; }
        else if (canValiderN2    && cl.status === "VALIDE_N1") { await validerChecklistN2(cl.id);    count++; }
        else if (canValiderFinal && cl.status === "VALIDE_N2") { await validerChecklistFinal(cl.id); count++; }
      } catch (_) {}
    }
    setBulkModal(false);
    showToast("success", `✅ ${count} checklist${count !== 1 ? "s" : ""} validée${count !== 1 ? "s" : ""}`);
    getAllChecklists().then(r => setChecklists(sortChecklistsDesc(Array.isArray(r.data) ? r.data : [])));
  });

  /* ── Drawer footer actions ── */
  const drawerFooterActions = selected ? (() => {
    const reponses    = selected.reponses || [];
    const hasRedNc    = reponses.some(r => r.critereCouleur === "ROUGE" || r.critereCouleur === "Red");
    const hasYellowNc = reponses.some(r => r.critereCouleur === "JAUNE" || r.critereCouleur === "Yellow");
    const hasNC       = hasRedNc || hasYellowNc;
    const onlyYellow  = hasYellowNc && !hasRedNc;
    const plans            = linkedPlans[selected.id] || [];
    const userMatricule    = String(user?.matricule || "").trim();
    const userNom          = String(user?.nom || "").trim();
    const assignedPlansToTech = isTechnicien
      ? plans.filter(p => {
          const planMatricule = String(p?.responsableMatricule || "").trim();
          const planNom = String(p?.responsableNom || "").trim();
          return (planMatricule && planMatricule.toLowerCase() === userMatricule.toLowerCase()) || (!planMatricule && planNom && planNom.toLowerCase() === userNom.toLowerCase());
        })
      : [];
    const plansRouge       = plans.filter(p => p.couleurCritere === "ROUGE");
    const plansJaune       = plans.filter(p => p.couleurCritere !== "ROUGE");
    const allRedPlansTreatedByTech  = plansRouge.length > 0 && plansRouge.every(p => ["EN_ATTENTE_VALIDATION_AQ","VALIDE_AQ","CLOS"].includes(p.statut));
    const allRedPlansValidatedByAQ  = plansRouge.length > 0 && plansRouge.every(p => ["VALIDE_AQ","CLOS"].includes(p.statut));
    const allYellowPlansClosed      = plansJaune.length > 0 && plansJaune.every(p => p.statut === "CLOS" || !!p.closLe);
    const hasN1    = !!selected.dateValidationN1;
    const hasN2    = !!selected.dateValidationN2;
    const hasFinal = !!selected.dateValidationFinale;
    const s        = selected.status;

    const chefCanCreatePlan  = isChefLigne && hasNC && !hasN1 && !hasFinal;
    const techCanConsultPlan  = isTechnicien && hasNC && assignedPlansToTech.length > 0;
    const chefCanValidateN1  = isChefLigne && !hasN1 && !hasFinal && (
      !hasNC || (onlyYellow && allYellowPlansClosed) ||
      (hasRedNc && allRedPlansValidatedByAQ && (!hasYellowNc || allYellowPlansClosed))
    );
    const techCanValidateN2  = isTechnicien && hasN1 && !hasN2 && !hasFinal && !onlyYellow;
    const aqCanValidateFinal = isAgentQualite && hasN1 && !hasFinal && (onlyYellow ? true : hasN2);
    const isAdminRole        = user?.role === "ADMIN";

    const statusPalette = {
      EN_COURS:     { accent: "#f59e0b", light: "#fef3c7", border: "#fcd34d", icon: "⏳" },
      SOUMIS:       { accent: "#3b82f6", light: "#dbeafe", border: "#93c5fd", icon: "📋" },
      VALIDE_N1:    { accent: "#7c3aed", light: "#ede9fe", border: "#c4b5fd", icon: "✅" },
      VALIDE_N2:    { accent: "#0284c7", light: "#e0f2fe", border: "#7dd3fc", icon: "✅" },
      VALIDE_FINAL: { accent: "#16a34a", light: "#dcfce7", border: "#86efac", icon: "🏆" },
      REJETE:       { accent: "#dc2626", light: "#fee2e2", border: "#fca5a5", icon: "✕"  },
    };
    const pal = statusPalette[s] || { accent: "var(--ink-3)", light: "var(--surface-2)", border: "var(--surface-3)", icon: "·" };

    const nextStepMsg = (() => {
      if (s === "VALIDE_FINAL") return null;
      if (s === "REJETE")       return null;
      if (s === "EN_COURS")     return t("sprint2.checklist.nextStep.inProgress");
      if (!hasN1) {
        if (isChefLigne || isAdminRole) {
          if (chefCanCreatePlan) return t("sprint2.checklist.nextStep.createPlanBeforeN1");
          if (!chefCanValidateN1 && hasRedNc && !allRedPlansTreatedByTech) return t("sprint2.checklist.nextStep.redPlanPending");
          if (!chefCanValidateN1 && onlyYellow && !allYellowPlansClosed)  return t("sprint2.checklist.nextStep.yellowPlanPending");
          if (chefCanValidateN1) return t("sprint2.checklist.nextStep.readyForN1");
        }
        return t("sprint2.checklist.nextStep.waitingN1");
      }
      if (!hasN2 && !onlyYellow) {
        if (isTechnicien || isAdminRole) return t("sprint2.checklist.nextStep.readyForN2");
        return t("sprint2.checklist.nextStep.waitingN2");
      }
      if (!hasFinal) {
        if (isAgentQualite || isAdminRole) return t("sprint2.checklist.nextStep.readyForFinal");
        return t("sprint2.checklist.nextStep.waitingFinal");
      }
      return null;
    })();

    const btnBase = {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      gap: 7, padding: "10px 18px", borderRadius: 10, cursor: "pointer",
      fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13,
      transition: "opacity .15s, transform .15s", border: "none", width: "100%",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {nextStepMsg && (
          <div style={{
            background: pal.light, border: `1px solid ${pal.border}`,
            borderRadius: 10, padding: "9px 13px",
            fontSize: 12.5, fontWeight: 600, color: pal.accent, lineHeight: 1.5,
          }}>
            {nextStepMsg}
          </div>
        )}

        {s === "VALIDE_FINAL" && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 10, padding: "10px 13px", textAlign: "center",
            fontSize: 13, fontWeight: 700, color: "#15803d",
          }}>
            🏆 Dossier entièrement validé
          </div>
        )}

        {s === "REJETE" && selected.motifRejet && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 10, padding: "10px 13px",
            fontSize: 12.5, fontWeight: 600, color: "#991b1b",
          }}>
            ✕ Rejeté : {selected.motifRejet}
          </div>
        )}

        {isChefLigne && hasRedNc && !allRedPlansTreatedByTech && !hasFinal && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10,
            padding: "9px 13px", fontSize: 12, fontWeight: 600, color: "#991b1b", lineHeight: 1.45,
          }}>
            {t("sprint2.checklist.blocked.n1RedNeedsClosure")}
          </div>
        )}

        {chefCanCreatePlan && (
          <button disabled={actionLoading}
            onClick={() => { setPlanModal(selected); setPlanFormError(""); setPlanForm({ description: "", dateEcheance: "", responsableMatricule: "", responsableAutre: "" }); }}
            style={{ ...btnBase, background: "#f59e0b", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            ⚠️ {t("sprint2.checklist.actions.createPlan")}
          </button>
        )}

        {techCanConsultPlan && (
          <button
            disabled={actionLoading}
            onClick={() => {
              closeDrawer();
              navigate(`/validation?checklistId=${selected.id}`);
            }}
            style={{ ...btnBase, background: "#2563eb", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}
          >
            👁 Consulter le plan d'action assigné
          </button>
        )}

        {chefCanValidateN1 && (
          <button disabled={actionLoading} onClick={() => doValiderN1(selected)}
            style={{ ...btnBase, background: "#7c3aed", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            ✅ {t("sprint2.checklist.actions.validateChefLigne")}
          </button>
        )}

        {isAdminRole && !hasN1 && !hasFinal && s !== "EN_COURS" && (
          <button disabled={actionLoading} onClick={() => doValiderN1(selected)}
            style={{ ...btnBase, background: "#7c3aed", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            ✅ {t("sprint2.checklist.actions.validateN1")}
          </button>
        )}

        {techCanValidateN2 && (
          <button disabled={actionLoading} onClick={() => doValiderN2(selected)}
            style={{ ...btnBase, background: "#0284c7", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            ✅ {t("sprint2.checklist.actions.validateTechnicien")}
          </button>
        )}

        {isAdminRole && hasN1 && !hasN2 && !hasFinal && !onlyYellow && (
          <button disabled={actionLoading} onClick={() => doValiderN2(selected)}
            style={{ ...btnBase, background: "#0284c7", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            ✅ {t("sprint2.checklist.actions.validateN2")}
          </button>
        )}

        {aqCanValidateFinal && (
          <button disabled={actionLoading} onClick={() => doValiderFinal(selected)}
            style={{ ...btnBase, background: "#16a34a", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            🏆 {t("sprint2.checklist.actions.validateQuality")}
          </button>
        )}

        {isAdminRole && hasN1 && !hasFinal && (onlyYellow || hasN2) && (
          <button disabled={actionLoading} onClick={() => doValiderFinal(selected)}
            style={{ ...btnBase, background: "#16a34a", color: "#fff", opacity: actionLoading ? 0.5 : 1 }}>
            🏆 {t("sprint2.checklist.actions.validateFinal")}
          </button>
        )}

        {canRejeter && !["REJETE","VALIDE_FINAL"].includes(s) && (
          <button disabled={actionLoading} onClick={() => setRejectModal(selected)}
            style={{ ...btnBase, background: "#fff", color: "#dc2626", border: "1.5px solid #fca5a5", opacity: actionLoading ? 0.5 : 1 }}>
            ✕ {t("sprint2.checklist.actions.reject")}
          </button>
        )}

        {canDelete && (
          <button disabled={actionLoading} onClick={() => setDeleteModal(selected)}
            style={{ ...btnBase, background: "#fff", color: "#6b7280", border: "1.5px solid #e5e7eb", opacity: actionLoading ? 0.5 : 1 }}>
            🗑 {t("common.delete")}
          </button>
        )}

        {["ADMIN","AGENT_QUALITE"].includes(user?.role) && s === "VALIDE_FINAL" && (
          <button disabled={actionLoading} onClick={() => doExportReport(selected)}
            style={{ ...btnBase, background: "#f8fafc", color: "#334155", border: "1.5px solid #cbd5e1", opacity: actionLoading ? 0.5 : 1 }}>
            📄 {t("sprint2.checklist.drawer.exportReport")}
          </button>
        )}
      </div>
    );
  })() : null;

  /* ─── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div className="cl-root">
      <style>{DS}</style>
      <Toast msg={toast} />

      {/* ── Modals ── */}
      <Modal open={!!planModal} onClose={() => { setPlanModal(null); setPlanFormError(""); }}
        title={`📋 ${t("sprint2.checklist.planModal.title", { id: planModal?.id })}`}
        actions={<>
          <BtnSecondary onClick={() => { setPlanModal(null); setPlanFormError(""); }}>{t("common.cancel")}</BtnSecondary>
          {planForm.responsableMatricule === "AUTRES" && (
            <BtnSecondary onClick={doCreatePlan} disabled={actionLoading}>
              {actionLoading ? t("sprint2.checklist.planModal.creating") : `✓ ${t("sprint2.checklist.planModal.createAndClose")}`}
            </BtnSecondary>
          )}
          <BtnSuccess onClick={doCreatePlan} disabled={actionLoading}>{actionLoading ? t("sprint2.checklist.planModal.creating") : `✓ ${t("sprint2.checklist.planModal.create")}`}</BtnSuccess>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
          {t("sprint2.checklist.planModal.machineLine")} : <strong>{planModal?.machineNom || "—"}</strong> — {planModal?.date}
        </div>
        {planFormError && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#991b1b", marginBottom: 12 }}>⚠ {planFormError}</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <SectionLabel>{t("sprint2.checklist.planModal.descriptionLabel")} <span style={{ color: "#dc2626" }}>*</span></SectionLabel>
            <textarea className="cl-input cl-textarea" style={{ minHeight: 80, resize: "vertical" }}
              placeholder={t("sprint2.checklist.planModal.descriptionPlaceholder")} value={planForm.description}
              onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} autoFocus />
            <div style={{ marginTop: 8 }}>
              <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--gray-100)", color:"var(--gray-700)", border:"1px solid var(--gray-200)", opacity: planSuggest ? 0.6 : 1 }} onClick={async () => {
                if (!planModal?.id) return;
                setPlanSuggest(true);
                try {
                  const r = await planActionAPI.suggererDescription(planModal.id);
                  setPlanForm(f => ({ ...f, description: r?.data?.description || f.description }));
                } catch (_) {
                } finally { setPlanSuggest(false); }
              }} disabled={planSuggest}>
                {planSuggest ? <><span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> {t("sprint2.checklist.planModal.suggesting")}</> : `✨ ${t("sprint2.checklist.planModal.suggest")}`}
              </button>
            </div>
          </div>
          <div>
            <SectionLabel>{t("sprint2.checklist.planModal.responsibleLabel")} <span style={{ color: "#dc2626" }}>*</span></SectionLabel>
            <select className="cl-select" value={planForm.responsableMatricule} onChange={e => setPlanForm(f => ({ ...f, responsableMatricule: e.target.value }))}>
              <option value="">{t("sprint2.checklist.planModal.selectResponsible")}</option>
              {techniciens.map(t2 => <option key={t2.matricule || t2.id} value={t2.matricule || t2.id}>{t2.nom} {t2.prenom} {t2.matricule ? `(${t2.matricule})` : ""}</option>)}
              <option value="AUTRES">{t("sprint2.checklist.planModal.other")}</option>
            </select>
          </div>
          {planForm.responsableMatricule === "AUTRES" && (
            <div>
              <SectionLabel>{t("sprint2.checklist.planModal.otherLabel")} <span style={{ color: "#dc2626" }}>*</span></SectionLabel>
              <input className="cl-input" value={planForm.responsableAutre} onChange={e => setPlanForm(f => ({ ...f, responsableAutre: e.target.value }))} placeholder={t("sprint2.checklist.planModal.otherPlaceholder")} />
            </div>
          )}
          <div>
            <SectionLabel>{t("sprint2.checklist.planModal.dueDate")} <span style={{ color: "#dc2626" }}>*</span></SectionLabel>
            <input type="date" className="cl-input" value={planForm.dateEcheance} min={new Date().toISOString().split("T")[0]} onChange={e => setPlanForm(f => ({ ...f, dateEcheance: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <Modal open={!!cloturePlanModal} onClose={() => { setCloturePlanModal(null); setCloturePlanComment(""); }}
        title={`✅ ${cloturePlanModal?.couleurCritere === "ROUGE" ? t("sprint2.checklist.planModal.treatRedTitle") : t("sprint2.checklist.planModal.closeTitle")} #${cloturePlanModal?.id}`}
        actions={<>
          <BtnSecondary onClick={() => { setCloturePlanModal(null); setCloturePlanComment(""); }}>{t("common.cancel")}</BtnSecondary>
          <BtnSuccess onClick={doCloturerPlan} disabled={actionLoading}>{actionLoading ? t("sprint2.checklist.planModal.closing") : cloturePlanModal?.couleurCritere === "ROUGE" ? `✓ ${t("sprint2.checklist.planModal.treatRed")}` : `✓ ${t("sprint2.checklist.planModal.close")}`}</BtnSuccess>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}><strong>{cloturePlanModal?.description}</strong></div>
        {cloturePlanModal?.couleurCritere === "ROUGE" && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b", marginBottom: 10 }}>
            🔴 {t("sprint2.checklist.planModal.redWarning")}
          </div>
        )}
        <SectionLabel>{t("sprint2.checklist.planModal.commentLabel")} <span style={{ color: "var(--ink-4)", fontWeight: 400, fontSize: 10 }}>{t("sprint2.checklist.planModal.optional")}</span></SectionLabel>
        <textarea className="cl-input cl-textarea" style={{ minHeight: 80, resize: "vertical", marginTop: 6 }}
          placeholder={t("sprint2.checklist.planModal.closingPlaceholder")} value={cloturePlanComment}
          onChange={e => setCloturePlanComment(e.target.value)} autoFocus />
      </Modal>

      <Modal open={!!validerAQPlanModal} onClose={() => { setValiderAQPlanModal(null); setValiderAQPlanComment(""); }}
        title={`✅ ${t("sprint2.checklist.planModal.validateRedTitle", { id: validerAQPlanModal?.id })}`}
        actions={<>
          <BtnSecondary onClick={() => { setValiderAQPlanModal(null); setValiderAQPlanComment(""); }}>{t("common.cancel")}</BtnSecondary>
          <BtnSuccess onClick={doValiderAQPlan} disabled={actionLoading}>{actionLoading ? t("sprint2.checklist.planModal.validating") : `✓ ${t("sprint2.checklist.planModal.validateAQ")}`}</BtnSuccess>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 10 }}><strong>{validerAQPlanModal?.description}</strong></div>
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#1e40af", marginBottom: 10 }}>
          ℹ️ {t("sprint2.checklist.planModal.validateAQInfo")}
        </div>
        <SectionLabel>{t("sprint2.checklist.planModal.validationCommentLabel")} <span style={{ color: "var(--ink-4)", fontWeight: 400, fontSize: 10 }}>{t("sprint2.checklist.planModal.optional")}</span></SectionLabel>
        <textarea className="cl-input cl-textarea" style={{ minHeight: 80, resize: "vertical", marginTop: 6 }}
          placeholder={t("sprint2.checklist.planModal.validationCommentPlaceholder")} value={validerAQPlanComment}
          onChange={e => setValiderAQPlanComment(e.target.value)} autoFocus />
      </Modal>

      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)}
        title={`❌ ${t("sprint2.checklist.reject.title", { id: rejectModal?.id })}`}
        actions={<>
          <BtnSecondary onClick={() => setRejectModal(null)}>{t("common.cancel")}</BtnSecondary>
          <BtnDanger onClick={doRejeter} disabled={!motifRejet.trim() || actionLoading}>{actionLoading ? t("sprint2.checklist.reject.loading") : t("sprint2.checklist.reject.confirm")}</BtnDanger>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 14 }}>
          {t("sprint2.checklist.reject.machineLabel")} : <strong>{rejectModal?.machineNom || t("common.none")}</strong> — {rejectModal?.date}
        </div>
        <SectionLabel>{t("sprint2.checklist.reject.reasonLabel")} <span style={{ color: "#dc2626" }}>*</span></SectionLabel>
        <textarea className="cl-input cl-textarea" style={{ minHeight: 90, resize: "vertical", marginTop: 6 }}
          placeholder={t("sprint2.checklist.reject.reasonPlaceholder")}
          value={motifRejet} onChange={e => setMotifRejet(e.target.value)} autoFocus />
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)}
        title={`🗑 ${t("sprint2.checklist.delete.title", { id: deleteModal?.id })}`}
        actions={<>
          <BtnSecondary onClick={() => setDeleteModal(null)} disabled={actionLoading}>{t("common.cancel")}</BtnSecondary>
          <BtnDanger onClick={doDelete} disabled={actionLoading}>{actionLoading ? t("sprint2.checklist.delete.deleting") : t("sprint2.checklist.delete.confirm")}</BtnDanger>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 12 }}>
          {t("sprint2.checklist.delete.machineLabel")} : <strong>{deleteModal?.machineNom || t("common.none")}</strong> — {deleteModal?.date}
        </div>
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
          ⚠ {t("sprint2.checklist.delete.warning")}<br />
          <span style={{ fontSize: 12 }}>{t("sprint2.checklist.delete.linkedPlansWarning")}</span>
        </div>
      </Modal>

      <Modal open={bulkModal} onClose={() => setBulkModal(false)}
        title={`✅ ${t("sprint2.checklist.bulk.title")}`}
        actions={<>
          <BtnSecondary onClick={() => setBulkModal(false)} disabled={actionLoading}>{t("common.cancel")}</BtnSecondary>
          <BtnSuccess onClick={doBulkValider} disabled={actionLoading}>{actionLoading ? t("sprint2.checklist.bulk.validating") : t("sprint2.checklist.bulk.validateCount", { count: bulkEligible.length })}</BtnSuccess>
        </>}>
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.65 }}>
          <p style={{ margin: "0 0 12px" }}>{t("sprint2.checklist.bulk.bodyCount", { count: bulkEligible.length })}</p>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#15803d" }}>
            ✅ {t("sprint2.checklist.bulk.bodyNote")}
          </div>
        </div>
      </Modal>

      {/* ── Drawer ── */}
      <Drawer open={drawerOpen} onClose={closeDrawer}
        title={selected?.machineNom || t("common.none")}
        subtitle={selected?.date}
        actions={drawerFooterActions}>
        {selected && (
          <DrawerContent selected={selected} sessions={sessions} results={results} statusCfg={statusCfg}
            locale={locale} t={t}
            linkedPlans={linkedPlans[selected.id] || []}
            isTechnicien={isTechnicien}
            isChefLigne={isChefLigne}
            isAgentQualite={isAgentQualite}
            isAdmin={user?.role === "ADMIN"}
            userMatricule={userMatricule}
            onCloturerPlan={(plan) => { setCloturePlanModal(plan); setCloturePlanComment(""); }}
            onValiderAQPlan={(plan) => { setValiderAQPlanModal(plan); setValiderAQPlanComment(""); }} />
        )}
      </Drawer>

      {/* ── Page Shell ── */}
      <div className="cl-shell">

        {/* ── Page header ── */}
        <div className="cl-header">
          <div className="cl-header-left">
            <div className="cl-eyebrow">📋 {t("sprint2.checklist.badge")}</div>
            <h1 className="cl-title">{t("sprint2.checklist.title")}</h1>
            <p className="cl-subtitle">{t("sprint2.checklist.subtitle")}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            {(canCreate || true) && (
              <div className="cl-tabs">
                {canCreate && (
                  <button className={`cl-tab ${view === "form" ? "cl-tab-active" : ""}`} onClick={() => setView("form")}>
                    + {t("sprint2.checklist.tabs.new") || t("sprint2.checklist.tabs.fallbackNew")}
                  </button>
                )}
                
              </div>
            )}
          </div>
        </div>

        {/* ═══ FORM VIEW ═══ */}
        {view === "form" && canCreate && (
          <div className="cl-form-card">
            {formSuccess ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--ink-0)", marginBottom: 8 }}>
                  {t("sprint2.checklist.success.title")}
                </div>
                <p style={{ color: "var(--ink-3)", marginBottom: 28, fontSize: 14 }}>{t("sprint2.checklist.success.message")}</p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                  <BtnSecondary onClick={() => { setView("list"); setFormSuccess(false); }}>📂 {t("sprint2.checklist.success.viewHistory")}</BtnSecondary>
                  <BtnPrimary onClick={() => { setFormSuccess(false); resetForm(); }}>+ {t("sprint2.checklist.success.newChecklist")}</BtnPrimary>
                </div>
              </div>
            ) : formStep === "process" ? (
              <ProcessStep processus={processus} onSelect={handleSelectProcessus} />
            ) : formStep === "machine" ? (
              <MachineStep machines={machines} processusNom={selectedProc?.nom} onSelect={handleSelectMachine} onBack={resetForm} />
            ) : loadingCriteres ? (
              <div style={{ textAlign: "center", padding: 56 }}>
                <div className="cl-spinner" />
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{t("sprint2.checklist.loading.criteria")}</div>
              </div>
            ) : (
              <ChecklistForm selectedProc={selectedProc} selectedMachine={selectedMachine}
                criteres={criteres} reponses={reponses}
                form={form} setForm={setForm}
                sites={sites} plants={plants} segments={segments} processus={processus}
                onSiteChange={handleSiteChange} onPlantChange={handlePlantChange}
                handleValeur={handleValeur} handleComment={handleComment}
                onSubmit={handleSubmit} onBack={resetForm} error={formError}
                sessions={sessions} results={results} />
            )}
          </div>
        )}

        {/* ═══ LIST VIEW ═══ */}
        {view === "list" && (
          <div>
            {/* Filter bar */}
            <div className="cl-filterbar">
              <div className="cl-filter-pill" style={{ flex: 1, minWidth: 220 }}>
                <span className="cl-filter-pill-icon">🔍</span>
                <input
                  className="cl-filter-pill" style={{ border: "none", background: "transparent", padding: 0, flex: 1, fontSize: 12.5, fontFamily: "var(--font-body)", outline: "none", color: "var(--ink-1)", minWidth: 0 }}
                  placeholder={t("sprint2.checklist.history.searchPlaceholder")}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <div className="cl-filter-pill">
                <span className="cl-filter-pill-label">{t("sprint2.checklist.filters.period")}</span>
                <select style={{ border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-1)", cursor: "pointer" }}
                  value={fPeriod} onChange={e => setFPeriod(e.target.value)}>
                  <option value="TODAY">{t("sprint2.checklist.filters.today")}</option>
                  <option value="WEEK">{t("sprint2.checklist.filters.week")}</option>
                  <option value="ALL">{t("sprint2.checklist.filters.all")}</option>
                </select>
              </div>

              <div className="cl-filter-pill">
                <span className="cl-filter-pill-label">{t("sprint2.checklist.filters.process")}</span>
                <select style={{ border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-1)", cursor: "pointer" }}
                  value={fProcessus} onChange={e => setFProcessus(e.target.value)}>
                  <option value="">{t("sprint2.checklist.history.allProcesses")}</option>
                  {uniqueProcessus.map(([id, nom]) => <option key={id} value={String(id)}>{nom}</option>)}
                </select>
              </div>

              <div className="cl-filter-pill">
                <span className="cl-filter-pill-label">{t("sprint2.checklist.filters.status")}</span>
                <select style={{ border: "none", background: "transparent", outline: "none", fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--ink-1)", cursor: "pointer" }}
                  value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="">{t("sprint2.checklist.history.allStatuses")}</option>
                  {Object.entries(statusCfg).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              <div className="cl-filter-right">
                {(fStatus || fProcessus || fPeriod !== "TODAY" || search) && (
                  <button className="cl-filter-clear" onClick={() => { setFStatus(""); setFProcessus(""); setFPeriod("TODAY"); setSearch(""); }}>
                    ✕ {t("sprint2.checklist.filters.reset")}
                  </button>
                )}
                <span className="cl-filter-count">{t("sprint2.checklist.filters.results", { count: filtered.length })}</span>
              </div>
            </div>

            {/* ── 3 LTPM cards (preserved) ── */}
            <div className="cl-ltpm-grid">
              <LtpmCard bucket="ROUGE" checklists={ltpmRouge} onClick={() => setLtpmModalBucket("ROUGE")} t={t} />
              <LtpmCard bucket="JAUNE" checklists={ltpmJaune} onClick={() => setLtpmModalBucket("JAUNE")} t={t} />
              <LtpmCard bucket="VERT"  checklists={ltpmVert}  onClick={() => setLtpmModalBucket("VERT")}  t={t} />
            </div>

            {/* LTPM Modal */}
            {ltpmModalBucket && (
              <LtpmModal
                bucket={ltpmModalBucket}
                checklists={ltpmModalBucket === "ROUGE" ? ltpmRouge : ltpmModalBucket === "JAUNE" ? ltpmJaune : ltpmVert}
                onClose={() => setLtpmModalBucket(null)}
                onSelect={(c) => { setLtpmModalBucket(null); openDetail(c); }}
                selectedId={selected?.id}
                drawerOpen={drawerOpen}
                sessions={sessions}
                statusCfg={statusCfg}
                t={t}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Composants supplémentaires nécessaires ──────────────────────────────
function ProcessStep({ processus, onSelect }) {
  const { t } = useI18n();
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink-0)", marginBottom: 4 }}>
          {t("sprint2.checklist.process.title")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)" }}>{t("sprint2.checklist.process.subtitle")}</p>
      </div>
      {processus.length === 0 ? (
        <EmptyState icon="⚙️" message={t("sprint2.checklist.process.empty")} />
      ) : (
        <div className="cl-proc-grid">
          {processus.map((proc, idx) => (
            <button className="cl-proc-card" key={proc.id} onClick={() => onSelect(proc)}>
              <span className="cl-proc-emoji">{PROC_ICONS[idx % PROC_ICONS.length]}</span>
              <span className="cl-proc-name">{proc.nom}</span>
              {proc.description && <span className="cl-proc-desc">{proc.description}</span>}
              <span className="cl-proc-cta">{t("sprint2.checklist.process.select")} →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MachineStep({ machines, processusNom, onSelect, onBack }) {
  const { t } = useI18n();
  return (
    <div>
      <button onClick={onBack} className="cl-btn cl-btn-ghost" style={{ marginBottom: 18, padding: "5px 0" }}>
        ← {t("sprint2.checklist.machine.changeProcess")}
      </button>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink-0)", marginBottom: 4 }}>
          {t("sprint2.checklist.machine.title")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
          {t("sprint2.checklist.machine.subtitlePrefix")}{" "}
          <strong style={{ color: "var(--ink-1)" }}>{processusNom}</strong>
          {" "}— {t("sprint2.checklist.machine.subtitleSuffix")}
        </p>
      </div>
      {machines.length === 0 ? (
        <EmptyState icon="🏭" message={t("sprint2.checklist.machine.empty")} />
      ) : (
        <div className="cl-proc-grid">
          {machines.map(m => (
            <button className="cl-mach-card" key={m.id} onClick={() => onSelect(m)}>
              <span style={{ fontSize: 30 }}>🏭</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-0)", fontFamily: "var(--font-display)" }}>{m.nom}</span>
              {m.description && <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>{m.description}</span>}
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>{t("sprint2.checklist.machine.select")} →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistForm({
  selectedProc, selectedMachine, criteres, reponses,
  form, setForm, sites, plants, segments,
  onSiteChange, onPlantChange,
  handleValeur, handleComment,
  onSubmit, onBack, error, sessions, results,
}) {
  const { t, lang } = useI18n();
  const nbRouge = Object.values(reponses).filter(r => r.valeur === "ROUGE").length;
  const nbJaune = Object.values(reponses).filter(r => r.valeur === "JAUNE").length;
  const nbVert  = Object.values(reponses).filter(r => r.valeur === "VERT").length;

  const typeLabels = {
    QUALITE:   t("operator.types.quality"),
    SECURITE:  t("operator.types.security"),
    TECHNIQUE: t("operator.types.technical"),
  };

  const criteresByType = criteres.reduce((acc, c) => {
    const k = c.type || "AUTRE";
    if (!acc[k]) acc[k] = [];
    acc[k].push(c);
    return acc;
  }, {});

  return (
    <div>
      <div className="cl-breadcrumb">
        <button onClick={onBack} className="cl-btn cl-btn-ghost" style={{ padding: "2px 0", fontSize: 13 }}>
          ← {t("sprint2.checklist.breadcrumb.change")}
        </button>
        <span className="cl-breadcrumb-sep">/</span>
        <span className="cl-breadcrumb-item">⚙️ {selectedProc?.nom}</span>
        <span className="cl-breadcrumb-sep">/</span>
        <span style={{ fontWeight: 700, color: "var(--ink-0)" }}>🏭 {selectedMachine?.nom}</span>
      </div>

      <div className="cl-banner">
        {[
          { label: t("sprint2.checklist.banner.process"),        value: `⚙️ ${selectedProc?.nom}` },
          { label: t("sprint2.checklist.banner.machine"),        value: `🏭 ${selectedMachine?.nom}` },
          { label: t("sprint2.checklist.banner.criteriaLoaded"), value: `${criteres.length} critères`, accent: true },
        ].map((item, i) => (
          <div key={i} className="cl-banner-cell">
            <div className="cl-banner-label">{item.label}</div>
            <div className={`cl-banner-value ${item.accent ? "cl-banner-value-accent" : ""}`}>{item.value}</div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit}>
        <FormSection title={t("sprint2.checklist.sections.location")} icon="📍">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <FormField label={t("sprint2.checklist.fields.site")} required>
              <StyledSelect value={form.siteId} onChange={e => onSiteChange(e.target.value)} required>
                <option value="">{t("common.select")}</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </StyledSelect>
            </FormField>
            <FormField label={t("sprint2.checklist.fields.plant")} required>
              <StyledSelect value={form.plantId} onChange={e => onPlantChange(e.target.value)} required disabled={!form.siteId}>
                <option value="">{t("common.select")}</option>
                {plants.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </StyledSelect>
            </FormField>
            <FormField label={t("sprint2.checklist.fields.segment")} required>
              <StyledSelect value={form.segmentId} onChange={e => setForm(f => ({ ...f, segmentId: e.target.value }))} required disabled={!form.plantId}>
                <option value="">{t("common.select")}</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </StyledSelect>
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("sprint2.checklist.sections.dateSession")} icon="📅">
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 20, alignItems: "start" }}>
            <FormField label={t("sprint2.checklist.fields.date")} required>
              <StyledInput type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
            </FormField>
            <FormField label={t("sprint2.checklist.fields.session")} required>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {sessions.map(sess => (
                  <button key={sess.value} type="button"
                    className={`cl-session-btn ${form.session === sess.value ? "active" : ""}`}
                    onClick={() => setForm(f => ({ ...f, session: sess.value }))}>
                    {sess.icon} {sess.label}
                  </button>
                ))}
              </div>
            </FormField>
          </div>
        </FormSection>

        {criteres.length > 0 && (
          <FormSection
            title={t("sprint2.checklist.criteria.title")}
            icon="✅"
            right={
              <div style={{ display: "flex", gap: 6 }}>
                {nbRouge > 0 && <Pill label={`${nbRouge} NC`}  color="#7f1d1d" bg="#fee2e2" dot="#dc2626" />}
                {nbJaune > 0 && <Pill label={`${nbJaune} ⚠`}  color="#713f12" bg="#fef9c3" dot="#ca8a04" />}
                <Pill label={`${nbVert} OK`} color="#14532d" bg="#dcfce7" dot="#16a34a" />
              </div>
            }
          >
            {Object.entries(criteresByType).map(([type, items]) => {
              const tc = TYPE_STYLE_CFG[type] || { color: "var(--ink-3)", bg: "#f3f4f6" };
              const typeLabel = typeLabels[type] || type;
              return (
                <div key={type} style={{ marginBottom: 20 }}>
                  <div className="cl-type-tag" style={{ background: tc.bg, color: tc.color }}>
                    {typeLabel}
                    <span style={{ opacity: 0.65 }}>· {items.length}</span>
                  </div>
                  {items.map(c => {
                    const rep = reponses[c.id] || { valeur: "VERT", commentaire: "" };
                    const rv  = results[rep.valeur] || results.VERT;
                    const imageRef = resolveCritereImageUrl(c.image);
                    return (
                      <div key={c.id} className="cl-crit-card" style={{ borderLeftColor: rv.border, borderLeftWidth: 3 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div className="cl-crit-name" style={lang === "ar" ? { direction: "rtl", textAlign: "right" } : {}}>
                              {getCritereNom(c, lang)}
                            </div>
                            {getCritereDescription(c, lang) && (
                              <div className="cl-crit-desc" style={lang === "ar" ? { direction: "rtl", textAlign: "right" } : {}}>
                                {getCritereDescription(c, lang)}
                              </div>
                            )}
                            {imageRef && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 5 }}>
                                  {t("sprint2.checklist.criteria.referenceImage")}
                                </div>
                                <img src={imageRef} alt={t("sprint2.checklist.criteria.referenceImageAlt")}
                                  style={{ width: 200, maxHeight: 120, objectFit: "cover", borderRadius: 8, border: "1px solid var(--surface-3)" }}
                                  onError={e => { e.target.parentElement.style.display = "none"; }} />
                              </div>
                            )}
                          </div>
                          <Pill label={rv.label} color={rv.color} bg={rv.bg} dot={rv.dot} />
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                          {Object.entries(results).map(([key, rv2]) => {
                            const active = rep.valeur === key;
                            return (
                              <button key={key} type="button" className="cl-result-btn" onClick={() => handleValeur(c.id, key)}
                                style={active ? { background: rv2.bg, color: rv2.color, borderColor: rv2.border, fontWeight: 700 } : {}}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: active ? rv2.dot : "var(--surface-3)", display: "inline-block" }} />
                                {rv2.label}
                              </button>
                            );
                          })}
                        </div>
                        <StyledInput
                          placeholder={rep.valeur === "JAUNE" ? t("sprint2.checklist.criteria.commentRecommended") : t("sprint2.checklist.criteria.commentOptional")}
                          value={rep.commentaire}
                          onChange={e => handleComment(c.id, e.target.value)}
                          style={{ fontSize: 12 }}
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </FormSection>
        )}

        {criteres.length === 0 && <EmptyState icon="📋" message={t("sprint2.checklist.criteria.empty")} />}

        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", marginTop: 16 }}>
            ⚠ {error}
          </div>
        )}

        {criteres.length > 0 && (
          <BtnPrimary style={{ width: "100%", justifyContent: "center", padding: "13px 0", marginTop: 22, fontSize: 14 }}>
            {nbRouge > 0 ? t("sprint2.checklist.submit.withRed", { count: nbRouge }) : t("sprint2.checklist.submit.submit")}
          </BtnPrimary>
        )}
      </form>
    </div>
  );
}

function DrawerContent({ selected, sessions, results, statusCfg, locale, t, linkedPlans = [], isTechnicien = false, isChefLigne = false, isAgentQualite = false, isAdmin = false, userMatricule = "", onCloturerPlan, onValiderAQPlan }) {
  const resolveBucket = (r) => {
    const c = (r.critereCouleur || "").trim().toLowerCase();
    if (c === "jaune") return "JAUNE";
    if (c === "rouge") return "ROUGE";
    return r.valeur === "ROUGE" ? "ROUGE" : r.valeur === "JAUNE" ? "JAUNE" : r.valeur;
  };

  const allNC = (selected.reponses || []).filter(r => r.valeur === "ROUGE" || r.valeur === "JAUNE");
  const rouge = allNC.filter(r => resolveBucket(r) === "ROUGE");
  const jaune = allNC.filter(r => resolveBucket(r) === "JAUNE");
  const vert  = (selected.reponses || []).filter(r => r.valeur === "VERT");
  const na    = (selected.reponses || []).filter(r => r.valeur === "NA");
  const nc    = [...rouge, ...jaune];

  const sess = sessions.find(s => s.value === selected.session);
  const sm   = statusCfg[selected.status] || { label: selected.status, color: "var(--ink-3)", bg: "var(--surface-2)" };

  const infoItems = [
    { label: t("sprint2.checklist.details.machine"),  value: selected.machineNom || t("common.none") },
    { label: t("sprint2.checklist.details.operator"), value: `${selected.operateurNom || t("common.none")} ${selected.operateurMatricule ? `(${selected.operateurMatricule})` : ""}` },
    { label: t("sprint2.checklist.details.session"),  value: sess ? `${sess.icon} ${sess.label}` : selected.session || t("common.none") },
    { label: t("sprint2.checklist.details.site"),     value: selected.siteNom || t("common.none") },
    { label: t("sprint2.checklist.details.plant"),    value: selected.plantNom || t("common.none") },
    { label: t("sprint2.checklist.details.date"),     value: selected.date },
    ...(selected.dateValidationN1 ? [{ label: t("sprint2.checklist.details.validationN1"),   value: `${selected.valideN1Par || ""} · ${new Date(selected.dateValidationN1).toLocaleString(locale)}` }] : []),
    ...(selected.dateValidationN2 ? [{ label: t("sprint2.checklist.details.validationN2"),   value: `${selected.valideN2Par || ""} · ${new Date(selected.dateValidationN2).toLocaleString(locale)}` }] : []),
    ...(selected.dateValidationFinale ? [{ label: t("sprint2.checklist.details.validationFinal"), value: `${selected.valideParFinal || ""} · ${new Date(selected.dateValidationFinale).toLocaleString(locale)}` }] : []),
  ];

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <Pill label={sm.label} color={sm.color} bg={sm.bg} dot={sm.dot} />
      </div>

      <SectionLabel>{t("sprint2.checklist.drawer.details")}</SectionLabel>
      <div className="cl-info-grid" style={{ marginBottom: 20 }}>
        {infoItems.map(item => (
          <div key={item.label} className="cl-info-item">
            <div className="cl-info-label">{item.label}</div>
            <div className="cl-info-value">{item.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
        {rouge.length > 0 && <Pill label={`${rouge.length} ${t("sprint2.checklist.results.red")}`}       color="#7f1d1d" bg="#fee2e2" dot="#dc2626" />}
        {jaune.length > 0 && <Pill label={`${jaune.length} ${t("sprint2.checklist.results.yellow")}`}    color="#713f12" bg="#fef9c3" dot="#ca8a04" />}
        {vert.length  > 0 && <Pill label={`${vert.length} ${t("sprint2.checklist.results.green")}`}  color="#14532d" bg="#dcfce7" dot="#16a34a" />}
        {na.length    > 0 && <Pill label={`${na.length} ${t("sprint2.checklist.results.na")}`}         color="#374151" bg="#f3f4f6" dot="#9ca3af" />}
      </div>

      {selected.status === "REJETE" && selected.motifRejet && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.6px" }}>
            {t("sprint2.checklist.details.rejectionTitle")}
          </div>
          <div style={{ fontSize: 13, color: "#7f1d1d", lineHeight: 1.5 }}>{selected.motifRejet}</div>
        </div>
      )}

      {nc.length > 0 ? (
        <div>
          <SectionLabel>{t("sprint2.checklist.drawer.ncItems", { count: nc.length })}</SectionLabel>
          {nc.map(r => {
            const bucket  = resolveBucket(r);
            const isJaune = bucket === "JAUNE";
            const borderColor = isJaune ? "#ca8a04" : "#dc2626";
            const bg      = isJaune ? "#fef9c3" : "#fee2e2";
            const border  = isJaune ? "#fcd34d" : "#fecaca";
            const pillLabel = isJaune ? t("sprint2.checklist.drawer.warning") : t("sprint2.checklist.drawer.nonConforming");
            const pillColor = isJaune ? "#713f12" : "#7f1d1d";
            const pillDot   = isJaune ? "#ca8a04" : "#dc2626";
            return (
              <div key={r.id} className="cl-nc-item" style={{ background: bg, border: `1px solid ${border}`, borderLeftColor: borderColor }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div className="cl-nc-name">{r.critereNom || t("sprint2.checklist.details.criteriaFallback")}</div>
                  <Pill label={pillLabel} color={pillColor} bg={bg} dot={pillDot} />
                </div>
                {r.commentaire && <div className="cl-nc-comment">💬 {r.commentaire}</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px", background: "#f0fdf4", borderRadius: 12, border: "1px dashed #bbf7d0" }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>Tous les critères conformes</div>
        </div>
      )}

      {linkedPlans.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <SectionLabel>{t("sprint2.checklist.drawer.actionPlans", { count: linkedPlans.length })}</SectionLabel>
          {linkedPlans.map(plan => {
            const isClos    = plan.statut === "CLOS" || !!plan.closLe;
            const isValideAQ = plan.statut === "VALIDE_AQ";
            const isEnAttenteAQ = plan.enAttenteValidationAq || plan.statut === "EN_ATTENTE_VALIDATION_AQ";
            const isEnCours = plan.statut === "EN_COURS";
            const isRouge   = plan.couleurCritere === "ROUGE";
            const isJaune   = plan.couleurCritere === "JAUNE";

            let planColor, planBg, planDot, planLabel;
            if (isClos || isValideAQ) {
              planColor = "#14532d"; planBg = "#dcfce7"; planDot = "#16a34a";
              planLabel = isValideAQ ? t("sprint2.checklist.drawer.planValidatedAQ") : t("sprint2.checklist.drawer.planClosed");
            } else if (isEnAttenteAQ) {
              planColor = "#1e40af"; planBg = "#dbeafe"; planDot = "#3b82f6";
              planLabel = t("sprint2.checklist.drawer.planWaitingAQ");
            } else if (isEnCours) {
              planColor = "#78350f"; planBg = "#fef3c7"; planDot = "#f59e0b";
              planLabel = t("sprint2.checklist.drawer.planInProgress");
            } else {
              planColor = "#92400e"; planBg = "#fef9c3"; planDot = "#ca8a04";
              planLabel = t("sprint2.checklist.drawer.planToDo");
            }

            const couleurBg  = isRouge ? "#fee2e2" : "#fef9c3";
            const couleurTxt = isRouge ? "#991b1b" : "#713f12";
            const couleurDot = isRouge ? "#dc2626" : "#ca8a04";

            return (
              <div key={plan.id} className="cl-plan-item" style={{ background: planBg, border: `1px solid ${planDot}`, borderLeftColor: planDot }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: planColor, flex: 1 }}>{plan.description}</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: couleurBg, color: couleurTxt, border: `1px solid ${couleurDot}`, borderRadius: 6, padding: "2px 7px" }}>
                      {isRouge ? `🔴 ${t("sprint2.checklist.results.red")}` : `🟡 ${t("sprint2.checklist.results.yellow")}`}
                    </span>
                    <Pill label={planLabel} color={planColor} bg={planBg} dot={planDot} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: planColor, opacity: 0.8, marginBottom: 6 }}>
                  👤 {plan.responsableNom || plan.responsableMatricule || "—"}
                  {plan.dateEcheance && ` · 📅 ${plan.dateEcheance}`}
                </div>
                {plan.commentaireCloture && (
                  <div style={{ fontSize: 12, color: planColor, marginTop: 2, fontStyle: "italic" }}>💬 {plan.commentaireCloture}</div>
                )}
                {plan.valideAqParMatricule && (
                  <div style={{ fontSize: 11, color: "#14532d", marginTop: 2 }}>✅ {t("sprint2.checklist.drawer.validatedByAQ", { matricule: plan.valideAqParMatricule })}</div>
                )}

                {(() => {
                  const isAutres = plan.responsableMatricule === "AUTRES" || !!plan.responsableAutre;
                  const isCreatorChef = isChefLigne && String(plan.creeParMatricule || "").trim().toLowerCase() === userMatricule.toLowerCase();
                  const canCloseByTechnician = isTechnicien && isRouge && !isClos && !isValideAQ && !isEnAttenteAQ;
                  const canCloseByChefLigne = isCreatorChef && !isRouge && !isClos && !isValideAQ && !isEnAttenteAQ;
                  const canCloseRedByChefLigneAutres = isCreatorChef && isAutres && isRouge && !isClos && !isValideAQ && !isEnAttenteAQ;
                  const canClosePlan = (canCloseByTechnician || canCloseByChefLigne || canCloseRedByChefLigneAutres || isAdmin) && onCloturerPlan;
                  return canClosePlan ? (
                  <button onClick={() => onCloturerPlan(plan)} style={{
                    marginTop: 8, fontSize: 12, padding: "5px 12px", borderRadius: 6,
                    background: "#16a34a", color: "#fff", border: "1px solid #15803d",
                    cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600,
                    }}>{isChefLigne && isAutres && isRouge ? t("sprint2.checklist.drawer.treatOtherPlan") : t("sprint2.checklist.drawer.closePlan")}</button>
                  ) : null;
                })()}

                {(isAgentQualite || isAdmin) && isEnAttenteAQ && isRouge && onValiderAQPlan && (
                  <button onClick={() => onValiderAQPlan(plan)} style={{
                    marginTop: 8, fontSize: 12, padding: "5px 12px", borderRadius: 6,
                    background: "#2563eb", color: "#fff", border: "1px solid #1d4ed8",
                    cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600,
                  }}>{t("sprint2.checklist.drawer.validatePlanAQ")}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function LtpmCard({ bucket, checklists, onClick, t }) {
  const CFG = {
    ROUGE: { title: t("sprint2.checklist.ltpm.title"), accentColor: "#dc2626" },
    JAUNE: { title: t("sprint2.checklist.ltpm.title"), accentColor: "#ca8a04" },
    VERT:  { title: t("sprint2.checklist.ltpm.title"),  accentColor: "#16a34a" },
  };
  const cfg = CFG[bucket];

  return (
    <button
      className="cl-ltpm-card"
      onClick={onClick}
      style={{
        background: cfg.accentColor,
        boxShadow: `0 10px 28px ${cfg.accentColor}44`,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 16px 40px ${cfg.accentColor}66`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 10px 28px ${cfg.accentColor}44`; }}
    >
      <div className="cl-ltpm-card-title">{cfg.title}</div>
      <div className="cl-ltpm-card-count">{checklists.length}</div>
    </button>
  );
}

function LtpmModal({ bucket, checklists, onClose, onSelect, selectedId, drawerOpen, sessions, statusCfg, t }) {
  const CFG = {
    ROUGE: { title: t("sprint2.checklist.ltpm.title"), icon: "🔴", accentColor: "#dc2626", desc: t("sprint2.checklist.ltpm.redDesc") },
    JAUNE: { title: t("sprint2.checklist.ltpm.title"), icon: "🟡", accentColor: "#ca8a04", desc: t("sprint2.checklist.ltpm.yellowDesc") },
    VERT:  { title: t("sprint2.checklist.ltpm.title"),  icon: "🟢", accentColor: "#16a34a", desc: t("sprint2.checklist.ltpm.greenDesc") },
  };
  const cfg = CFG[bucket];

  const resolveBucket2 = (r) => {
    const col = (r.critereCouleur || "").trim().toLowerCase();
    if (col === "jaune") return "JAUNE";
    if (col === "rouge") return "ROUGE";
    return r.valeur === "ROUGE" ? "ROUGE" : r.valeur === "JAUNE" ? "JAUNE" : r.valeur;
  };

  return (
    <div className="cl-ltpm-modal-wrap">
      <div className="cl-ltpm-modal">
        <div className="cl-ltpm-modal-head">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: cfg.accentColor + "18",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>{cfg.icon}</div>
            <div>
              <div className="cl-ltpm-modal-title">{cfg.title}</div>
              <div className="cl-ltpm-modal-sub">{cfg.desc}</div>
            </div>
          </div>
          <button className="cl-drawer-close" onClick={onClose}>✕</button>
        </div>

        <div className="cl-ltpm-modal-body">
          {checklists.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--ink-4)" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
              <div>{t("sprint2.checklist.ltpm.empty")}</div>
            </div>
          ) : (
            checklists.map(c => {
              const isSelected = selectedId === c.id && drawerOpen;
              const sm   = statusCfg[c.status] || { label: c.status, color: "var(--ink-3)", bg: "var(--surface-2)", dot: "var(--surface-3)" };
              const sess = sessions.find(s => s.value === c.session);
              const ncList     = (c.reponses || []).filter(r => r.valeur === "ROUGE" || r.valeur === "JAUNE");
              const rougeCount = ncList.filter(r => resolveBucket2(r) === "ROUGE").length;
              const jauneCount = ncList.filter(r => resolveBucket2(r) === "JAUNE").length;
              const vertCount  = (c.reponses || []).filter(r => r.valeur === "VERT").length;

              return (
                <div key={c.id} className={`cl-ltpm-row ${isSelected ? "cl-ltpm-row-selected" : ""}`}
                  style={{ borderLeftColor: cfg.accentColor, borderLeftWidth: 4, ...(isSelected ? { borderColor: cfg.accentColor } : {}) }}
                  onClick={() => onSelect(c)}>
                  <div className="cl-ltpm-row-machine">🔧 {c.machineNom || t("common.none")}</div>
                  <div className="cl-ltpm-row-meta">
                    {sess && <span>{sess.icon} {sess.label}</span>}
                    {c.operateurNom && <span>👤 {c.operateurNom}</span>}
                    {c.processusNom && <span>⚙️ {c.processusNom}</span>}
                    <span style={{ marginLeft: "auto", color: "var(--ink-4)", fontSize: 11 }}>{c.date}</span>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill label={sm.label} color={sm.color} bg={sm.bg} dot={sm.dot} />
                    {rougeCount > 0 && <Pill label={`${rougeCount} NC`}  color="#7f1d1d" bg="#fee2e2" dot="#dc2626" />}
                    {jauneCount > 0 && <Pill label={`${jauneCount} ⚠`}  color="#713f12" bg="#fef9c3" dot="#ca8a04" />}
                    {vertCount  > 0 && <Pill label={`${vertCount} ✓`}   color="#14532d" bg="#dcfce7" dot="#16a34a" />}
                    <span style={{ marginLeft: "auto", fontSize: 11, color: cfg.accentColor, fontWeight: 700 }}>{t("sprint2.checklist.ltpm.view")} →</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
