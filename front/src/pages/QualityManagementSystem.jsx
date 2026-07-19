import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";
import {
  checklistAPI,
  planActionAPI,
  utilisateurAPI,
  getAllCriteres,
  getAllSites,
  getAllPlants,
} from "../api/index";
import { getStatusMeta } from "../utils/statusConfig";
import Pagination, { usePagination } from "../components/Pagination";
import useToast from "../hooks/useToast";

const isPPO = (role) => role === "PPO";

/* ═══════════════════════════════════════════════════════════════
   WORKFLOW — règles métier
   ─────────────────────────────────────────────────────────────
   Critère ROUGE non-conforme :
     1. CL crée plan d'action ROUGE
     2. Technicien traite & clôture → statut EN_ATTENTE_VALIDATION_AQ
     3. Agent Qualité valide le plan → statut VALIDE_AQ
     4. CL valide N1 checklist  (seulement si PA VALIDE_AQ)
     5. Technicien valide N2 checklist  (seulement si PA VALIDE_AQ)
     6. Agent Qualité valide N3/Final (seulement si PA=VALIDE_AQ et N1+N2 faits)

   Critère JAUNE non-conforme :
     1. CL crée plan d'action JAUNE
     2. Technicien traite & clôture → statut CLOS
     3. Technicien valide N2  (dès que plan CLOS)
     4. CL valide N1 (seulement si plan CLOS)
     5. Agent Qualité valide N3/Final (seulement si N1 ET N2 déjà validés)

   Mix ROUGE + JAUNE :
     → Un plan ROUGE ET un plan JAUNE doivent tous les deux être créés
     → Toutes les conditions des deux workflows s'appliquent
═══════════════════════════════════════════════════════════════ */

const isPlanClosed = (plan) =>
  plan?.statut === "CLOS" ||
  plan?.statut === "EN_ATTENTE_VALIDATION_AQ" ||
  plan?.statut === "VALIDE_AQ" ||
  !!plan?.closLe;

const isPlanRouge = (plan) =>
  (plan?.couleurCritere || "").toUpperCase() === "ROUGE";

const isPlanTerminal = (plan) =>
  plan?.statut === "VALIDE_AQ" ||
  (plan?.statut === "CLOS" && !isPlanRouge(plan));

const isPlanEnAttenteAQ = (plan) =>
  plan?.statut === "EN_ATTENTE_VALIDATION_AQ";

const toRecentTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortMostRecentDesc = (arr, getDateValue) =>
  (Array.isArray(arr) ? arr.slice().sort((a, b) => {
    const diff = toRecentTime(getDateValue(b)) - toRecentTime(getDateValue(a));
    if (diff !== 0) return diff;
    return (Number(b?.id) || 0) - (Number(a?.id) || 0);
  }) : []);

/* ═══════════════════════════════════════════════════════════════
   STYLE MODERNE - CSS
═══════════════════════════════════════════════════════════════ */

const css = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  .qms-pro {
    --primary: #4f46e5;
    --primary-dark: #4338ca;
    --primary-light: #818cf8;
    --primary-bg: #eef2ff;
    --success: #10b981;
    --success-dark: #059669;
    --warning: #f59e0b;
    --error: #ef4444;
    --info: #3b82f6;
    --purple: #7c3aed;
    --purple-light: #a78bfa;
    --indigo: #6366f1;
    --rose: #f43f5e;
    --cyan: #06b6d4;
    --emerald: #059669;
    --amber: #d97706;
    --gray-50: #fafafa;
    --gray-100: #f5f5f5;
    --gray-200: #e5e5e5;
    --gray-300: #d4d4d8;
    --gray-400: #a1a1aa;
    --gray-500: #71717a;
    --gray-600: #52525b;
    --gray-700: #3f3f46;
    --gray-800: #27272a;
    --gray-900: #18181b;
    --bg-page: #f4f6fa;
    --bg-surface: #ffffff;
    --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    --shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
    --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
    --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-xl: 18px;
    --radius-2xl: 24px;
    --radius-full: 9999px;
  }
  
  .qms-pro {
    font-family: var(--font-sans);
    background: linear-gradient(180deg, #f6f8fc 0%, #eef2f7 100%);
    color: var(--gray-800);
    min-height: 100vh;
  }

  /* Plan Modal — Design Pro International */
  .plan-modal-v2 {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1050;
    padding: 20px;
    animation: modalBackdropIn 0.2s ease;
  }

  @keyframes modalBackdropIn {
    from { opacity: 0; backdrop-filter: blur(0px); }
    to { opacity: 1; backdrop-filter: blur(8px); }
  }

  .plan-card {
    background: var(--bg-surface);
    border-radius: var(--radius-2xl);
    width: 100%;
    max-width: 880px;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: var(--shadow-2xl);
    animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .plan-header {
    padding: 24px 28px;
    background: linear-gradient(135deg, var(--gray-50) 0%, var(--bg-surface) 100%);
    border-bottom: 1px solid var(--gray-200);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .plan-header-content {
    flex: 1;
  }

  .plan-badge-header {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }

  .plan-badge-header.rouge {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    color: var(--error);
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .plan-badge-header.jaune {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    color: var(--warning);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }

  .plan-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: var(--gray-900);
    line-height: 1.3;
    margin-bottom: 8px;
  }

  .plan-subtitle {
    font-size: 13px;
    color: var(--gray-500);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .plan-subtitle-sep {
    width: 4px;
    height: 4px;
    background: var(--gray-300);
    border-radius: 50%;
  }

  .plan-close-btn {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-lg);
    background: var(--gray-100);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--transition-fast);
    color: var(--gray-500);
  }

  .plan-close-btn:hover {
    background: var(--error);
    color: white;
    transform: scale(1.05);
  }

  .plan-body {
    padding: 28px;
    overflow-y: auto;
    max-height: calc(90vh - 180px);
  }

  .plan-grid-modern {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: 28px;
  }

  @media (max-width: 780px) {
    .plan-grid-modern { grid-template-columns: 1fr; }
    .plan-body { padding: 20px; }
    .plan-header { padding: 20px; }
  }

  /* Section Principale */
  .plan-main-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Progress Card */
  .progress-card {
    background: linear-gradient(135deg, var(--gray-50) 0%, var(--bg-surface) 100%);
    border-radius: var(--radius-xl);
    padding: 20px;
    border: 1px solid var(--gray-200);
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }

  .progress-label {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--gray-500);
  }

  .progress-percent {
    font-size: 28px;
    font-weight: 800;
    color: var(--gray-900);
  }

  .progress-bar-modern {
    height: 8px;
    background: var(--gray-200);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin: 12px 0;
  }

  .progress-fill-modern {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.4s ease;
    position: relative;
    overflow: hidden;
  }

  .progress-fill-modern::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }

  /* Alert Cards */
  .alert-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-radius: var(--radius-lg);
    font-size: 13px;
    font-weight: 500;
  }

  .alert-card-success {
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
    border: 1px solid #a7f3d0;
    color: var(--success-dark);
  }

  .alert-card-info {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    color: var(--info);
  }

  .alert-card-warning {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 1px solid #fde68a;
    color: var(--warning);
  }

  .alert-card-danger {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border: 1px solid #fecaca;
    color: var(--error);
  }

  /* Description Card */
  .description-card {
    background: var(--gray-50);
    border-radius: var(--radius-lg);
    padding: 20px;
    border: 1px solid var(--gray-200);
  }

  .description-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--gray-500);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .description-text {
    font-size: 14px;
    line-height: 1.6;
    color: var(--gray-700);
  }

  /* Sidebar Section */
  .plan-sidebar {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* Info Card */
  .info-card {
    background: var(--bg-surface);
    border-radius: var(--radius-xl);
    border: 1px solid var(--gray-200);
    overflow: hidden;
  }

  .info-card-header {
    padding: 16px 20px;
    background: var(--gray-50);
    border-bottom: 1px solid var(--gray-200);
    font-weight: 700;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--gray-600);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .info-card-body {
    padding: 20px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--gray-100);
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--gray-500);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .info-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--gray-800);
    text-align: right;
    word-break: break-word;
  }

  .info-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
  }

  /* Comment Card */
  .comment-card {
    background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
    border-radius: var(--radius-lg);
    padding: 18px;
    border: 1px solid rgba(124, 58, 237, 0.15);
  }

  .comment-card-technician {
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border-color: rgba(59, 130, 246, 0.15);
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .comment-text {
    font-size: 13px;
    line-height: 1.5;
    color: var(--gray-700);
    font-style: italic;
  }

  .comment-meta {
    font-size: 11px;
    color: var(--gray-500);
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Action Buttons */
  .plan-actions-modern {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 8px;
  }

  .btn-modern {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: var(--radius-lg);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    border: none;
    font-family: inherit;
  }

  .btn-modern-primary {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
    color: white;
    box-shadow: var(--shadow-sm);
  }

  .btn-modern-primary:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .btn-modern-warning {
    background: linear-gradient(135deg, var(--warning) 0%, var(--amber) 100%);
    color: white;
  }

  .btn-modern-warning:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .btn-modern-success {
    background: linear-gradient(135deg, var(--success) 0%, var(--success-dark) 100%);
    color: white;
  }

  .btn-modern-success:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .btn-modern-purple {
    background: linear-gradient(135deg, var(--purple) 0%, #6d28d9 100%);
    color: white;
  }

  .btn-modern-purple:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .btn-modern-outline {
    background: transparent;
    border: 1.5px solid var(--gray-300);
    color: var(--gray-600);
  }

  .btn-modern-outline:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-bg);
  }

  .btn-modern-sm {
    padding: 6px 14px;
    font-size: 12px;
  }

  /* Statut Badge dans le panneau */
  .plan-status-badge-modern {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 700;
  }

  /* Timeline */
  .timeline {
    margin-top: 16px;
  }

  .timeline-item {
    display: flex;
    gap: 12px;
    padding: 12px 0;
    position: relative;
  }

  .timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 14px;
    top: 32px;
    bottom: -8px;
    width: 2px;
    background: var(--gray-200);
  }

  .timeline-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    z-index: 1;
  }

  .timeline-dot-done {
    background: var(--success);
    color: white;
  }

  .timeline-dot-pending {
    background: var(--gray-200);
    color: var(--gray-500);
  }

  .timeline-dot-current {
    background: var(--primary);
    color: white;
    box-shadow: 0 0 0 3px var(--primary-bg);
  }

  .timeline-content {
    flex: 1;
  }

  .timeline-title {
    font-weight: 700;
    font-size: 13px;
    color: var(--gray-800);
    margin-bottom: 4px;
  }

  .timeline-desc {
    font-size: 11px;
    color: var(--gray-500);
  }

  /* Reste des styles inchangé... */
  .validation-layout { display: grid; gap: 24px; transition: all var(--transition-base); }
  .validation-layout.with-sidebar { grid-template-columns: minmax(0, 1fr) 380px; }
  .validation-layout.without-sidebar { grid-template-columns: 1fr; }
  
  .table-container { overflow-x: auto; margin: 0 -24px; padding: 0 24px; width: 100%; }
  .validation-table { width: 100%; min-width: 800px; border-collapse: collapse; }

  @media (max-width: 1200px) {
    .validation-layout.with-sidebar { grid-template-columns: 1fr; }
    .validation-layout.with-sidebar .sidebar { margin-top: 24px; }
  }
  @media (max-width: 768px) {
    .table-container { margin: 0 -16px; padding: 0 16px; }
    .validation-table { min-width: 700px; }
    td, th { padding: 10px 12px; font-size: 12px; }
  }
  @media (max-width: 480px) {
    .validation-table thead { display: none; }
    .validation-table tbody tr { display: block; margin-bottom: 16px; border: 1px solid var(--gray-200); border-radius: 16px; padding: 12px; background: var(--bg-surface); }
    .validation-table tbody td { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--gray-100); text-align: right; }
    .validation-table tbody td:last-child { border-bottom: none; }
    .validation-table tbody td::before { content: attr(data-label); font-weight: 600; color: var(--gray-600); text-align: left; flex: 1; font-size: 12px; }
    .validation-table tbody td > * { flex: 2; text-align: right; }
  }

  .qms-nav { background: rgba(255,255,255,0.98); border-bottom: 1px solid var(--gray-200); padding: 0 32px; display: flex; align-items: center; gap: 6px; position: sticky; top: 0; z-index: 200; height: 64px; backdrop-filter: blur(8px); }
  .qms-nav-tab { padding: 8px 20px; border-radius: 40px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: var(--gray-500); transition: all var(--transition-fast); }
  .qms-nav-tab:hover { background: var(--gray-100); color: var(--gray-700); }
  .qms-nav-tab.active { background: var(--primary-bg); color: var(--primary); }
  
  .page { padding: 32px; max-width: 1440px; margin: 0 auto; width: 100%; background: transparent; }
  
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; }
  .kpi-card { background: var(--bg-surface); border-radius: 20px; padding: 20px; transition: all var(--transition-base); border: 1px solid var(--gray-200); position: relative; overflow: hidden; }
  .kpi-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
  .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
  .kpi-card.blue::before { background: var(--primary); }
  .kpi-card.green::before { background: var(--success); }
  .kpi-card.red::before { background: var(--error); }
  .kpi-card.orange::before { background: var(--warning); }
  .kpi-card.purple::before { background: var(--purple); }
  .kpi-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--gray-500); margin-bottom: 8px; }
  .kpi-value { font-size: 36px; font-weight: 800; color: var(--gray-900); line-height: 1.2; }
  .kpi-sub { font-size: 12px; color: var(--gray-500); margin-top: 8px; }
  
  .qms-filter-panel { display: grid; gap: 16px; background: var(--bg-surface); border: 1px solid var(--gray-200); border-radius: 22px; padding: 18px; margin-bottom: 24px; box-shadow: var(--shadow-sm); }
  .qms-filter-grid { display: grid; gap: 12px; align-items: end; }
  .qms-filter-grid--checklists { grid-template-columns: minmax(220px, 2fr) repeat(5, minmax(150px, 1fr)); }
  .qms-filter-grid--plans { grid-template-columns: minmax(220px, 2fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr) auto; }
  .qms-filter-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .qms-filter-label { font-size: 12px; font-weight: 700; letter-spacing: 0.02em; color: var(--gray-500); white-space: nowrap; }
  .qms-filter-control { display: flex; align-items: center; gap: 8px; min-height: 48px; border-radius: 16px; border: 1px solid var(--gray-200); background: var(--gray-50); padding: 0 12px; transition: all var(--transition-fast); }
  .qms-filter-control:focus-within { border-color: var(--primary); background: var(--bg-surface); box-shadow: 0 0 0 3px var(--primary-bg); }
  .qms-filter-icon { color: var(--gray-400); display: flex; align-items: center; flex: 0 0 auto; }
  .qms-filter-control input { flex: 1; min-width: 0; border: none; background: transparent; padding: 11px 0; font-size: 13px; outline: none; color: var(--gray-700); }
  .qms-filter-control select { flex: 1; min-width: 0; border: none; background: transparent; padding: 11px 24px 11px 0; font-size: 13px; font-weight: 500; color: var(--gray-700); cursor: pointer; outline: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 2px center; }
  .qms-filter-clear { background: none; border: none; color: var(--gray-400); cursor: pointer; padding: 4px; border-radius: 999px; display: flex; align-items: center; flex: 0 0 auto; }
  .qms-filter-clear:hover { background: rgba(239,68,68,0.1); color: var(--error); }
  .qms-filter-footer { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
  .qms-filter-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .qms-filter-counter { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 999px; background: var(--gray-50); border: 1px solid var(--gray-200); }
  .counter-badge { background: var(--primary); color: white; font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 20px; min-width: 32px; text-align: center; }
  .counter-label { font-size: 12px; color: var(--gray-500); font-weight: 500; }
  .qms-filter-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
  .qms-filter-reset { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--gray-50); border: 1px solid var(--gray-200); color: var(--gray-600); cursor: pointer; white-space: nowrap; }
  .qms-filter-reset:hover { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); color: var(--error); }
  .qms-filter-toggle { display: inline-flex; gap: 4px; background: var(--gray-100); padding: 4px; border-radius: 999px; border: 1px solid var(--gray-200); }
  .qms-filter-toggle-btn { padding: 7px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: var(--gray-600); }
  .qms-filter-toggle-btn.active { background: var(--bg-surface); box-shadow: var(--shadow-sm); color: var(--primary); }
  
  .card { background: var(--bg-surface); border: 1px solid var(--gray-200); border-radius: 20px; padding: 20px 24px; transition: all var(--transition-base); }
  .card:hover { box-shadow: var(--shadow-md); }
  .card-title { font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 10px; margin-bottom: 16px; color: var(--gray-800); }
  .card-title-icon { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .tbl-wrap { overflow-x: auto; margin: 0 -24px; padding: 0 24px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 12px 16px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--gray-500); background: var(--gray-50); border-bottom: 1px solid var(--gray-200); }
  td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid var(--gray-100); color: var(--gray-600); }
  tbody tr { transition: background var(--transition-fast); cursor: pointer; }
  tbody tr:hover { background: var(--gray-50); }
  
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 40px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: var(--primary-bg); color: var(--primary); }
  .badge-green { background: rgba(16,185,129,0.1); color: var(--success); }
  .badge-red { background: rgba(239,68,68,0.1); color: var(--error); }
  .badge-orange { background: rgba(245,158,11,0.1); color: var(--warning); }
  .badge-gray { background: var(--gray-100); color: var(--gray-600); }
  .badge-purple { background: rgba(124,58,237,0.1); color: var(--purple); }
  
  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 40px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); border: none; }
  .btn-primary { background: var(--primary); color: white; }
  .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); }
  .btn-ghost { background: transparent; border: 1.5px solid var(--gray-200); color: var(--gray-600); }
  .btn-ghost:hover { border-color: var(--primary); color: var(--primary); }
  .btn-danger { background: rgba(239,68,68,0.1); color: var(--error); }
  .btn-success { background: var(--success); color: white; }
  .btn-warning { background: var(--warning); color: white; }
  .btn-purple { background: var(--purple); color: white; }
  .btn-sm { padding: 6px 14px; font-size: 12px; }
  .btn-xs { padding: 4px 10px; font-size: 11px; border-radius: 20px; }
  
  .sidebar { background: var(--bg-surface); border-radius: 20px; border: 1px solid var(--gray-200); overflow: hidden; position: sticky; top: 96px; }
  .val-levels { display: flex; flex-direction: column; gap: 10px; }
  .val-level { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 12px; }
  .val-level-dot { width: 28px; height: 28px; border-radius: 28px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
  .nc-cards { display: flex; flex-direction: column; gap: 12px; }
  .nc-card { padding: 14px; border-radius: 12px; background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.15); }
  .decision-options { display: flex; flex-direction: column; gap: 10px; }
  .decision-option { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; border: 1.5px solid var(--gray-200); cursor: pointer; }
  .decision-option.selected { border-color: var(--primary); background: var(--primary-bg); }
  
  .kanban-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .kanban-col { background: var(--gray-50); border-radius: 16px; padding: 16px; }
  .kanban-col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding: 12px; border-radius: 12px; }
  .kanban-card { background: var(--bg-surface); border-radius: 12px; padding: 14px; margin-bottom: 12px; border: 1px solid var(--gray-200); cursor: pointer; transition: all var(--transition-fast); }
  .kanban-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .kanban-empty { padding: 32px; text-align: center; color: var(--gray-500); background: var(--gray-100); border-radius: 12px; }
  
  .progress-bar { height: 8px; background: var(--gray-200); border-radius: 40px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 40px; transition: width var(--transition-base); }
  .avatar { border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
  .alert { padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 10px; border: 1px solid; }
  .alert-danger { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.2); color: var(--error); }
  .alert-success { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.2); color: var(--success); }
  .alert-warning { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2); color: var(--warning); }
  .alert-info { background: rgba(124,58,237,0.08); border-color: rgba(124,58,237,0.2); color: var(--purple); }
  
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1025; padding: 20px; padding-top: calc(var(--nb-h, 66px) + 16px); }
  .modal { background: var(--bg-surface); border-radius: 24px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; }
  .modal-header { padding: 20px 24px; border-bottom: 1px solid var(--gray-200); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--bg-surface); }
  .modal-body { padding: 20px 24px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid var(--gray-200); display: flex; justify-content: flex-end; gap: 12px; }

  .field { margin-bottom: 20px; }
  .field label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--gray-700); }
  .field input, .field select, .field textarea { width: 100%; padding: 10px 14px; border: 1.5px solid var(--gray-200); border-radius: 12px; font-size: 13px; transition: all var(--transition-fast); outline: none; }
  .field input:focus, .field select:focus, .field textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
  
  .plan-workflow-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .plan-workflow-badge.rouge { background: rgba(239,68,68,0.12); color: var(--error); border: 1px solid rgba(239,68,68,0.25); }
  .plan-workflow-badge.jaune { background: rgba(245,158,11,0.12); color: var(--warning); border: 1px solid rgba(245,158,11,0.25); }
  .plan-workflow-badge.attente-aq { background: rgba(124,58,237,0.1); color: var(--purple); border: 1px solid rgba(124,58,237,0.2); }
  .plan-workflow-badge.valide-aq { background: rgba(16,185,129,0.1); color: var(--success); border: 1px solid rgba(16,185,129,0.2); }

  .loading-page { display: flex; align-items: center; justify-content: center; min-height: 400px; gap: 12px; }
  .spinner { width: 32px; height: 32px; border: 3px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  
  @media (max-width: 1024px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .kanban-grid { grid-template-columns: 1fr; }
    .page { padding: 20px; }
  }
  @media (max-width: 768px) {
    .kpi-grid { grid-template-columns: 1fr; }
    .qms-filter-grid { grid-template-columns: 1fr; }
    .qms-filter-footer { align-items: stretch; }
    .qms-filter-meta, .qms-filter-actions { width: 100%; justify-content: center; }
    .qms-filter-actions { justify-content: stretch; }
    .qms-filter-toggle { width: 100%; justify-content: center; }
  }
`;

/* ═══════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════ */

const fmt = (date) => {
  if (!date) return "—";
  try { return new Date(date).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return "—"; }
};

const fmtDatetime = (dt) => {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString("fr-FR", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }); }
  catch { return "—"; }
};

const truncate = (text, max = 80) => {
  if (!text) return "";
  const t = String(text);
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
};

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

const normalizeNcValue = (v) => String(v || "").trim().toUpperCase();

let GLOBAL_CRITERE_MAP = new Map();
const setGlobalCritereMap = (map) => { GLOBAL_CRITERE_MAP = map || new Map(); };
const normalizeCritereCouleur = (v) => {
  const n = normalizeNcValue(v);
  if (n === "ROUGE" || n === "RED") return "ROUGE";
  if (n === "JAUNE" || n === "YELLOW") return "JAUNE";
  if (n === "VERT" || n === "GREEN") return "VERT";
  return "";
};

const resolveNcBucketValue = (r) => {
  let byCritere = normalizeCritereCouleur(r?.critereCouleur);
  if (!byCritere && r?.critereId) {
    const c = GLOBAL_CRITERE_MAP.get(Number(r.critereId));
    if (c) byCritere = normalizeCritereCouleur(c);
  }
  if (byCritere === "JAUNE") return "JAUNE";
  if (byCritere === "ROUGE") return "ROUGE";
  const byValeur = normalizeNcValue(r?.valeur);
  return byValeur === "ROUGE" || byValeur === "JAUNE" ? byValeur : "";
};

const extractNCs = (cl) => (cl?.reponses || []).filter(r => r.valeur === "ROUGE" || r.valeur === "JAUNE");

/* ── Détection par type — INDÉPENDANTS l'un de l'autre ── */
const hasRedNCInChecklist = (cl) => (cl?.reponses || []).some(r =>
  (r.valeur === "ROUGE" || r.valeur === "JAUNE") && resolveNcBucketValue(r) === "ROUGE"
);

const hasYellowNCInChecklist = (cl) => (cl?.reponses || []).some(r =>
  (r.valeur === "ROUGE" || r.valeur === "JAUNE") && resolveNcBucketValue(r) === "JAUNE"
);

const parseErrorMsg = (e, fallback = "Erreur.") => {
  const data = e?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (typeof data === "object") return data.message || data.error || fallback;
  return fallback;
};

/* ═══════════════════════════════════════════════════════════════
   COMPOSANTS SHARED
═══════════════════════════════════════════════════════════════ */

const Avatar = ({ nom = "", size = 28 }) => {
  const initials = (nom || "?").trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()).join("") || "?";
  return <div className="avatar" style={{ width:size, height:size, fontSize:size*0.36 }}>{initials}</div>;
};

const StatusBadge = ({ status }) => {
  const { t } = useI18n();
  const m = getStatusMeta(status);
  return <span className={`badge ${m.cls}`}>{m.label || t(`status.checklist.${status?.toLowerCase()}`) || status}</span>;
};

const PlanStatutBadge = ({ plan }) => {
  const { t } = useI18n();
  const statut = plan?.statut;
  const couleur = (plan?.couleurCritere || "").toUpperCase();
  if (statut === "VALIDE_AQ")
    return <span className="plan-workflow-badge valide-aq">✅ {t("qms.filters.statusValideAq")}</span>;
  if (statut === "EN_ATTENTE_VALIDATION_AQ")
    return <span className="plan-workflow-badge attente-aq">⏳ {t("qms.filters.statusAttenteAq")}</span>;
  if (statut === "CLOS")
    return <span className="badge badge-green">✓ {t("qms.filters.statusClos")}</span>;
  if (statut === "EN_COURS")
    return <span className="badge badge-blue">▶ {t("qms.stats.inProgress")}</span>;
  if (couleur === "ROUGE")
    return <span className="plan-workflow-badge rouge">🔴 {t("qms.workflow.rougeToProcess")}</span>;
  if (couleur === "JAUNE")
    return <span className="plan-workflow-badge jaune">🟡 {t("qms.workflow.jauneToProcess")}</span>;
  return <span className="badge badge-orange">{t("qms.workflow.toDo")}</span>;
};

const StatCard = ({ label, value, sub, color = "blue" }) => (
  <div className={`kpi-card ${color}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

const ProgressBar = ({ pct, color = "blue" }) => (
  <div className="progress-bar">
    <div className="progress-fill" style={{ width:`${Math.min(100,Math.max(0,pct||0))}%`, background:`var(--${color})` }} />
  </div>
);

const IcoSearch = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
  </svg>
);

const LoadingPage = () => {
  const { t } = useI18n();
  return (
    <div className="loading-page"><span className="spinner" /><span>{t("common.loading") || "Chargement…"}</span></div>
  );
};

const ToastNotification = ({ toast }) => {
  const { t } = useI18n();
  if (!toast) return null;
  return (
    <div style={{ position:"fixed", top:80, right:24, zIndex:999, maxWidth:380 }} className={`alert alert-${toast.type}`}>
      {toast.type === "success" ? "✓" : "⚠"} {toast.msg}
    </div>
  );
};

const AccessDenied = ({ message, redirectTo = "/criteres", redirectLabelKey = "qms.accessDenied.redirectLabel" }) => {
  const { t } = useI18n();
  return (
    <div className="page" style={{ textAlign:"center", paddingTop:"80px" }}>
      <div className="card" style={{ maxWidth:480, margin:"0 auto" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔒</div>
        <h3>{t("app.unauthorized.title")}</h3>
        <p style={{ color:"var(--gray-600)", marginBottom:24 }}>{message || t("app.unauthorized.message")}</p>
        <button className="btn btn-primary" onClick={() => { window.location.href = redirectTo; }}>
          {t(redirectLabelKey)}
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MODAL — Valider AQ
═══════════════════════════════════════════════════════════════ */

function ModalValiderAQ({ plan, onClose, onValidated }) {
  const { t } = useI18n();
  const [commentaire, setCommentaire] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async () => {
    if (!plan || !isPlanRouge(plan) || !isPlanEnAttenteAQ(plan)) {
      setErr(t("qms.toasts.redAutoError") || "Ce plan n'est pas prêt pour la validation AQ.");
      return;
    }
    setLoading(true); setErr(null);
    try {
      await planActionAPI.validerAQ(plan.id, commentaire.trim());
      onValidated();
      onClose();
    } catch (e) {
      setErr(parseErrorMsg(e, t("qms.toasts.redAutoError")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--bg-surface)", borderRadius:14, border:"1px solid var(--gray-200)", padding:"28px 28px 24px", width:"100%", maxWidth:460, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", animation:"planModalIn 0.2s ease" }}>
        <style>{`@keyframes planModalIn{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--gray-900)", marginBottom:8 }}>
          {t("qms.validateAqModal.title")}
        </div>
        <div style={{ fontSize:13, color:"var(--gray-500)", marginBottom:16 }}>
          {t("qms.validateAqModal.subtitle")}
        </div>
        <div style={{ background:"rgba(124,58,237,0.06)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:16, fontSize:13 }}>
          <div style={{ fontWeight:700, marginBottom:4 }}>{plan.description}</div>
          <div style={{ color:"var(--gray-500)", fontSize:12 }}>
            {t("qms.validateAqModal.processedBy", { name: plan.responsableNom || "—", date: fmtDatetime(plan.closLe) })}
          </div>
          {plan.commentaireCloture && (
            <div style={{ color:"var(--gray-600)", fontSize:12, marginTop:6, fontStyle:"italic" }}>
              💬 {plan.commentaireCloture}
            </div>
          )}
        </div>
        {err && <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, padding:"8px 12px", fontSize:13, color:"var(--error)", marginBottom:14 }}>⚠ {err}</div>}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:10, fontWeight:700, letterSpacing:"0.9px", textTransform:"uppercase", color:"var(--gray-500)", marginBottom:6, display:"block" }}>
            {t("common.comment")} <span style={{ color:"var(--gray-400)", fontWeight:400 }}>({t("common.optional")})</span>
          </label>
          <textarea style={{ width:"100%", boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:"1px solid var(--gray-200)", fontSize:13, fontFamily:"inherit", background:"var(--gray-50)", color:"var(--gray-800)", outline:"none", resize:"vertical", minHeight:72 }} placeholder={t("qms.validateAqModal.commentPlaceholder")} value={commentaire} onChange={e => setCommentaire(e.target.value)} autoFocus />
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--gray-50)", color:"var(--gray-600)", border:"1px solid var(--gray-200)" }} onClick={onClose}>{t("common.cancel")}</button>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--purple)", color:"#fff", border:"1px solid var(--purple)", opacity:loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> {t("qms.validateAqModal.validating")}</> : `✓ ${t("qms.validateAqModal.validate")}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODAL — Créer plan d'action
═══════════════════════════════════════════════════════════════ */

function ModalNouveauPlan({ checklistId, couleurDominante = "JAUNE", onClose, onCreated }) {
  const { t } = useI18n();
  const isRouge = couleurDominante === "ROUGE";
  const [form, setForm] = useState({ description: "", dateEcheance: "", responsableMatricule: "", responsableAutre: "", couleurCritere: couleurDominante });
  const [techniciens, setTechniciens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    utilisateurAPI.findAll().then(r => {
      const all = r.data || [];
      setTechniciens(all.filter(u => u.role === "TECHNICIEN"));
    }).catch(() => {});
  }, []);

  const handleSuggest = async () => {
    setSuggest(true);
    try {
      const r = await planActionAPI.suggererDescription(checklistId);
      setForm(f => ({ ...f, description: r.data?.description || f.description }));
    } catch { } finally { setSuggest(false); }
  };

  const handleSubmit = async () => {
    if (!form.description.trim()) { setErr(t("qms.planAction.descriptionRequired")); return; }
    if (form.responsableMatricule !== "AUTRES" && !form.responsableMatricule) { setErr(t("qms.planAction.technicianRequired")); return; }
    if (form.responsableMatricule === "AUTRES" && !form.responsableAutre?.trim()) { setErr(t("qms.planAction.otherRequired") || "Veuillez préciser la personne à assigner."); return; }
    if (!form.dateEcheance) { setErr(t("qms.planAction.deadlineRequired")); return; }
    setLoading(true); setErr(null);
    try {
      const payload = { checklistId, description: form.description, dateEcheance: form.dateEcheance, couleurCritere: couleurDominante };
      if (form.responsableMatricule === "AUTRES") {
        payload.responsableMatricule = "AUTRES";
        payload.responsableAutre = form.responsableAutre;
      } else {
        payload.responsableMatricule = form.responsableMatricule;
      }
      await planActionAPI.creer(payload);
      onCreated(); onClose();
    } catch (e) { setErr(parseErrorMsg(e, t("qms.toasts.redAutoError"))); }
    finally { setLoading(false); }
  };

  const sLabel = { fontSize:10, fontWeight:700, letterSpacing:"0.9px", textTransform:"uppercase", color:"var(--gray-500)", marginBottom:6, display:"block" };
  const sInput = { width:"100%", boxSizing:"border-box", padding:"9px 12px", borderRadius:8, border:"1px solid var(--gray-200)", fontSize:13, fontFamily:"inherit", background:"var(--gray-50)", color:"var(--gray-800)", outline:"none" };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--bg-surface)", borderRadius:14, border:"1px solid var(--gray-200)", padding:"28px 28px 24px", width:"100%", maxWidth:460, boxShadow:"0 20px 60px rgba(0,0,0,0.2)", animation:"planModalIn 0.2s ease" }}>
        <style>{`@keyframes planModalIn{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
        <div style={{ fontSize:15, fontWeight:700, color:"var(--gray-900)", marginBottom:6 }}>
          {t("qms.planAction.createTitle", { id: checklistId })}
        </div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, background: isRouge ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${isRouge ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`, color: isRouge ? "var(--error)" : "var(--warning)", marginBottom:12 }}>
          {isRouge ? t("qms.planAction.rougeLabel") : t("qms.planAction.jauneLabel")}
          <span style={{ fontWeight:400, color: isRouge ? "rgba(239,68,68,0.7)" : "rgba(245,158,11,0.7)" }}>
            — {isRouge ? t("qms.planAction.rougeNote") : t("qms.planAction.jauneNote")}
          </span>
        </div>
        {err && <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, padding:"8px 12px", fontSize:13, color:"var(--error)", marginBottom:14 }}>⚠ {err}</div>}
        <div style={{ marginBottom:14 }}>
          <label style={sLabel}>{t("common.description")} <span style={{ color:"var(--error)" }}>*</span></label>
          <textarea style={{ ...sInput, resize:"vertical", minHeight:88, marginBottom:8 }} placeholder={t("qms.planAction.descriptionPlaceholder")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} autoFocus />
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--gray-100)", color:"var(--gray-700)", border:"1px solid var(--gray-200)", opacity:suggest ? 0.6 : 1 }} onClick={handleSuggest} disabled={suggest}>
            {suggest ? <><span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> {t("qms.planAction.generating")}</> : `✨ ${t("qms.planAction.suggestAI")}`}
          </button>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={sLabel}>{t("common.responsible")} <span style={{ color:"var(--error)" }}>*</span></label>
          <select style={sInput} value={form.responsableMatricule} onChange={e => setForm(f => ({ ...f, responsableMatricule: e.target.value }))}>
            <option value="">{t("qms.planAction.selectTechnician")}</option>
            {techniciens.map(u => <option key={u.matricule || u.id} value={u.matricule || u.id}>{u.nom} {u.prenom || ""} {u.matricule ? `(${u.matricule})` : ""}</option>)}
            <option value="AUTRES">{t("qms.planAction.other") || "Autres"}</option>
          </select>
          {form.responsableMatricule === "AUTRES" && (
            <div style={{ marginTop:8 }}>
              <input
                style={{ ...sInput }}
                placeholder={t("qms.planAction.otherPlaceholder") || "Précisez la personne (nom, poste, contact)..."}
                value={form.responsableAutre}
                onChange={e => setForm(f => ({ ...f, responsableAutre: e.target.value }))}
              />
            </div>
          )}
        </div>
        <div style={{ marginBottom:24 }}>
          <label style={sLabel}>{t("common.deadline")} <span style={{ color:"var(--error)" }}>*</span></label>
          <input type="date" style={sInput} value={form.dateEcheance} min={new Date().toISOString().split("T")[0]} onChange={e => setForm(f => ({ ...f, dateEcheance: e.target.value }))} />
        </div>
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--gray-50)", color:"var(--gray-600)", border:"1px solid var(--gray-200)" }} onClick={onClose}>{t("common.cancel")}</button>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", background:"var(--success)", color:"#fff", border:"1px solid var(--success-dark)", opacity:loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> {t("qms.planAction.creating")}</> : `✓ ${t("qms.planAction.create")}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE 1 — VALIDATION
═══════════════════════════════════════════════════════════════ */

function PageValidation() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = user?.role || "";
  const isAdmin = role === "ADMIN";
  const isPPOUser = isPPO(user?.role);

  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCl, setSelectedCl] = useState(null);
  const [linkedPlan, setLinkedPlan] = useState(null);
  const [plansByChecklist, setPlansByChecklist] = useState({});
  const [planModalChecklistId, setPlanModalChecklistId] = useState(null);
  const [planModalCouleur, setPlanModalCouleur] = useState("JAUNE");
  const [aqModalPlan, setAqModalPlan] = useState(null);
  const [autoCreatedMap, setAutoCreatedMap] = useState({});
  const [decision, setDecision] = useState("valider-n1");
  const [motif, setMotif] = useState("");
  const [acting, setActing] = useState(false);
  const { toast, showToast } = useToast();
  const pageSize = 10;
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterNc, setFilterNc] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("ALL");
  const [filterSite, setFilterSite] = useState("");
  const [filterPlant, setFilterPlant] = useState("");
  const [showCompletedItems, setShowCompletedItems] = useState(false);
  const [sites, setSites] = useState([]);
  const [plants, setPlants] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([checklistAPI.findAll(), planActionAPI.findAll(), getAllSites(), getAllPlants()])
      .then((results) => {
        const cRes = results[0];
        const pRes = results[1];
        const sRes = results[2];
        const plRes = results[3];
        const cls = (cRes.status === "fulfilled" && cRes.value?.data) ? cRes.value.data : [];
        const plans = (pRes.status === "fulfilled" && pRes.value?.data) ? pRes.value.data : [];
        const sRes_data = (sRes.status === "fulfilled" && sRes.value?.data) ? sRes.value.data : [];
        const plRes_data = (plRes.status === "fulfilled" && plRes.value?.data) ? plRes.value.data : [];
        const sortChecklists = (arr) => (Array.isArray(arr) ? arr.slice().sort((a,b) => {
          const da = a?.date ? new Date(a.date) : null;
          const db = b?.date ? new Date(b.date) : null;
          if (da && db) return db - da;
          return (b?.id || 0) - (a?.id || 0);
        }) : []);
        const grouped = {};
        plans.forEach((p) => {
          if (!p?.checklistId) return;
          if (!grouped[p.checklistId]) grouped[p.checklistId] = [];
          const idx = grouped[p.checklistId].findIndex(e => String(e.id) === String(p.id));
          if (idx >= 0) grouped[p.checklistId][idx] = p;
          else grouped[p.checklistId].push(p);
        });
        Object.keys(grouped).forEach(k => grouped[k].sort((a,b) => {
          const da = a?.creeLe ? new Date(a.creeLe) : null;
          const db = b?.creeLe ? new Date(b.creeLe) : null;
          if (da && db) return db - da;
          return (b?.id || 0) - (a?.id || 0);
        }));
        setChecklists(sortChecklists(cls));
        setPlansByChecklist(grouped);
        setSites(Array.isArray(sRes_data) ? sRes_data : []);
        setPlants(Array.isArray(plRes_data) ? plRes_data : []);
      })
      .catch((e) => console.error("Erreur chargement:", e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-create ROUGE plan when a checklist contains BOTH ROUGE and JAUNE NCs
  useEffect(() => {
    if (!selectedCl?.id) return;
    const plans = plansByChecklist?.[selectedCl.id] || [];
    const { hasRedNC, hasYellowNC } = getPlanGate(selectedCl, plans);
    const alreadyHasRouge = plans.some(p => isPlanRouge(p));
    if (hasRedNC && hasYellowNC && !alreadyHasRouge && !autoCreatedMap[selectedCl.id]) {
      (async () => {
        try {
          showToast(t("qms.toasts.redAutoCreating"), "info");
          const payload = {
            checklistId: selectedCl.id,
            description: `Auto: plan pour NC ROUGE (checklist #${selectedCl.id})`,
            couleurCritere: "ROUGE",
            dateEcheance: toYmd(new Date(Date.now() + 7 * 24 * 3600 * 1000)),
          };
          await planActionAPI.creer(payload);
          setAutoCreatedMap(m => ({ ...m, [selectedCl.id]: true }));
          await load();
          showToast(t("qms.toasts.redAutoCreated"), "success");
        } catch (e) {
          showToast(parseErrorMsg(e, t("qms.toasts.redAutoError")), "danger");
        }
      })();
    }
  }, [selectedCl, plansByChecklist, autoCreatedMap, load, showToast, t]);

  const getPlanGate = useCallback((cl, plans = []) => {
    const hasNC = extractNCs(cl).length > 0;
    const hasRedNC = hasRedNCInChecklist(cl);
    const hasYellowNC = hasYellowNCInChecklist(cl);
    const hasOnlyYellowNC = hasNC && !hasRedNC;

    const hasPlan = plans.length > 0;
    const plansRouge = plans.filter(p => isPlanRouge(p));
    const plansJaune = plans.filter(p => !isPlanRouge(p));

    const allRedPlansTreated = plansRouge.length > 0 &&
      plansRouge.every(p => isPlanClosed(p));

    const allRedPlansValidatedByAQ = plansRouge.length > 0 &&
      plansRouge.every(p => p.statut === "VALIDE_AQ");

    const allYellowPlansClosed = plansJaune.length === 0 ||
      plansJaune.every(p => p.statut === "CLOS" || !!p.closLe);

    const allPlansClosed = hasPlan && plans.every(p => isPlanClosed(p));
    const hasOpenPlan = plans.some(p => !isPlanClosed(p));
    const plansEnAttenteAQ = plans.filter(p => isPlanEnAttenteAQ(p));

    return {
      hasNC, hasRedNC, hasYellowNC, hasOnlyYellowNC, hasPlan,
      hasOpenPlan, allPlansClosed,
      plansRouge, plansJaune,
      allRedPlansTreated, allRedPlansValidatedByAQ, allYellowPlansClosed,
      plansEnAttenteAQ,
    };
  }, []);

  const getAvailableActions = useCallback((cl) => {
    const s = cl?.status;
    const hasN1 = !!cl?.dateValidationN1;
    const hasN2 = !!cl?.dateValidationN2;
    const hasFinal = !!cl?.dateValidationFinale;
    const plans = plansByChecklist?.[cl?.id] || [];
    const {
      hasRedNC, hasYellowNC, hasNC, hasPlan,
      allRedPlansTreated, allRedPlansValidatedByAQ, allYellowPlansClosed,
      plansRouge, plansJaune,
    } = getPlanGate(cl, plans);
    const a = [];

    // N1 — Chef de ligne
    if ((role === "CHEF_LIGNE" || role === "ADMIN") && !hasN1 && s !== "EN_COURS" && s !== "REJETE" && s !== "VALIDE_FINAL") {
      if (hasRedNC && plansRouge.length === 0)
        a.push({ key:"create-plan-rouge", label:t("qms.planAction.createRed"), color:"var(--error)", bg:"rgba(239,68,68,0.1)" });
      if (hasYellowNC && plansJaune.length === 0)
        a.push({ key:"create-plan-jaune", label:t("qms.planAction.createYellow"), color:"var(--warning)", bg:"rgba(245,158,11,0.1)" });
      // Allow Chef de ligne to validate N1 even if plans exist — chef and tech may validate concurrently
      const rougeOkN1 = true;
      const jauneOkN1 = true;
      const canN1 = !hasNC || (rougeOkN1 && jauneOkN1);
      a.push({ key:"valider-n1", label:"✅ " + t("common.validate") + " N1", color: canN1 ? "var(--success)" : "var(--gray-400)", bg: canN1 ? "rgba(16,185,129,0.1)" : "var(--gray-100)", disabled: !canN1 });
    }

    // N2 — Technicien
    if ((role === "TECHNICIEN" || role === "ADMIN") && !hasN2 && s !== "EN_COURS" && s !== "REJETE" && s !== "VALIDE_FINAL") {
      // Allow Technicien to validate N2 without waiting for Chef or AQ plan validation
      const rougeOkN2 = true;
      const jauneOkN2 = true;
      const canN2 = !hasNC || (rougeOkN2 && jauneOkN2);
      a.push({ key:"valider-n2", label:"✅ " + t("common.validate") + " N2", color: canN2 ? "var(--success)" : "var(--gray-400)", bg: canN2 ? "rgba(16,185,129,0.1)" : "var(--gray-100)", disabled: !canN2 });
    }

    // N3/Final — Agent Qualité
    if ((role === "AGENT_QUALITE" || role === "ADMIN") && hasN1 && hasN2 && !hasFinal) {
      // For final (N3): require N1 and N2. For ROUGE, require red plans to be validated by AQ first.
      // For JAUNE, AQ may validate N3 without a plan being closed.
      const canFinal = (!hasRedNC || allRedPlansValidatedByAQ);
      a.push({ key:"valider-final", label:"✅ " + t("qms.nextLevel.final"), color: canFinal ? "var(--success)" : "var(--gray-400)", bg: canFinal ? "rgba(16,185,129,0.1)" : "var(--gray-100)", disabled: !canFinal });
    }

    // Rejet
    if (["CHEF_LIGNE","TECHNICIEN","AGENT_QUALITE","ADMIN"].includes(role) && s !== "VALIDE_FINAL" && s !== "REJETE")
      a.push({ key:"rejeter", label:"✕ " + t("common.reject"), color:"var(--error)", bg:"rgba(239,68,68,0.1)" });

    return a;
  }, [role, plansByChecklist, getPlanGate, t]);

  useEffect(() => {
    const checklistId = Number(searchParams.get("checklistId"));
    if (!checklistId || !checklists.length) return;
    const target = checklists.find(cl => cl.id === checklistId);
    if (!target) return;
    const available = getAvailableActions(target);
    setSelectedCl(target);
    setDecision(available[0]?.key || "");
  }, [searchParams, checklists, getAvailableActions]);

  const filteredCls = useMemo(() =>
    sortMostRecentDesc(
      checklists.filter(cl => {
        const hasNC = extractNCs(cl).length > 0;
        const siteMatch = !filterSite || String(cl.siteId) === filterSite;
        const plantMatch = !filterPlant || String(cl.plantId) === filterPlant;
        return (
          (showCompletedItems || cl.status !== "VALIDE_FINAL") &&
          (!search || String(cl.id).includes(search) || (cl.machineNom || "").toLowerCase().includes(search.toLowerCase()) || (cl.operateurNom || "").toLowerCase().includes(search.toLowerCase())) &&
          isDateInPeriod(cl.date || cl.dateSoumission || cl.creeLe, filterPeriod) &&
          (!filterStatus || cl.status === filterStatus) &&
          (!filterNc || (filterNc === "with" && hasNC) || (filterNc === "without" && !hasNC)) &&
          siteMatch &&
          plantMatch
        );
      }),
      (cl) => cl?.dateValidationFinale || cl?.dateValidationN2 || cl?.dateValidationN1 || cl?.dateSoumission || cl?.date || cl?.creeLe
    ),
    [checklists, search, filterPeriod, filterStatus, filterNc, filterSite, filterPlant, showCompletedItems]);

  const { page, setPage, pageItems: pagedCls, totalPages, total } = usePagination(filteredCls, pageSize);

  useEffect(() => {
    if (!selectedCl?.id) { setLinkedPlan(null); return; }
    const list = plansByChecklist?.[selectedCl.id] || [];
    setLinkedPlan(list.find(p => !isPlanTerminal(p)) || list[0] || null);
  }, [selectedCl, plansByChecklist]);

  const getNextValidator = (cl) => {
    if (!cl?.dateValidationN1) return "N1 — Chef ligne";
    if (!cl?.dateValidationN2) return "N2 — Technicien";
    if (!cl?.dateValidationFinale) return "Final — Agent Qualité";
    return "—";
  };

  const fmtDM = (date) => {
    if (!date) return "—";
    try { return new Date(date).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit" }); }
    catch { return "—"; }
  };

  const getActionHint = (cl) => {
    const s = cl?.status;
    const plans = plansByChecklist?.[cl?.id] || [];
    const { hasRedNC, hasYellowNC, hasPlan, allRedPlansTreated, allRedPlansValidatedByAQ, allYellowPlansClosed, plansJaune, plansRouge, plansEnAttenteAQ } = getPlanGate(cl, plans);
    if (cl?.dateValidationFinale) return t("qms.nextLevel.alreadyValidated");
    if (s === "REJETE") return t("qms.nextLevel.rejected");
    if (hasRedNC) {
      if (plansRouge.length === 0) return t("qms.nextLevel.createRedPlan");
      if (!allRedPlansTreated) return t("qms.nextLevel.technicianCloseRed") || t("qms.nextLevel.technicianCloseYellow");
      if (plansEnAttenteAQ.length > 0) return t("qms.nextLevel.pendingAqValidation");
      if (!allRedPlansValidatedByAQ) return t("qms.nextLevel.agentMustValidateRed");
    }
    if (hasYellowNC) {
      if (plansJaune.length === 0) return t("qms.nextLevel.createYellowPlan");
      if (!allYellowPlansClosed) return t("qms.nextLevel.technicianCloseYellowPlan");
    }
    if (!cl?.dateValidationN2 && role === "TECHNICIEN") return "N2 disponible";
    if (!cl?.dateValidationN1 && role === "CHEF_LIGNE") return "N1 disponible";
    if (!cl?.dateValidationN1 || !cl?.dateValidationN2) return t("qms.actions.waitingN1N2");
    return t("common.noAction");
  };

  const handleDirectValidate = async (cl, actionKey) => {
    setActing(true);
    try {
      if (actionKey === "valider-n1")    await checklistAPI.validerN1(cl.id);
      else if (actionKey === "valider-n2")    await checklistAPI.validerN2(cl.id);
      else if (actionKey === "valider-final") await checklistAPI.validerFinal(cl.id);
      showToast(t("qms.toasts.validationSuccess"), "success");
      load();
    } catch (e) {
      showToast(parseErrorMsg(e, t("qms.toasts.validationSuccess")), "danger");
    } finally { setActing(false); }
  };
const handleBulkValidate = async () => {
  const valKeys = ["valider-n1", "valider-n2", "valider-final"];

  // Checklists ayant une action de validation disponible et non bloquée
  const targets = filteredCls.filter(cl => {
    const actions = getAvailableActions(cl);
    return actions.some(a => valKeys.includes(a.key) && !a.disabled);
  });

  if (targets.length === 0) {
    showToast(t("qms.toasts.nothingToValidate") || "Aucune checklist à valider.", "info");
    return;
  }

  if (!window.confirm(
    `Valider en masse ${targets.length} checklist(s) ?\nSeules les checklists conformes ou dont tous les plans sont clôturés seront traitées.`
  )) return;

  setActing(true);
  let ok = 0;
  let ko = 0;

  for (const cl of targets) {
    const actions = getAvailableActions(cl);
    const action = actions.find(a => valKeys.includes(a.key) && !a.disabled);
    if (!action) continue;
    try {
      if (action.key === "valider-n1")    await checklistAPI.validerN1(cl.id);
      else if (action.key === "valider-n2")    await checklistAPI.validerN2(cl.id);
      else if (action.key === "valider-final") await checklistAPI.validerFinal(cl.id);
      ok++;
    } catch {
      ko++;
    }
  }

  setActing(false);
  showToast(
    `✅ ${ok} validée(s)${ko > 0 ? ` · ⚠ ${ko} erreur(s)` : ""}`,
    ko > 0 ? "warning" : "success"
  );
  load();
};
  const handleAction = async () => {
    if (!selectedCl) return;
    if (decision === "rejeter" && !motif.trim()) { showToast(t("qms.decision.commentRequired"), "danger"); return; }
    setActing(true);
    try {
      const plans = plansByChecklist?.[selectedCl.id] || [];
      const {
        hasRedNC, hasYellowNC, hasNC,
        allRedPlansTreated, allRedPlansValidatedByAQ, allYellowPlansClosed,
        plansRouge, plansJaune,
      } = getPlanGate(selectedCl, plans);

      if (decision === "create-plan-rouge") {
        setPlanModalCouleur("ROUGE");
        setPlanModalChecklistId(selectedCl.id);
        setActing(false);
        return;
      }
      if (decision === "create-plan-jaune") {
        setPlanModalCouleur("JAUNE");
        setPlanModalChecklistId(selectedCl.id);
        setActing(false);
        return;
      }

      if (decision === "valider-n1") {
        if (hasRedNC) {
          if (plansRouge.length === 0) { showToast(t("qms.blocked.n1RedNoPlan"), "danger"); return; }
          if (!allRedPlansTreated) { showToast(t("qms.blocked.n1RedNotTreated"), "danger"); return; }
        }
        if (hasYellowNC) {
          if (plansJaune.length === 0) { showToast(t("qms.blocked.n1YellowNoPlan"), "danger"); return; }
          if (!allYellowPlansClosed) { showToast(t("qms.blocked.n1YellowNotClosed"), "danger"); return; }
        }
        await checklistAPI.validerN1(selectedCl.id);

      } else if (decision === "valider-n2") {
        if (hasRedNC) {
          if (plansRouge.length === 0) { showToast(t("qms.blocked.n2RedNoPlan"), "danger"); return; }
          if (!allRedPlansValidatedByAQ) { showToast(t("qms.blocked.n2RedNotValidatedAq"), "danger"); return; }
        }
        if (hasYellowNC) {
          if (plansJaune.length === 0) { showToast(t("qms.blocked.n2YellowNoPlan"), "danger"); return; }
          if (!allYellowPlansClosed) { showToast(t("qms.blocked.n2YellowNotClosed"), "danger"); return; }
        }
        await checklistAPI.validerN2(selectedCl.id);

      } else if (decision === "valider-final") {
        if (!selectedCl.dateValidationN1 || !selectedCl.dateValidationN2) { showToast(t("qms.blocked.finalN1N2Required"), "danger"); return; }
        if (hasRedNC && !allRedPlansValidatedByAQ) { showToast(t("qms.blocked.finalRedNotValidated"), "danger"); return; }
        if (hasYellowNC && !allYellowPlansClosed) { showToast(t("qms.blocked.finalYellowNotClosed"), "danger"); return; }
        await checklistAPI.validerFinal(selectedCl.id);

      } else if (decision === "rejeter") {
        await checklistAPI.rejeter(selectedCl.id, motif);
      }

      showToast(t("qms.toasts.actionSuccess"), "success");
      setMotif(""); load(); setSelectedCl(null);
    } catch (e) {
      showToast(parseErrorMsg(e, t("qms.toasts.actionSuccess")), "danger");
    } finally { setActing(false); }
  };

  const doExportReport = async (cl) => {
    try {
      const res = await checklistAPI.exportPdf(cl.id);
      const blob = new Blob([res.data], { type:"application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `rapport_checklist_${cl.id}.pdf`;
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      showToast(t("qms.toasts.reportExported"), "success");
    } catch (e) { showToast(parseErrorMsg(e, t("qms.toasts.reportExported")), "danger"); }
  };

  const enAttente = checklists.filter(c => ["SOUMIS","VALIDE_N1","VALIDE_N2"].includes(c.status)).length;
  const validesFinal = checklists.filter(c => c.status === "VALIDE_FINAL").length;
  const rejetes = checklists.filter(c => c.status === "REJETE").length;
  const totalPlansEnAttenteAQ = Object.values(plansByChecklist).flat().filter(p => isPlanEnAttenteAQ(p)).length;
  const queue = checklists.filter(cl => getAvailableActions(cl).length > 0);

  const valLevels = (cl) => {
    const plans = plansByChecklist?.[cl?.id] || [];
    const {
      hasRedNC, hasYellowNC, hasNC,
      allRedPlansTreated, allRedPlansValidatedByAQ, allYellowPlansClosed,
      plansRouge, plansJaune,
    } = getPlanGate(cl, plans);

    const hasN1 = !!cl?.dateValidationN1;
    const hasN2 = !!cl?.dateValidationN2;
    const hasFinal = !!cl?.dateValidationFinale;
    const s = cl?.status;
    const done = s === "VALIDE_FINAL" || s === "REJETE";

    const isN1Actor = role === "CHEF_LIGNE" || role === "ADMIN";
    const rougeOkForN1 = !hasRedNC || allRedPlansTreated;
    const jauneOkForN1 = !hasYellowNC || allYellowPlansClosed;
    const canN1 = isN1Actor && !hasN1 && !done && s !== "EN_COURS" && (!hasNC || (rougeOkForN1 && jauneOkForN1));
    const n1Blocked = isN1Actor && !hasN1 && !done && s !== "EN_COURS" && hasNC && !(rougeOkForN1 && jauneOkForN1);

    const isN2Actor = role === "TECHNICIEN" || role === "ADMIN";
    const rougeOkForN2 = !hasRedNC || allRedPlansValidatedByAQ;
    const jauneOkForN2 = !hasYellowNC || allYellowPlansClosed;
    const canN2 = isN2Actor && !hasN2 && !done && s !== "EN_COURS" && (!hasNC || (rougeOkForN2 && jauneOkForN2));
    const n2Blocked = isN2Actor && !hasN2 && !done && s !== "EN_COURS" && hasNC && !(rougeOkForN2 && jauneOkForN2);

    const isFinalActor = role === "AGENT_QUALITE" || role === "ADMIN";
    const canFinal = isFinalActor && hasN1 && hasN2 && !hasFinal && !done
      && (!hasRedNC || allRedPlansValidatedByAQ)
      && (!hasYellowNC || allYellowPlansClosed);
    const finalBlockedNoPrev = isFinalActor && !hasFinal && !done && (!hasN1 || !hasN2);
    const finalBlockedPlan = isFinalActor && !hasFinal && !done && hasN1 && hasN2
      && ((hasRedNC && !allRedPlansValidatedByAQ) || (hasYellowNC && !allYellowPlansClosed));

    const getN1BlockReason = () => {
      if (!hasNC) return null;
      if (hasRedNC && plansRouge.length === 0) return t("qms.blocked.n1RedNoPlan");
      if (hasRedNC && !allRedPlansTreated) return t("qms.blocked.n1RedNotTreated");
      if (hasYellowNC && plansJaune.length === 0) return t("qms.blocked.n1YellowNoPlan");
      if (hasYellowNC && !allYellowPlansClosed) return t("qms.blocked.n1YellowNotClosed");
      return null;
    };

    const getN2BlockReason = () => {
      if (!hasNC) return null;
      if (hasRedNC && plansRouge.length === 0) return t("qms.blocked.n2RedNoPlan");
      if (hasRedNC && !allRedPlansValidatedByAQ) {
        const enAttente = plansRouge.some(p => p.statut === "EN_ATTENTE_VALIDATION_AQ");
        return enAttente ? t("qms.nextLevel.pendingAqValidation") : t("qms.blocked.n2RedNotValidatedAq");
      }
      if (hasYellowNC && plansJaune.length === 0) return t("qms.blocked.n2YellowNoPlan");
      if (hasYellowNC && !allYellowPlansClosed) return t("qms.blocked.n2YellowNotClosed");
      return null;
    };

    return [
      { key:"n1", label:t("qms.detail.validationLevels.n1") || "N1 — Chef de ligne", done:hasN1, who:cl?.valideN1Par, date:cl?.dateValidationN1, showBtn:isN1Actor && !hasN1 && !done && s !== "EN_COURS", canValidate:canN1, blocked:n1Blocked, blockReason:getN1BlockReason(), actionKey:"valider-n1" },
      { key:"n2", label:t("qms.detail.validationLevels.n2") || "N2 — Technicien", done:hasN2, who:cl?.valideN2Par, date:cl?.dateValidationN2, showBtn:isN2Actor && !hasN2 && !done && s !== "EN_COURS", canValidate:canN2, blocked:n2Blocked, blockReason:getN2BlockReason(), actionKey:"valider-n2" },
      { key:"final", label:t("qms.detail.validationLevels.n3") || "Final — Agent Qualité", done:hasFinal, who:cl?.valideParFinal, date:cl?.dateValidationFinale, showBtn:isFinalActor && !hasFinal && !done, canValidate:canFinal, blocked:finalBlockedPlan,
        blockReason:finalBlockedNoPrev ? t("qms.blocked.finalN1N2Required")
          : hasRedNC && !allRedPlansValidatedByAQ ? t("qms.blocked.finalRedNotValidated")
          : hasYellowNC && !allYellowPlansClosed ? t("qms.blocked.finalYellowNotClosed")
          : null,
        actionKey:"valider-final" },
    ];
  };

  const selectedNcs = selectedCl ? extractNCs(selectedCl) : [];
  const selectedPlans = selectedCl ? (plansByChecklist?.[selectedCl.id] || []) : [];

  if (loading) return <div className="page"><LoadingPage /></div>;

  const handleDeleteAll = async () => {
    if (!window.confirm(t("qms.toasts.deleteConfirm"))) return;
    if (!isAdmin) return;
    try { await checklistAPI.deleteAll(); showToast(t("qms.toasts.allDataDeleted"), "success"); load(); }
    catch (e) { showToast(t("qms.toasts.allDataDeleted"), "danger"); }
  };

  return (
    <div className="page">
      <ToastNotification toast={toast} />

      {planModalChecklistId && (
        <ModalNouveauPlan checklistId={planModalChecklistId} couleurDominante={planModalCouleur}
          onClose={() => setPlanModalChecklistId(null)}
          onCreated={() => { setPlanModalChecklistId(null); load(); }} />
      )}

      {aqModalPlan && (
        <ModalValiderAQ plan={aqModalPlan} onClose={() => setAqModalPlan(null)}
          onValidated={() => { setAqModalPlan(null); load(); setSelectedCl(null); }} />
      )}

      <div className="kpi-grid">
        <StatCard label={t("qms.stats.toValidate")} value={enAttente} color="orange" sub={t("qms.stats.toValidateSub")} />
        <StatCard label={t("qms.stats.validatedFinal")} value={validesFinal} color="green" sub={t("qms.stats.validatedFinalSub")} />
        <StatCard label={t("qms.stats.rejected")} value={rejetes} color="red" sub={t("qms.stats.rejectedSub")} />
        {totalPlansEnAttenteAQ > 0
          ? <StatCard label={t("qms.stats.aqRequired")} value={totalPlansEnAttenteAQ} color="purple" sub={t("qms.stats.aqRequiredSub")} />
          : <StatCard label={t("qms.stats.toDo")} value={checklists.length} color="blue" sub={t("qms.stats.toDoSub")} />}
      </div>

      {totalPlansEnAttenteAQ > 0 && (role === "AGENT_QUALITE" || role === "ADMIN") && (
        <div className="alert alert-info" style={{ marginBottom:20 }}>
          {t("qms.alerts.aqPendingChecklists", { count: totalPlansEnAttenteAQ })}
        </div>
      )}

      <div className="qms-filter-panel">
        <div className="qms-filter-grid qms-filter-grid--checklists">
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.searchLabel")}</span>
            <div className="qms-filter-control qms-filter-search">
              <span className="qms-filter-icon"><IcoSearch /></span>
              <input type="text" placeholder={t("qms.filters.searchChecklistPlaceholder")} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              {search && <button type="button" className="qms-filter-clear" onClick={() => { setSearch(""); setPage(1); }}>✕</button>}
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.site")}</span>
            <div className="qms-filter-control">
              <select value={filterSite} onChange={e => { setFilterSite(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.all")}</option>
                {sites.map(st => <option key={st.id} value={String(st.id)}>{st.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.plant")}</span>
            <div className="qms-filter-control">
              <select value={filterPlant} onChange={e => { setFilterPlant(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.all")}</option>
                {plants.map(pl => <option key={pl.id} value={String(pl.id)}>{pl.nom}</option>)}
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.status")}</span>
            <div className="qms-filter-control">
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.statusAll")}</option>
                <option value="SOUMIS">{t("sprint2.checklist.status.submitted")}</option>
                <option value="VALIDE_N1">{t("sprint2.checklist.status.validatedN1")}</option>
                <option value="VALIDE_N2">{t("sprint2.checklist.status.validatedN2")}</option>
                <option value="VALIDE_FINAL">{t("sprint2.checklist.status.validatedFinal")}</option>
                <option value="REJETE">{t("sprint2.checklist.status.rejected")}</option>
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.ncLabel")}</span>
            <div className="qms-filter-control">
              <select value={filterNc} onChange={e => { setFilterNc(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.all")}</option>
                <option value="with">{t("qms.table.withNc") || "Avec NC"}</option>
                <option value="without">{t("qms.table.withoutNc") || "Sans NC"}</option>
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.periodLabel")}</span>
            <div className="qms-filter-control">
              <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); setPage(1); }}>
                <option value="TODAY">{t("qms.filters.today")}</option>
                <option value="WEEK">{t("qms.filters.thisWeek")}</option>
                <option value="ALL">{t("qms.filters.all")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="qms-filter-footer">
          <div className="qms-filter-meta">
            <div className="qms-filter-counter">
              <span className="counter-badge">{filteredCls.length}</span>
              <span className="counter-label">{t("qms.filters.results", { count: filteredCls.length })}</span>
            </div>
          </div>
          <div className="qms-filter-actions">
            {(search || filterStatus || filterNc || filterPeriod !== "ALL" || filterSite || filterPlant) && (
              <button className="qms-filter-reset" onClick={() => { setSearch(""); setFilterStatus(""); setFilterNc(""); setFilterPeriod("ALL"); setFilterSite(""); setFilterPlant(""); setPage(1); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                {t("qms.filters.reset")}
              </button>
            )}
            {(() => {
  const valKeys = ["valider-n1", "valider-n2", "valider-final"];
  const validatableCount = filteredCls.filter(cl => {
    const actions = getAvailableActions(cl);
    return actions.some(a => valKeys.includes(a.key) && !a.disabled);
  }).length;

  return validatableCount > 0 ? (
    <button
      className="btn btn-success"
      onClick={handleBulkValidate}
      disabled={acting}
      title={`Valider les ${validatableCount} checklist(s) éligibles`}
    >
      {acting
        ? <span className="spinner" style={{ width: 14, height: 14 }} />
        : "✅"
      }
      Tout valider ({validatableCount})
    </button>
  ) : null;
})()}
            <button className="qms-filter-reset" onClick={() => setShowCompletedItems(v => !v)}>
              {showCompletedItems ? "Masquer les validés" : "Consulter les validés"}
            </button>
            {isAdmin && <button className="btn btn-danger" onClick={handleDeleteAll}>🗑 {t("qms.deleteAll")}</button>}
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow:"hidden" }}>
        <div className="card-title">
          <div className="card-title-icon" style={{ background:"var(--primary-bg)", color:"var(--primary)" }}>📋</div>
          {t("qms.table.headers.action")} ({filteredCls.length})
          {queue.length > 0 && <span className="badge badge-orange" style={{ marginLeft:"auto" }}>{t("qms.table.toQueue", { count: queue.length })}</span>}
        </div>
        <div className="table-container">
          <table className="validation-table">
            <thead>
              <tr><th>{t("qms.table.headers.id")}</th><th>{t("qms.table.headers.segment")}</th><th>{t("qms.table.headers.Operator")}</th><th>{t("qms.table.headers.date")}</th><th>{t("qms.table.headers.nc")}</th><th>{t("qms.table.headers.status")}</th><th>{t("qms.table.headers.nextLevel")}</th><th>{t("qms.table.headers.action")}</th></tr>
            </thead>
            <tbody>
              {pagedCls.map(cl => {
                const ncCount = extractNCs(cl).length;
                const actions = getAvailableActions(cl);
                const plans = plansByChecklist?.[cl.id] || [];
                const hasPlansEnAttenteAQ = plans.some(p => isPlanEnAttenteAQ(p));
                return (
                  <tr key={cl.id} onClick={() => { setSelectedCl(cl); setDecision(actions[0]?.key || ""); }} style={{ cursor:"pointer" }}>
                    <td data-label={t("qms.table.headers.id")} style={{ fontWeight:700, color:"var(--primary)", fontSize:13 }}>#{cl.id}</td>
                    <td data-label={t("qms.table.headers.segment")} style={{ fontSize:12, fontWeight:600, color:"var(--gray-600)" }}>{cl.segmentCode || cl.segmentNom || "—"}</td>
                    <td data-label={t("qms.table.headers.Operator")}><div style={{ fontWeight:600 }}></div><div style={{ fontSize:11, color:"var(--gray-500)" }}>{cl.operateurNom || "—"}</div></td>
                    <td data-label={t("qms.table.headers.date")} style={{ fontSize:12 }}>{fmtDM(cl.date)}</td>
                    <td data-label={t("qms.table.headers.nc")}>
                      <span className={`badge ${ncCount > 0 ? "badge-red" : "badge-gray"}`}>{ncCount} NC</span>
                      {hasPlansEnAttenteAQ && <span className="badge badge-purple" style={{ marginLeft:4 }}>{t("qms.stats.aqRequired")}</span>}
                    </td>
                    <td data-label={t("qms.table.headers.status")}><StatusBadge status={cl.status} /></td>
                    <td data-label={t("qms.table.headers.nextLevel")} style={{ fontSize:12, fontWeight:600, color:"var(--gray-600)" }}>{getNextValidator(cl)}</td>
                    <td data-label={t("qms.table.headers.action")} onClick={e => e.stopPropagation()}>
                      {(() => {
                        const valKey = ["valider-n1","valider-n2","valider-final"];
                        const valAction  = actions.find(a => valKey.includes(a.key));
                        const planAction = actions.find(a => a.key.startsWith("create-plan"));
                        const otherAction = actions.find(a => !valKey.includes(a.key) && !a.key.startsWith("create-plan") && a.key !== "rejeter");

                        if (valAction && !valAction.disabled) {
                          return (
                            <button className="btn btn-success btn-xs" onClick={() => handleDirectValidate(cl, valAction.key)} disabled={acting} style={{ gap:4, whiteSpace:"nowrap" }}>
                              {acting ? <span className="spinner" style={{ width:10, height:10, borderWidth:2 }} /> : "✅"} {t("common.validate")}
                            </button>
                          );
                        }
                        if (planAction) {
                          return (
                            <button className="btn btn-xs" title={planAction.label}
                              onClick={() => {
                                setPlanModalCouleur(planAction.key === "create-plan-rouge" ? "ROUGE" : "JAUNE");
                                setPlanModalChecklistId(cl.id);
                              }}
                              style={{ background:"rgba(245,158,11,0.12)", color:"var(--warning)", border:"1px solid rgba(245,158,11,0.3)", gap:4, whiteSpace:"nowrap" }}>
                              ➕ {t("qms.table.createPlan")}
                            </button>
                          );
                        }
                        if (valAction && valAction.disabled) {
                          return (
                            <button className="btn btn-xs" disabled title={valAction.blockReason || t("qms.table.blocked")}
                              style={{ background:"var(--gray-100)", color:"var(--gray-400)", cursor:"not-allowed", gap:4, whiteSpace:"nowrap", border:"1px solid var(--gray-200)" }}
                              onClick={() => { setSelectedCl(cl); setDecision(valAction.key); }}>
                              🔒 {t("qms.table.blocked")}
                            </button>
                          );
                        }
                        if (cl.status === "VALIDE_FINAL") {
                          return <button className="btn btn-ghost btn-xs" onClick={() => setSelectedCl(cl)}>Consulter</button>;
                        }
                        if (otherAction || actions.length > 0) {
                          return <button className="btn btn-ghost btn-xs" onClick={() => { setSelectedCl(cl); setDecision((otherAction || actions[0]).key); }}>→ {t("common.process")}</button>;
                        }
                        return <span style={{ fontSize:11, color:"var(--gray-400)" }}>{getActionHint(cl)}</span>;
                      })()}
                    </td>
                  </tr>
                );
              })}
              {pagedCls.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign:"center", padding:40, color:"var(--gray-500)" }}>{t("qms.table.noChecklist")}</td></tr>
              )}
            </tbody>
           </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={pageSize} />
      </div>

      {selectedCl && (
        <div className="modal-overlay" onClick={() => setSelectedCl(null)}>
          <div className="modal" style={{ maxWidth:640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontWeight:800, fontSize:17, color:"var(--gray-900)" }}>#{selectedCl.id} — {selectedCl.machineNom}</div>
                <div style={{ fontSize:12, color:"var(--gray-500)", marginTop:2 }}>{selectedCl.operateurNom} · {fmt(selectedCl.date)}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {selectedNcs.length > 0 && (() => {
                  const actionsForHeader = getAvailableActions(selectedCl || {});
                  const planActionHeader = actionsForHeader.find(a => a.key && a.key.startsWith("create-plan"));
                  if (linkedPlan) return <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/plan-actions?focusPlan=${linkedPlan.id}`)}>→ {t("qms.table.viewPlan")}</button>;
                  if (planActionHeader && (user?.role === "CHEF_LIGNE" || user?.role === "ADMIN")) {
                    return (
                      <button className="btn btn-xs" title={planActionHeader.label}
                        onClick={() => {
                          setPlanModalCouleur(planActionHeader.key === "create-plan-rouge" ? "ROUGE" : "JAUNE");
                          setPlanModalChecklistId(selectedCl.id);
                          setSelectedCl(null);
                        }}
                        style={{ background:"rgba(245,158,11,0.12)", color:"var(--warning)", border:"1px solid rgba(245,158,11,0.3)", gap:4, whiteSpace:"nowrap" }}>
                        ➕ {t("qms.table.createPlan")}
                      </button>
                    );
                  }
                  return null;
                })()}
                {selectedCl.status === "VALIDE_FINAL" && ["ADMIN","AGENT_QUALITE"].includes(user?.role || "") && (
                  <button className="btn btn-success btn-sm" onClick={() => doExportReport(selectedCl)}>{t("qms.export")}</button>
                )}
                <button className="btn btn-ghost btn-xs" onClick={() => setSelectedCl(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body" style={{ padding:0 }}>
              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--gray-100)" }}>
                <div style={{ display:"flex", flexDirection:"column", gap:8, fontSize:13 }}>
                  <div><b>{t("common.process")} :</b> {selectedCl.processusNom || "—"}</div>
                  <div><b>{t("common.segment")} :</b> {selectedCl.segmentNom || "—"}</div>
                  <div><b>{t("qms.detail.nonConformities", { count: extractNCs(selectedCl).length })} :</b> <span style={{ color:"var(--error)", fontWeight:700 }}>{extractNCs(selectedCl).length}</span></div>
                </div>
                <div style={{ marginTop:10 }}><StatusBadge status={selectedCl.status} /></div>
              </div>

              <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--gray-100)" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ background:"var(--primary-bg)", color:"var(--primary)", width:26, height:26, borderRadius:8, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>🔷</span>
                  {t("qms.detail.validationLevels.title")}
                </div>
                <div className="val-levels">
                  {valLevels(selectedCl).map((lv, i) => (
                    <div key={lv.key} className="val-level" style={{ background: lv.done ? "rgba(16,185,129,0.08)" : lv.canValidate ? "rgba(79,70,229,0.05)" : "var(--gray-50)", border:`1px solid ${lv.done ? "rgba(16,185,129,0.2)" : lv.canValidate ? "rgba(79,70,229,0.2)" : "var(--gray-200)"}`, flexDirection:"column", alignItems:"stretch", gap:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div className="val-level-dot" style={{ background: lv.done ? "var(--success)" : lv.canValidate ? "var(--primary)" : "var(--gray-400)", color:"#fff", flexShrink:0 }}>
                          {lv.done ? "✓" : i+1}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color: lv.done ? "var(--success)" : lv.canValidate ? "var(--primary)" : "var(--gray-700)" }}>{lv.label}</div>
                          <div style={{ fontSize:11, color:"var(--gray-500)" }}>
                            {lv.done ? `✓ ${lv.who || ""}` : lv.blockReason ? `⏳ ${lv.blockReason}` : lv.showBtn && !lv.canValidate ? t("qms.detail.pending") : t("qms.detail.notReached")}
                          </div>
                        </div>
                        {lv.showBtn && (
                          <button onClick={async () => {
                            if (!lv.canValidate || acting) return;
                            setActing(true);
                            try {
                              if (lv.actionKey === "valider-n1") await checklistAPI.validerN1(selectedCl.id);
                              else if (lv.actionKey === "valider-n2") await checklistAPI.validerN2(selectedCl.id);
                              else if (lv.actionKey === "valider-final") await checklistAPI.validerFinal(selectedCl.id);
                              showToast(t("qms.toasts.validationSuccess"), "success");
                              load();
                            } catch (e) { showToast(parseErrorMsg(e, t("qms.toasts.validationSuccess")), "danger"); }
                            finally { setActing(false); }
                          }} disabled={!lv.canValidate || acting} style={{ flexShrink:0, padding:"5px 12px", borderRadius:20, border:"none", fontSize:11, fontWeight:700, cursor: lv.canValidate ? "pointer" : "not-allowed", background: lv.canValidate ? "var(--primary)" : "var(--gray-200)", color: lv.canValidate ? "#fff" : "var(--gray-400)", transition:"all 0.15s", whiteSpace:"nowrap" }} title={lv.blockReason || (lv.canValidate ? t("common.clickToValidate") : "")}>
                            {acting ? <span className="spinner" style={{ width:11, height:11, borderWidth:2 }} /> : lv.canValidate ? `✅ ${t("common.validate")}` : `🔒 ${t("qms.table.blocked")}`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedNcs.length > 0 && (
                <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--gray-100)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ background:"rgba(239,68,68,0.1)", color:"var(--error)", width:26, height:26, borderRadius:8, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>⚠</span>
                    {t("qms.detail.nonConformities", { count: selectedNcs.length })}
                  </div>
                  <div className="nc-cards">
                    {selectedNcs.map(n => {
                      const bucket = resolveNcBucketValue(n);
                      const vc = { ROUGE:"var(--error)", JAUNE:"var(--warning)" }[bucket] || "var(--gray-500)";
                      return (
                        <div key={n.id} className="nc-card" style={{ borderLeft:`3px solid ${vc}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                            <span style={{ fontWeight:800, fontSize:12, color:"var(--error)" }}>#{n.critereId}</span>
                            <span className="badge" style={{ background:`${vc}15`, color:vc, border:`1px solid ${vc}30` }}>{bucket === "ROUGE" ? "🔴 ROUGE" : "🟡 JAUNE"}</span>
                          </div>
                          <div style={{ fontSize:14, fontWeight:700, color:"var(--gray-800)", marginBottom:6 }}>{n.critereNom}</div>
                          {n.commentaire && <div style={{ fontSize:12, color:"var(--gray-500)" }}>{n.commentaire}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedPlans.length > 0 && (
                <div style={{ padding:"16px 24px", borderBottom:"1px solid var(--gray-100)" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ background:"rgba(245,158,11,0.1)", color:"var(--warning)", width:26, height:26, borderRadius:8, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>🔧</span>
                    {t("qms.detail.actionPlans")} ({selectedPlans.length})
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {selectedPlans.map(plan => {
                      const isRouge = isPlanRouge(plan);
                      const enAttenteAQ = isPlanEnAttenteAQ(plan);
                      const terminal = isPlanTerminal(plan);
                      const borderColor = isRouge ? "var(--error)" : "var(--warning)";
                      return (
                        <div key={plan.id} style={{ padding:"12px 14px", borderRadius:12, background: terminal ? "rgba(16,185,129,0.04)" : enAttenteAQ ? "rgba(124,58,237,0.04)" : "rgba(245,158,11,0.04)", border:`1px solid ${terminal ? "rgba(16,185,129,0.2)" : enAttenteAQ ? "rgba(124,58,237,0.2)" : "rgba(245,158,11,0.2)"}`, borderLeft:`3px solid ${borderColor}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                            <div style={{ fontWeight:700, fontSize:13 }}>PA-{plan.id} · {plan.description}</div>
                            <PlanStatutBadge plan={plan} />
                          </div>
                          <div style={{ fontSize:12, color:"var(--gray-500)" }}>👤 {plan.responsableNom || "—"} · 📅 {fmt(plan.dateEcheance)}</div>
                          {plan.commentaireCloture && <div style={{ fontSize:12, color:"var(--gray-600)", marginTop:4, fontStyle:"italic" }}>💬 {plan.commentaireCloture}</div>}
                          {enAttenteAQ && (role === "AGENT_QUALITE" || role === "ADMIN") && (
                            <button className="btn btn-purple btn-sm" style={{ marginTop:8 }} onClick={() => setAqModalPlan(plan)}>
                              🔍 {t("qms.validateAqModal.validate")}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedCl.status === "VALIDE_FINAL" && <div className="alert alert-success" style={{ margin:"16px 24px" }}>✅ {t("qms.detail.validatedFile")}</div>}
              {selectedCl.status === "REJETE" && <div className="alert alert-danger" style={{ margin:"16px 24px" }}>✕ {t("qms.detail.rejectedFile", { reason: selectedCl.motifRejet })}</div>}

              {(!autoCreatedMap[selectedCl.id] && getAvailableActions(selectedCl).length > 0) ? (
                <div style={{ padding:"16px 24px" }}>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ background:"rgba(16,185,129,0.1)", color:"var(--success)", width:26, height:26, borderRadius:8, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>✅</span>
                    {t("qms.detail.decision")}
                  </div>
                  <div className="decision-options">
                    {getAvailableActions(selectedCl).filter(opt => !(opt.key && opt.key.startsWith("create-plan"))).map(opt => (
                      <label key={opt.key} className={`decision-option ${decision === opt.key ? "selected" : ""}`}>
                        <input type="radio" name="decision" value={opt.key} checked={decision === opt.key} onChange={() => setDecision(opt.key)} />
                        <span style={{ fontSize:13, fontWeight:600, color:decision === opt.key ? opt.color : "var(--gray-700)" }}>{opt.label}</span>
                      </label>
                    ))}
                    {decision === "rejeter" && (
                      <div className="field" style={{ marginTop:8 }}>
                        <label>{t("common.reason")} ({t("common.required")})</label>
                        <textarea rows={2} placeholder={t("qms.decision.commentPlaceholder")} value={motif} onChange={e => setMotif(e.target.value)} />
                      </div>
                    )}
                    <button className="btn btn-primary" style={{ width:"100%", justifyContent:"center", marginTop:8 }} onClick={handleAction} disabled={acting}>
                      {acting ? <span className="spinner" style={{ width:16, height:16 }} /> : `✅ ${t("common.confirm")}`}
                    </button>
                  </div>
                </div>
              ) : autoCreatedMap[selectedCl.id] ? (
                <div style={{ padding:"16px 24px" }}>
                  <div className="alert alert-info">{t("qms.alerts.autoRedPlan")} <button className="btn btn-ghost btn-sm" style={{ marginLeft:12 }} onClick={() => navigate(`/plan-actions?createFor=${selectedCl.id}`)}>{t("qms.viewPlan")}</button></div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE 2 — PLANS D'ACTION
═══════════════════════════════════════════════════════════════ */

function PagePlans() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isPPOUser = isPPO(user?.role);
  const isTechnicien = user?.role === "TECHNICIEN";
  const isAgentQualite = user?.role === "AGENT_QUALITE";
  const isAdmin = user?.role === "ADMIN";
  const canManagePlans = isTechnicien || isAdmin;
  const canValiderAQ = isAgentQualite || isAdmin;
  const userMatricule = String(user?.matricule || "").trim();

  const [plans, setPlans] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);
  const [view, setView] = useState("table");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterResponsable, setFilterResponsable] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("TODAY");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showCompletedItems, setShowCompletedItems] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [acting, setActing] = useState(false);
  const { toast, showToast } = useToast();
  const [showModalPlan, setShowModalPlan] = useState(false);
  const [createFor, setCreateFor] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [planToClose, setPlanToClose] = useState(null);
  const [closeComment, setCloseComment] = useState("");
  const [aqModalPlan, setAqModalPlan] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = 12;

  const visiblePlans = useMemo(() => {
    const basePlans = isTechnicien && userMatricule
      ? plans.filter(p => String(p.responsableMatricule || "").trim().toLowerCase() === userMatricule.toLowerCase())
      : plans;
    return sortMostRecentDesc(basePlans, (p) => p?.majLe || p?.creeLe || p?.dateEcheance);
  }, [plans, isTechnicien, userMatricule]);

  const isPlanAutres = (plan) => {
    const autre = String(plan?.responsableAutre || "").trim();
    const matricule = String(plan?.responsableMatricule || "").trim();
    return Boolean(autre) || matricule.toUpperCase() === "AUTRES";
  };

  const canClosePlan = (plan) => {
    if (!plan) return false;
    // Admin can always close
    if (isAdmin) return true;

    const isAutres = isPlanAutres(plan);
    const isCreatorChef = user?.role === "CHEF_LIGNE"
      && userMatricule
      && String(plan.creeParMatricule || "").trim().toLowerCase() === userMatricule.toLowerCase();
    const isTechnicienAssigned = isTechnicien
      && !isAutres
      && (!plan.responsableMatricule || String(plan.responsableMatricule).trim().toLowerCase() === userMatricule.toLowerCase());

    // Red NC plans are closed by assigned technician, or by the creating Chef de ligne when assigned to 'Autres'
    if (isPlanRouge(plan)) {
      if (isTechnicienAssigned) return true;
      if (isCreatorChef && isAutres) return true;
      return false;
    }
    // Yellow plans are closed by the creating Chef de ligne after technician treatment
    if (isCreatorChef) return true;
    return false;
  };

  const canClosePlanNow = (plan) => {
    if (!canClosePlan(plan)) return false;
    if (plan?.statut === "EN_COURS") return true;
    if (plan?.statut === "OUVERT") {
      const isAutres = isPlanAutres(plan);
      const isCreatorChef = user?.role === "CHEF_LIGNE"
        && userMatricule
        && String(plan.creeParMatricule || "").trim().toLowerCase() === userMatricule.toLowerCase();
      return isAutres && isCreatorChef;
    }
    return false;
  };

  const load = useCallback(() => {
    setLoading(true);
    setPlansError(null);
    const plansRequest = isTechnicien ? planActionAPI.mesPLans() : planActionAPI.findAll();
    Promise.allSettled([plansRequest, checklistAPI.findAll()])
      .then(results => {
        const pRes = results[0];
        const cRes = results[1];
        if (pRes.status === "fulfilled") {
          const sorted = (Array.isArray(pRes.value.data) ? pRes.value.data.slice() : []).sort((a,b) => {
            const da = a?.creeLe ? new Date(a.creeLe) : null;
            const db = b?.creeLe ? new Date(b.creeLe) : null;
            if (da && db) return db - da;
            return (b?.id || 0) - (a?.id || 0);
          });
          setPlans(sorted);
        } else { setPlans([]); setPlansError(pRes.reason?.response?.data || String(pRes.reason)); }
        if (cRes.status === "fulfilled") {
          const validChecklists = (Array.isArray(cRes.value.data) ? cRes.value.data : []).filter(cl => cl && cl.id && cl.status !== "SUPPRIME").slice().sort((a,b) => {
            const da = a?.date ? new Date(a.date) : null;
            const db = b?.date ? new Date(b.date) : null;
            if (da && db) return db - da;
            return (b?.id || 0) - (a?.id || 0);
          });
          setChecklists(validChecklists);
          setPlans(prev => prev.filter(plan => validChecklists.some(cl => cl.id === plan.checklistId)));
        } else setChecklists([]);
      })
      .catch(e => { console.error(e); setPlans([]); setChecklists([]); setPlansError(String(e)); })
      .finally(() => setLoading(false));
  }, [isTechnicien]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const cf = searchParams.get("createFor");
    if (cf) { setCreateFor(Number(cf)); setShowModalPlan(true); }
  }, [searchParams]);

  useEffect(() => {
    const fp = Number(searchParams.get("focusPlan"));
    if (!fp || !plans.length) return;
    const t = visiblePlans.find(p => p.id === fp);
    if (t) setSelectedPlan(t);
  }, [searchParams, plans, visiblePlans]);

  const checklistsById = useMemo(() => new Map((checklists || []).map(cl => [cl.id, cl])), [checklists]);
  const responsables = useMemo(() => [...new Set(visiblePlans.map(p => p.responsableNom).filter(Boolean))], [visiblePlans]);

  const filtered = useMemo(() => visiblePlans.filter(p => {
    const overdue = p.statut !== "CLOS" && p.statut !== "VALIDE_AQ" && p.dateEcheance && new Date(p.dateEcheance) < new Date();
    const periodDate = p.creeLe || p.majLe;
    return (
      (showCompletedItems || !isPlanTerminal(p)) &&
      (!search || (p.description || "").toLowerCase().includes(search.toLowerCase()) || String(p.id).includes(search)) &&
      isDateInPeriod(periodDate, filterPeriod) &&
      (!filterStatus || p.statut === filterStatus) &&
      (!filterResponsable || p.responsableNom === filterResponsable) &&
      (!overdueOnly || overdue)
    );
  }), [visiblePlans, search, filterStatus, filterResponsable, filterPeriod, overdueOnly, showCompletedItems]);

  const { page, setPage, pageItems: pagedPlans, totalPages, total } = usePagination(filtered, pageSize);

  const getPlanProgress = (plan) => {
    if (plan?.statut === "VALIDE_AQ" || plan?.statut === "CLOS") return 100;
    if (plan?.statut === "EN_ATTENTE_VALIDATION_AQ") return 85;
    if (plan?.statut === "EN_COURS") return 50;
    return 10;
  };

  const getPlanContext = (plan) => {
    const cl = checklistsById.get(plan?.checklistId);
    return { checklist:cl||null, segment:cl?.segmentCode||cl?.segmentNom||"—", processus:cl?.processusNom||"—" };
  };

  const getChecklistName = (cl) => {
    if (!cl) return "—";
    const parts = [cl.processusNom, cl.segmentNom].filter(Boolean);
    return parts.length > 0 ? parts.join(" – ") : `Checklist #${cl.id}`;
  };

  const ouvertes = visiblePlans.filter(p => p.statut === "OUVERT").length;
  const enCours = visiblePlans.filter(p => p.statut === "EN_COURS").length;
  const enAttenteAQ = visiblePlans.filter(p => p.statut === "EN_ATTENTE_VALIDATION_AQ").length;
  const clos = visiblePlans.filter(p => p.statut === "CLOS" || p.statut === "VALIDE_AQ").length;
  const closeRate = visiblePlans.length ? Math.round((clos / visiblePlans.length) * 100) : 0;

  const handleMettreEnCours = async (id) => {
    if (!canManagePlans) { showToast(t("qms.toasts.reservedTechnician"), "danger"); return; }
    setActing(true);
    try { await planActionAPI.mettreEnCours(id); showToast(t("qms.toasts.actionSuccess"), "success"); load(); setSelectedPlan(null); }
    catch (e) { showToast(parseErrorMsg(e, t("qms.toasts.actionSuccess")), "danger"); }
    finally { setActing(false); }
  };

  const openCloseModal = (plan) => { setPlanToClose(plan); setCloseComment(""); setShowCloseModal(true); };

  const handleConfirmCloture = async () => {
    if (!planToClose?.id || !canClosePlan(planToClose)) return;
    setActing(true);
    try {
      await planActionAPI.cloturer(planToClose.id, closeComment.trim());
      showToast(t("qms.toasts.closedSuccess"), "success");
      setShowCloseModal(false); setPlanToClose(null); setCloseComment("");
      load(); setSelectedPlan(null);
    } catch (e) { showToast(parseErrorMsg(e, t("qms.toasts.closedSuccess")), "danger"); }
    finally { setActing(false); }
  };

  const kanbanCols = [
    { key:"OUVERT", label:t("qms.workflow.toDo"), color:"var(--warning)", bg:"rgba(245,158,11,0.08)", border:"rgba(245,158,11,0.2)" },
    { key:"EN_COURS", label:t("qms.stats.inProgress"), color:"var(--primary)", bg:"var(--primary-bg)", border:"rgba(79,70,229,0.2)" },
    { key:"EN_ATTENTE_VALIDATION_AQ", label:t("qms.stats.pendingAq"), color:"var(--purple)", bg:"rgba(124,58,237,0.08)", border:"rgba(124,58,237,0.2)" },
    { key:"TERMINAL", label:t("qms.stats.closed"), color:"var(--success)", bg:"rgba(16,185,129,0.08)", border:"rgba(16,185,129,0.2)" },
  ];

  if (loading) return <div className="page"><LoadingPage /></div>;

  return (
    <div className="page">
      <ToastNotification toast={toast} />

      {plansError && (
        <div style={{ marginBottom:12 }} className="card" role="alert">
          <strong>{t("common.error")} :</strong> {typeof plansError === "string" ? plansError : JSON.stringify(plansError)}
          <div style={{ marginTop:8 }}><button className="btn" onClick={load}>{t("qms.retry")}</button></div>
        </div>
      )}

      {enAttenteAQ > 0 && canValiderAQ && (
        <div className="alert alert-info" style={{ marginBottom:20 }}>
          {t("qms.alerts.aqPendingPlans", { count: enAttenteAQ })}
        </div>
      )}

      {showModalPlan && (
        <ModalNouveauPlan checklistId={createFor}
          onClose={() => { setShowModalPlan(false); setCreateFor(null); setSearchParams({}); }}
          onCreated={() => { load(); setSearchParams({}); }} />
      )}

      {aqModalPlan && (
        <ModalValiderAQ plan={aqModalPlan} onClose={() => setAqModalPlan(null)}
          onValidated={() => { setAqModalPlan(null); load(); setSelectedPlan(null); showToast(t("qms.toasts.validationSuccess"), "success"); }} />
      )}

      {showCloseModal && planToClose && (
        <div className="modal-overlay" onClick={() => { if (!acting) setShowCloseModal(false); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span style={{ fontWeight:700 }}>
                {isPlanRouge(planToClose) ? t("qms.closeModal.titleRed", { id: planToClose.id }) : t("qms.closeModal.titleYellow", { id: planToClose.id })}
              </span>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {isPlanRouge(planToClose) && (
                <div className="alert alert-info" style={{ marginBottom:14 }}>
                  {t("qms.closeModal.redWarning")}
                </div>
              )}
              <div className="field">
                <label>{t("common.comment")} <span style={{ fontSize:10, fontWeight:400, color:"var(--gray-400)" }}>({t("common.optional")})</span></label>
                <textarea rows={4} value={closeComment} onChange={e => setCloseComment(e.target.value)} placeholder={isPlanRouge(planToClose) ? t("qms.closeModal.commentPlaceholderRed") : t("qms.closeModal.commentPlaceholderYellow")} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCloseModal(false)}>{t("common.cancel")}</button>
              <button className="btn btn-success" onClick={handleConfirmCloture} disabled={acting}>
                {acting ? <span className="spinner" style={{ width:14, height:14 }} /> : isPlanRouge(planToClose) ? t("qms.closeModal.submitToAq") : t("qms.closeModal.closePlan")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <StatCard label={t("qms.stats.toDo")} value={ouvertes} color="orange" sub={t("qms.stats.toDoSub")} />
        <StatCard label={t("qms.stats.inProgress")} value={enCours} color="blue" sub={t("qms.stats.inProgressSub") || "en traitement"} />
        <StatCard label={t("qms.stats.pendingAq")} value={enAttenteAQ} color="purple" sub={t("qms.stats.pendingAqSub")} />
        <StatCard label={t("qms.stats.closed")} value={clos} color="green" sub={t("qms.stats.closedSub", { rate: closeRate })} />
      </div>

      <div className="qms-filter-panel">
        <div className="qms-filter-grid qms-filter-grid--plans">
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.searchLabel")}</span>
            <div className="qms-filter-control qms-filter-search">
              <span className="qms-filter-icon"><IcoSearch /></span>
              <input type="text" placeholder={t("qms.filters.searchPlanPlaceholder")} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
              {search && <button type="button" className="qms-filter-clear" onClick={() => { setSearch(""); setPage(1); }}>✕</button>}
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.status")}</span>
            <div className="qms-filter-control">
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.statusAll")}</option>
                <option value="OUVERT">{t("qms.filters.statusOuvert")}</option>
                <option value="EN_COURS">{t("qms.stats.inProgress")}</option>
                <option value="EN_ATTENTE_VALIDATION_AQ">{t("qms.filters.statusAttenteAq")}</option>
                <option value="VALIDE_AQ">{t("qms.filters.statusValideAq")}</option>
                <option value="CLOS">{t("qms.filters.statusClos")}</option>
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.responsible")}</span>
            <div className="qms-filter-control">
              <select value={filterResponsable} onChange={e => { setFilterResponsable(e.target.value); setPage(1); }}>
                <option value="">{t("qms.filters.all")}</option>
                {responsables.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.periodLabel")}</span>
            <div className="qms-filter-control">
              <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); setPage(1); }}>
                <option value="TODAY">{t("qms.filters.today")}</option>
                <option value="WEEK">{t("qms.filters.thisWeek")}</option>
                <option value="ALL">{t("qms.filters.all")}</option>
              </select>
            </div>
          </div>
          <div className="qms-filter-field">
            <span className="qms-filter-label">{t("qms.filters.viewMode")}</span>
            <div className="qms-filter-toggle">
              <button className={`qms-filter-toggle-btn ${view === "kanban" ? "active" : ""}`} onClick={() => setView("kanban")}>⊞ {t("qms.filters.kanban")}</button>
              <button className={`qms-filter-toggle-btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>☰ {t("qms.filters.list")}</button>
            </div>
          </div>
        </div>
        <div className="qms-filter-footer">
          <div className="qms-filter-meta">
            <div className="qms-filter-counter">
              <span className="counter-badge">{filtered.length}</span>
              <span className="counter-label">{t("qms.filters.results", { count: filtered.length })}</span>
            </div>
          </div>
          <div className="qms-filter-actions">
            {(search || filterStatus || filterResponsable || filterPeriod !== "ALL") && (
              <button className="qms-filter-reset" onClick={() => { setSearch(""); setFilterStatus(""); setFilterResponsable(""); setFilterPeriod("ALL"); setPage(1); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>
                {t("qms.filters.reset")}
              </button>
            )}
            <button className="qms-filter-reset" onClick={() => setShowCompletedItems(v => !v)}>
              {showCompletedItems ? "Masquer les clôturés" : "Consulter les clôturés"}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:selectedPlan ? "1fr 380px" : "1fr", gap:24 }}>
        <div>
          {view === "kanban" ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
              {kanbanCols.map(col => {
                const items = col.key === "TERMINAL"
                  ? pagedPlans.filter(p => p.statut === "CLOS" || p.statut === "VALIDE_AQ")
                  : pagedPlans.filter(p => p.statut === col.key);
                return (
                  <div className="kanban-col" key={col.key}>
                    <div className="kanban-col-header" style={{ background:col.bg, border:`1px solid ${col.border}` }}>
                      <div style={{ color:col.color, fontWeight:700, fontSize:13 }}>{col.label}</div>
                      <span style={{ background:`${col.color}20`, color:col.color, fontWeight:700, padding:"2px 8px", borderRadius:20, fontSize:12 }}>{items.length}</span>
                    </div>
                    {items.length === 0 ? <div className="kanban-empty">{t("qms.table.noPlan")}</div> : items.map(p => {
                      const retard = !isPlanTerminal(p) && p.dateEcheance && new Date(p.dateEcheance) < new Date();
                      const ctx = getPlanContext(p);
                      const isRouge = isPlanRouge(p);
                      return (
                        <div className="kanban-card" key={p.id} onClick={() => setSelectedPlan(p)} style={{ borderLeft:`3px solid ${isRouge ? "var(--error)" : "var(--warning)"}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, alignItems:"center" }}>
                            <span style={{ fontSize:12, fontWeight:800, color:"var(--warning)" }}>PA-{p.id}</span>
                            <span className={`plan-workflow-badge ${isRouge ? "rouge" : "jaune"}`}>{isRouge ? "🔴" : "🟡"}</span>
                          </div>
                          <div title={p.description} style={{ fontSize:13, fontWeight:700, color:"var(--gray-800)", marginBottom:6 }}>{truncate(p.description, 80)}</div>
                          <div style={{ fontSize:11, color:"var(--gray-500)", marginBottom:6 }}>⚙️ {ctx.processus}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <Avatar nom={p.responsableNom} size={18} />
                            <span style={{ fontSize:11, color:"var(--gray-600)" }}>{p.responsableNom || "—"}</span>
                            <span style={{ fontSize:11, marginLeft:"auto", color:retard ? "var(--error)" : "var(--gray-500)" }}>{fmt(p.dateEcheance)}{retard ? " ⚠" : ""}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="card-title"><div className="card-title-icon" style={{ background:"rgba(245,158,11,0.1)", color:"var(--warning)" }}>📋</div>{t("qms.table.planHeaders.ref")} ({total})</div>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr><th>{t("qms.table.planHeaders.ref")}</th><th>{t("qms.table.planHeaders.description")}</th><th>{t("qms.table.planHeaders.color")}</th><th>{t("qms.table.planHeaders.responsible")}</th><th>{t("qms.table.planHeaders.deadline")}</th><th>{t("qms.table.planHeaders.status")}</th><th></th></tr>
                  </thead>
                  <tbody>
                    {pagedPlans.map(p => {
                      const retard = !isPlanTerminal(p) && p.dateEcheance && new Date(p.dateEcheance) < new Date();
                      const isRouge = isPlanRouge(p);
                      return (
                        <tr key={p.id} onClick={() => setSelectedPlan(p)} style={{ cursor:"pointer", background:selectedPlan?.id === p.id ? "var(--primary-bg)" : "" }}>
                          <td style={{ fontWeight:800, color:"var(--warning)" }}>PA-{p.id}</td>
                          <td title={p.description} style={{ fontWeight:600, maxWidth:200 }}>{truncate(p.description, 100)}</td>
                          <td><span className={`plan-workflow-badge ${isRouge ? "rouge" : "jaune"}`}>{isRouge ? "🔴 ROUGE" : "🟡 JAUNE"}</span></td>
                          <td><div style={{ display:"flex", alignItems:"center", gap:6 }}><Avatar nom={p.responsableNom} size={22} /><span>{p.responsableNom || "—"}</span></div></td>
                          <td style={{ color:retard ? "var(--error)" : "var(--gray-600)" }}>{fmt(p.dateEcheance)}{retard ? " ⚠" : ""}</td>
                          <td><PlanStatutBadge plan={p} /></td>
                          <td><button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setSelectedPlan(p); }}>Consulter</button></td>
                        </tr>
                      );
                    })}
                    {pagedPlans.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign:"center", padding:40, color:"var(--gray-500)" }}>{t("qms.table.noPlan")}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={pageSize} />
        </div>

        {selectedPlan && (() => {
          const prog = getPlanProgress(selectedPlan);
          const ctx = getPlanContext(selectedPlan);
          const retard = !isPlanTerminal(selectedPlan) && selectedPlan.dateEcheance && new Date(selectedPlan.dateEcheance) < new Date();
          const isRouge = isPlanRouge(selectedPlan);
          const enAttenteAQSelected = isPlanEnAttenteAQ(selectedPlan);
          const terminal = isPlanTerminal(selectedPlan);
          
          let progressColor = "blue";
          if (terminal) progressColor = "green";
          else if (enAttenteAQSelected) progressColor = "purple";
          else if (retard) progressColor = "error";
          
          return (
            <div className="plan-modal-v2" onClick={() => setSelectedPlan(null)}>
              <div className="plan-card" onClick={e => e.stopPropagation()}>
                <div className="plan-header">
                  <div className="plan-header-content">
                    <div className={`plan-badge-header ${isRouge ? "rouge" : "jaune"}`}>
                      <span>{isRouge ? "🔴" : "🟡"}</span>
                      <span>{isRouge ? t("qms.planAction.rougeLabel") : t("qms.planAction.jauneLabel")}</span>
                    </div>
                    <div className="plan-title">PA-{selectedPlan.id}</div>
                    <div className="plan-subtitle">
                      <span>{selectedPlan.responsableNom || t("qms.detail.notAssigned")}</span>
                      <span className="plan-subtitle-sep"></span>
                      <span>{ctx.processus}</span>
                      <span className="plan-subtitle-sep"></span>
                      <span>{t("qms.detail.createdOn", { date: fmt(selectedPlan.creeLe) })}</span>
                    </div>
                  </div>
                  <button className="plan-close-btn" onClick={() => setSelectedPlan(null)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="plan-body">
                  <div className="plan-grid-modern">
                    <div className="plan-main-section">
                      <div className="progress-card">
                        <div className="progress-header">
                          <span className="progress-label">{t("qms.detail.progress")}</span>
                          <span className="progress-percent">{prog}%</span>
                        </div>
                        <div className="progress-bar-modern">
                          <div 
                            className="progress-fill-modern" 
                            style={{ 
                              width: `${prog}%`,
                              background: progressColor === "green" ? "var(--success)" 
                                : progressColor === "purple" ? "var(--purple)" 
                                : progressColor === "error" ? "var(--error)"
                                : "var(--primary)"
                            }}
                          />
                        </div>
                      </div>

                      {terminal && (
                        <div className="alert-card alert-card-success">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                          <span>{t("qms.workflow.closed")}</span>
                        </div>
                      )}
                      {enAttenteAQSelected && (
                        <div className="alert-card alert-card-info">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          <span>{t("qms.stats.pendingAq")}</span>
                        </div>
                      )}
                      {!terminal && !enAttenteAQSelected && retard && (
                        <div className="alert-card alert-card-danger">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                          <span>{t("common.overdue")}</span>
                        </div>
                      )}

                      <div className="description-card">
                        <div className="description-label">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                          {t("common.description")}
                        </div>
                        <div className="description-text">{selectedPlan.description}</div>
                      </div>

                      <div className="info-card">
                        <div className="info-card-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 8v4l3 3M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                          </svg>
                          {t("qms.detail.timeline")}
                        </div>
                        <div className="info-card-body">
                          <div className="timeline">
                            <div className="timeline-item">
                              <div className="timeline-dot timeline-dot-done">✓</div>
                              <div className="timeline-content">
                                <div className="timeline-title">{t("qms.timeline.planCreated")}</div>
                                <div className="timeline-desc">{fmtDatetime(selectedPlan.creeLe)}</div>
                              </div>
                            </div>
                            {selectedPlan.statut === "EN_COURS" && (
                              <div className="timeline-item">
                                <div className="timeline-dot timeline-dot-current">▶</div>
                                <div className="timeline-content">
                                  <div className="timeline-title">{t("qms.stats.inProgress")}</div>
                                  <div className="timeline-desc">{t("qms.detail.inProgressDesc")}</div>
                                </div>
                              </div>
                            )}
                            {selectedPlan.closLe && (
                              <div className="timeline-item">
                                <div className="timeline-dot timeline-dot-done">✓</div>
                                <div className="timeline-content">
                                  <div className="timeline-title">{t("qms.timeline.planClosed")}</div>
                                  <div className="timeline-desc">{fmtDatetime(selectedPlan.closLe)}</div>
                                </div>
                              </div>
                            )}
                            {selectedPlan.valideAqLe && (
                              <div className="timeline-item">
                                <div className="timeline-dot timeline-dot-done">✓</div>
                                <div className="timeline-content">
                                  <div className="timeline-title">{t("qms.timeline.validatedByAq")}</div>
                                  <div className="timeline-desc">{fmtDatetime(selectedPlan.valideAqLe)}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="plan-sidebar">
                      <div className="info-card">
                        <div className="info-card-header">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="16" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                          {t("qms.detail.details")}
                        </div>
                        <div className="info-card-body">
                          <div className="info-grid">
                            <div className="info-row">
                              <span className="info-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                                {t("common.responsible")}
                              </span>
                              <span className="info-value">{selectedPlan.responsableNom || "—"}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                  <line x1="16" y1="2" x2="16" y2="6" />
                                  <line x1="8" y1="2" x2="8" y2="6" />
                                  <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {t("common.deadline")}
                              </span>
                              <span className="info-value" style={{ color: retard ? "var(--error)" : "inherit" }}>
                                {fmt(selectedPlan.dateEcheance)} {retard && "⚠"}
                              </span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 4v16h16V4H4z" />
                                  <line x1="8" y1="9" x2="16" y2="9" />
                                  <line x1="8" y1="13" x2="12" y2="13" />
                                </svg>
                                {t("common.checklist")}
                              </span>
                              <span className="info-value">#{selectedPlan.checklistId}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-label">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                {t("common.status")}
                              </span>
                              <span className="info-value">
                                <PlanStatutBadge plan={selectedPlan} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedPlan.commentaireCloture && (
                        <div className="comment-card comment-card-technician">
                          <div className="comment-header">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            {t("qms.detail.technicianComment")}
                          </div>
                          <div className="comment-text">"{selectedPlan.commentaireCloture}"</div>
                          <div className="comment-meta">
                            <span>📅 {fmtDatetime(selectedPlan.closLe)}</span>
                          </div>
                        </div>
                      )}

                      {selectedPlan.commentaireValidationAq && (
                        <div className="comment-card">
                          <div className="comment-header">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            {t("qms.detail.aqComment")}
                          </div>
                          <div className="comment-text">"{selectedPlan.commentaireValidationAq}"</div>
                          <div className="comment-meta">
                            <span>✅ {t("qms.detail.validatedBy", { name: selectedPlan.valideAqParMatricule })}</span>
                            <span>•</span>
                            <span>{fmtDatetime(selectedPlan.valideAqLe)}</span>
                          </div>
                        </div>
                      )}

                      <div className="plan-actions-modern">
                        {selectedPlan.checklistId && (
                          <button 
                            className="btn-modern btn-modern-outline btn-modern-sm"
                            onClick={() => { 
                              setSelectedPlan(null); 
                              navigate(`/validation?checklistId=${selectedPlan.checklistId}`); 
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M15 18l-6-6 6-6" />
                            </svg>
                            {t("qms.table.viewPlan")}
                          </button>
                        )}
                        {canManagePlans && selectedPlan.statut === "OUVERT" && (
                          <button 
                            className="btn-modern btn-modern-warning btn-modern-sm" 
                            onClick={() => { 
                              setSelectedPlan(null); 
                              handleMettreEnCours(selectedPlan.id); 
                            }} 
                            disabled={acting}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {t("common.start")}
                          </button>
                        )}
                        {canClosePlanNow(selectedPlan) && (
                          <button 
                            className="btn-modern btn-modern-success btn-modern-sm" 
                            onClick={() => { 
                              setSelectedPlan(null); 
                              openCloseModal(selectedPlan); 
                            }} 
                            disabled={acting}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            {isRouge ? t("qms.closeModal.submitToAq") : t("qms.closeModal.closePlan")}
                          </button>
                        )}
                        {canValiderAQ && enAttenteAQSelected && (
                          <button 
                            className="btn-modern btn-modern-purple btn-modern-sm" 
                            onClick={() => { 
                              setSelectedPlan(null); 
                              setAqModalPlan(selectedPlan); 
                            }} 
                            disabled={acting}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            {t("qms.validateAqModal.validate")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP ROOT
═══════════════════════════════════════════════════════════════ */

const PAGES = [
  { key:"validation", label:"✅ Validation", component:PageValidation },
  { key:"plans", label:"🔧 Plans d'Action", component:PagePlans },
];

export default function QualityManagementSystem() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();
  const isPPOUser = isPPO(user?.role);
  const [, setCritereLoadedVersion] = useState(0);

  const getInitialPage = useCallback(() => {
    if (isPPOUser) return "validation";
    const tab = searchParams.get("tab");
    if (tab === "validation" || tab === "plans") return tab;
    const p = location.pathname;
    if (p.includes("/plan-actions")) return "plans";
    // /qualityMangement, /validations et tout autre chemin → Validations par défaut
    return "validation";
  }, [location.pathname, searchParams, isPPOUser]);

  const [page, setPage] = useState(getInitialPage);
  useEffect(() => { setPage(getInitialPage()); }, [getInitialPage]);

  useEffect(() => {
    let mounted = true;
    getAllCriteres().then(r => {
      const data = r?.data || [];
      const m = new Map();
      data.forEach(c => { if (c && c.id != null) m.set(Number(c.id), c.couleur || c.categorie || null); });
      if (mounted) { setGlobalCritereMap(m); setCritereLoadedVersion(v => v + 1); }
    }).catch(e => { console.debug("Failed to load criteres:", e?.message || e); });
    return () => { mounted = false; };
  }, []);

  const Active = PAGES.find(p => p.key === page)?.component || PageValidation;

  return (
    <>
      <style>{css}</style>
      <div className="qms-pro">
        <nav className="qms-nav">
          {PAGES.map(p => (
            <button key={p.key} className={`qms-nav-tab ${page === p.key ? "active" : ""}`} onClick={() => setPage(p.key)}>{p.label}</button>
          ))}
        </nav>
        <Active />
      </div>
    </>
  );
}