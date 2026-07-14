// CriteresPage.jsx - Version premium design

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { CriterionImage } from "../../components/CriterionImage";
import { getCriteresByProcessus, getAllProcessus, createCritere, updateCritere, deleteCritere, batchDeleteCriteres, uploadCritereImage, generateAiCritereImage, recomputeCritereImages, getAllPlants, getAllSegments } from "../../api";
import api from "../../api/axiosInstance";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import ImportChecklistModal from "./ImportChecklistModal";
import CritereHistoriqueModal from "./CritereHistoriqueModal";
import Pagination from "../../components/Pagination";
import { useI18n } from "../../context/I18nContext";
import { getCritereNom, getCritereDescription } from "../../utils/critereUtils";  
function resolveCritereImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const clean = rawUrl.trim().replace(/\\/g, "/");
  if (!clean) return "";
  if (clean.includes("/api/uploads/")) {
    const normalized = clean.replace("/api/uploads/", "/uploads/");
    return /^https?:\/\//i.test(normalized) ? normalized : `${window.location.origin}${normalized}`;
  }
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

const PAGE_SIZE = 15;

const TC = {
  QUALITE:   { bg:"#ecfdf5", color:"#059669", border:"#6ee7b7", icon:"✓", label:"Qualité"   },
  SECURITE:  { bg:"#fff1f2", color:"#e11d48", border:"#fda4af", icon:"⚠", label:"Sécurité"  },
  TECHNIQUE: { bg:"#eff6ff", color:"#2563eb", border:"#93c5fd", icon:"⚙", label:"Technique" },
};
const CC = {
  Rouge: { bg:"#fff1f2", color:"#e11d48", dot:"#ef4444", light:"#fecdd3" },
  Jaune: { bg:"#fefce8", color:"#ca8a04", dot:"#eab308", light:"#fef08a" },
  Vert:  { bg:"#f0fdf4", color:"#16a34a", dot:"#22c55e", light:"#bbf7d0" },
};
const MC = {
  VISUEL:        { label:"Visuel",        bg:"#f5f3ff", color:"#7c3aed", icon:"👁" },
  SIMULATION:    { label:"Simulation",    bg:"#fff7ed", color:"#c2410c", icon:"🔄" },
  EN_PRODUCTION: { label:"En production", bg:"#f0fdf4", color:"#15803d", icon:"▶" },
};
const TYPES    = ["QUALITE","SECURITE","TECHNIQUE"];
const COULEURS = ["Rouge","Jaune","Vert"];
const MOYENS   = ["VISUEL","SIMULATION","EN_PRODUCTION"];

// ─── Safe translation helper ──────────────────────────────────────
function safeStr(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return fallback;
}

function ProcessusSelector({ onCreateChecklistClick, onImportClick, loading, translate }) {
  const { t } = useI18n();
  const ts = (key, params, fb) => safeStr(t(key, params), fb ?? key);
  const [hoveredCard, setHoveredCard] = useState(null);

  if (loading) {
    return (
      <div style={gsModern.loadBox}>
        <div style={gsModern.spinner}>
          <div style={gsModern.spinnerRing}></div>
        </div>
        <span style={{ color: "var(--tx-3)", fontSize: 14, fontWeight: 500 }}>
          {ts('sprint2.criteria.loadingProcesses', undefined, 'Chargement des processus...')}
        </span>
      </div>
    );
  }

  return (
    <div style={gsModern.container}>
      {/* Hero Section */}
      <div style={gsModern.heroSection}>
        <div style={gsModern.heroContent}>
          <div style={gsModern.heroBadge}>
            <span style={gsModern.heroBadgeDot}></span>
            {ts('sprint2.criteria.hero.badge', undefined, 'Gestion des critères')}
          </div>
          <h1 style={gsModern.heroTitle}>
            {ts('sprint2.criteria.hero.title1', undefined, 'Créez vos')}{' '}
            <span style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>
              {ts('sprint2.criteria.hero.title2', undefined, 'critères qualité')}
            </span>
          </h1>
        </div>
      </div>

      {/* Cards Section */}
      <div style={gsModern.cardsContainer}>
        <div style={gsModern.cardsGrid}>
          {/* Carte Création Manuelle */}
          <div 
            className="premium-card"
            style={{
              ...gsModern.card,
              ...(hoveredCard === 'manual' && gsModern.cardHover),
              transform: hoveredCard === 'manual' ? 'translateY(-8px)' : 'translateY(0)',
            }}
            onMouseEnter={() => setHoveredCard('manual')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={onCreateChecklistClick}
          >
            <div style={gsModern.cardGradient} className="card-gradient"></div>
            <div style={gsModern.cardIconWrapper}>
              <div style={gsModern.cardIconBg}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round"/>
                  <circle cx="12" cy="12" r="9" stroke="currentColor"/>
                </svg>
              </div>
            </div>
            <h3 style={gsModern.cardTitle}>{ts('sprint2.criteria.card.manual.title', undefined, 'Création manuelle')}</h3>
            <p style={gsModern.cardDesc}>
              {ts('sprint2.criteria.card.manual.desc', undefined, 'Créez vos critères un par un avec un contrôle total sur chaque détail')}
            </p>
            <div style={gsModern.cardFeatures}>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.manual.feature1', undefined, 'Contrôle granulaire')}</span>
              </div>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.manual.feature2', undefined, 'Images personnalisées')}</span>
              </div>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.manual.feature3', undefined, 'Classification complète')}</span>
              </div>
            </div>
            <div style={gsModern.cardButton}>
              <span>{ts('sprint2.criteria.card.manual.button', undefined, 'Commencer')}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={gsModern.cardShine} className="card-shine"></div>
          </div>

          {/* Carte Import PDF */}
          <div 
            className="premium-card"
            style={{
              ...gsModern.card,
              ...(hoveredCard === 'import' && gsModern.cardHover),
              transform: hoveredCard === 'import' ? 'translateY(-8px)' : 'translateY(0)',
            }}
            onMouseEnter={() => setHoveredCard('import')}
            onMouseLeave={() => setHoveredCard(null)}
            onClick={onImportClick}
          >
            <div style={gsModern.cardGradientAlt} className="card-gradient-alt"></div>
            <div style={gsModern.cardIconWrapper}>
              <div style={{...gsModern.cardIconBg, background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor"/>
                  <path d="M14 2v6h6" stroke="currentColor"/>
                  <path d="M12 18v-4M9 15h6" stroke="currentColor"/>
                </svg>
              </div>
            </div>
            <h3 style={gsModern.cardTitle}>{ts('sprint2.checklist.landing.title', undefined, 'Import PDF')}</h3>
            <p style={gsModern.cardDesc}>
              {ts('sprint2.criteria.card.import.desc', undefined, 'Importez rapidement vos checklists existantes depuis des documents PDF')}
            </p>
            <div style={gsModern.cardFeatures}>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.import.feature1', undefined, 'Extraction automatique')}</span>
              </div>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.import.feature2', undefined, 'Gain de temps')}</span>
              </div>
              <div style={gsModern.featureItem}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeLinecap="round"/>
                </svg>
                <span>{ts('sprint2.criteria.card.import.feature3', undefined, 'Migration simplifiée')}</span>
              </div>
            </div>
            <div style={gsModern.cardButton}>
              <span>{ts('sprint2.criteria.card.import.button', undefined, 'Importer')}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={gsModern.cardShine} className="card-shine-alt"></div>
          </div>
        </div>
      </div>

      {/* Section info supplémentaire */}
      <div style={gsModern.infoSection}>
        <div style={gsModern.infoGrid}>
          <div style={gsModern.infoItem}>
            <div style={gsModern.infoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                <path d="M12 16v-4M12 8h.01" stroke="currentColor"/>
              </svg>
            </div>
            <div style={gsModern.infoText}>
              <strong>{ts('sprint2.criteria.info.know.title', undefined, 'À savoir')}</strong>
              <span>{ts('sprint2.criteria.info.know.desc', undefined, 'Les critères sont organisés par processus, segments et machines')}</span>
            </div>
          </div>
          <div style={gsModern.infoItem}>
            <div style={gsModern.infoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor"/>
              </svg>
            </div>
            <div style={gsModern.infoText}>
              <strong>{ts('sprint2.criteria.info.types.title', undefined, 'Plusieurs types')}</strong>
              <span>{ts('sprint2.criteria.info.types.desc', undefined, 'Qualité, Sécurité et Technique - adaptés à vos besoins')}</span>
            </div>
          </div>
          <div style={gsModern.infoItem}>
            <div style={gsModern.infoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
                <path d="M8 7h8M8 11h6M8 15h4" stroke="currentColor"/>
              </svg>
            </div>
            <div style={gsModern.infoText}>
              <strong>{ts('sprint2.criteria.info.ai.title', undefined, 'Génération IA')}</strong>
              <span>{ts('sprint2.criteria.info.ai.desc', undefined, 'Images automatiques pour illustrer vos critères')}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .premium-card {
          position: relative;
          overflow: hidden;
        }
        
        .premium-card .card-gradient,
        .premium-card .card-gradient-alt {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 120px;
          transition: height 0.4s ease;
        }
        
        .premium-card:hover .card-gradient {
          height: 160px;
        }
        
        .premium-card:hover .card-gradient-alt {
          height: 160px;
        }
        
        .premium-card .card-shine,
        .premium-card .card-shine-alt {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.6s ease;
        }
        
        .premium-card:hover .card-shine,
        .premium-card:hover .card-shine-alt {
          left: 100%;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        
        .stat-value {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PDF PREVIEW MODAL - Design premium
═══════════════════════════════════════════════════════════════════ */
function PdfPreviewModal({ isOpen, onClose, pdfUrl, pdfName = "checklist.pdf", previewList = [], onSelectPreview = () => {} }) {
  const { t } = useI18n();
  const ts = (key, params, fb) => safeStr(t(key, params), fb ?? key);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = pdfName || "checklist.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div style={pdfStyles.overlay} onClick={onClose}>
      <div style={pdfStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={pdfStyles.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={pdfStyles.headerIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor"/>
                <path d="M14 2v6h6" stroke="currentColor"/>
                <path d="M12 18v-4M9 15h6" stroke="currentColor"/>
              </svg>
            </div>
            <div>
              <h3 style={pdfStyles.headerTitle}>
                {ts('sprint2.criteria.pdfPreview.title', undefined, 'Prévisualisation PDF')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={pdfStyles.headerSub}>
                  {pdfName || ts('sprint2.criteria.pdfPreview.subtitle', undefined, 'PDF importé')}
                </p>
                {Array.isArray(previewList) && previewList.length > 1 && (
                  <select
                    value={previewList.findIndex(p => p.name === (pdfName || 'checklist.pdf'))}
                    onChange={e => {
                      const idx = Number(e.target.value);
                      const sel = previewList[idx];
                      if (sel) onSelectPreview(sel.url, sel.name);
                    }}
                    style={{ marginLeft: 8, padding: '6px 8px', borderRadius: 8 }}
                  >
                    {previewList.map((p, i) => (
                      <option key={i} value={i}>{p.name} · {new Date(p.ts).toLocaleString()}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
          <button style={pdfStyles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={pdfStyles.body}>
          {/* Zone PDF */}
          <div style={pdfStyles.previewArea}>
            {pdfUrl ? (
              <iframe src={pdfUrl} style={pdfStyles.iframe} title={pdfName || "PDF Preview"} />
            ) : (
              <div style={pdfStyles.emptyArea}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor"/>
                  <path d="M14 2v6h6" stroke="currentColor"/>
                </svg>
                <p>{ts('sprint2.criteria.pdfPreview.selectChecklist', undefined, 'Aucun PDF à prévisualiser')}</p>
              </div>
            )}
          </div>
        </div>

        <div style={pdfStyles.footer}>
          <button style={pdfStyles.cancelBtn} onClick={onClose}>
            {ts('common.close', undefined, 'Fermer')}
          </button>
          {pdfUrl && (
            <button style={pdfStyles.downloadBtn} onClick={handleDownload}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m-4-4l4 4 4-4" stroke="currentColor"/>
              </svg>
              {ts('sprint2.criteria.pdfPreview.download', undefined, 'Télécharger PDF')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const pdfStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    zIndex: 10000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    background: "var(--bg-surface, white)",
    borderRadius: 24,
    width: "90vw",
    maxWidth: 1200,
    height: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid var(--gray-200, #e5e7eb)",
    background: "var(--bg-surface, white)",
  },
  headerIcon: {
    width: 48,
    height: 48,
    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
  },
  headerTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "var(--gray-900)",
  },
  headerSub: {
    margin: "4px 0 0",
    fontSize: 13,
    color: "var(--gray-500)",
  },
  closeBtn: {
    background: "var(--gray-100)",
    border: "none",
    fontSize: 16,
    cursor: "pointer",
    color: "var(--gray-600)",
    padding: "8px 12px",
    borderRadius: 10,
    transition: "all 0.2s",
  },
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    gap: 1,
    background: "var(--gray-200, #e5e7eb)",
  },
  sidebar: {
    width: 300,
    background: "var(--bg-surface, white)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: "14px 18px",
    fontWeight: 600,
    fontSize: 13,
    borderBottom: "1px solid var(--gray-200, #e5e7eb)",
    background: "var(--gray-50, #f9fafb)",
    color: "var(--gray-700, #374151)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  sidebarLoading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
    color: "var(--gray-500, #6b7280)",
  },
  sidebarEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 48,
    textAlign: "center",
  },
  checklistList: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "12px 14px",
    border: "1px solid",
    borderRadius: 12,
    marginBottom: 8,
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  previewArea: {
    flex: 1,
    background: "var(--gray-100, #f3f4f6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "auto",
  },
  selectedDetail: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  selectedDetailHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--gray-500, #6b7280)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
  },
  selectedDetailCard: {
    border: "1px solid var(--gray-200, #e5e7eb)",
    borderRadius: 16,
    padding: 20,
    background: "var(--gray-50, #f9fafb)",
  },
  metaRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  metaBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    background: "white",
    border: "1px solid var(--gray-200, #e5e7eb)",
    fontSize: 12,
    color: "var(--gray-700, #374151)",
    fontWeight: 600,
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  },
  loadingArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    color: "var(--gray-500, #6b7280)",
  },
  errorArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    textAlign: "center",
    color: "var(--error, #ef4444)",
  },
  emptyArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    color: "var(--gray-500, #6b7280)",
    textAlign: "center",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    padding: "16px 24px",
    borderTop: "1px solid var(--gray-200, #e5e7eb)",
    background: "var(--bg-surface, white)",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: "transparent",
    border: "1.5px solid var(--gray-300, #d1d5db)",
    color: "var(--gray-700, #374151)",
    transition: "all 0.2s",
  },
  downloadBtn: {
    padding: "10px 20px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    border: "none",
    color: "white",
    transition: "all 0.2s",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  retryBtn: {
    padding: "8px 20px",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
    border: "none",
    color: "white",
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid var(--gray-300, #d1d5db)",
    borderTopColor: "var(--primary, #4f46e5)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  spinnerSmall: {
    width: 20,
    height: 20,
    border: "2px solid var(--gray-300, #d1d5db)",
    borderTopColor: "var(--primary, #4f46e5)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

export default function CriteresPage() {
  const { t, lang } = useI18n();
  const translate = (value) => value;
  const [searchParams] = useSearchParams();
  const initialProcessusId = searchParams.get("processusId");

  const ts = (key, params, fb) => safeStr(t(key, params), fb ?? key);

  const { user } = useAuth();
  const canEdit = ["PPO","ADMIN"].includes(user?.role);
  const canViewHistory = ["PPO", "ADMIN", "AGENT_QUALITE"].includes(user?.role);

  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewPdfName, setPreviewPdfName] = useState("");
  const [previewList, setPreviewList] = useState([]);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [wikiSearching, setWikiSearching] = useState(false);
  const [wikiSource, setWikiSource] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSource, setAiSource] = useState(false);
  const imgInputRef = useRef(null);
  const autoRegenRef = useRef(new Set());

  const [processus, setProcessus] = useState([]);
  const [selectedProc, setSelectedProc] = useState(null);
  const [loadingProcessus, setLoadingProcessus] = useState(true);

  const [plants, setPlants] = useState([]);
  const [segments, setSegments] = useState([]);
  const [selectedPlants, setSelectedPlants] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [showFilterStep, setShowFilterStep] = useState(false);

  const [criteres, setCriteres] = useState([]);
  const [loadingCrit, setLoadingCrit] = useState(false);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [imageFilter, setImageFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [sel, setSel] = useState([]);
  const [selAll, setSelAll] = useState(false);
  const [bulkDel, setBulkDel] = useState(false);
  const [msg, setMsg] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showHistorique, setShowHistorique] = useState(null);

  const getApiErrorMessage = (err, fallbackKey = "common.error") => {
    const data = err?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    return ts(fallbackKey, undefined, "Une erreur est survenue");
  };

  const getAiErrorMessage = (err) => {
    const raw = getApiErrorMessage(err, "sprint2.criteria.errors.aiGenerate");
    const lower = String(raw || "").toLowerCase();
    if (
      lower.includes("payment_required") ||
      (lower.includes("402") && lower.includes("hugging")) ||
      (lower.includes("credits") && lower.includes("epuis")) ||
      (lower.includes("depleted") && lower.includes("credit"))
    ) {
      return "Generation IA indisponible: credits Hugging Face epuises. Une image Wikipedia est utilisee automatiquement si disponible.";
    }
    return raw;
  };

  const handleAutoRegenImage = async (critereId) => {
    if (!canEdit || !critereId) return;
    if (autoRegenRef.current.has(critereId)) return;
    autoRegenRef.current.add(critereId);
    try {
      const res = await generateAiCritereImage(critereId);
      const url = res?.data?.url;
      if (url) {
        setCriteres(prev => prev.map(c => (c.id === critereId ? { ...c, image: url } : c)));
      }
    } catch (err) {
      // Ignore silently
    }
  };

  const [form, setForm] = useState({
    nom:"", description:"", nomAr:"", descriptionAr:"",
    type:"QUALITE", couleur:"Rouge", moyenVerification:"VISUEL",
    categorie:"Machine", processusId:"", image:""
  });

  const handleSelectProcessus = useCallback(async (proc) => {
    setSelectedProc(proc);
    setCriteres([]);
    setSel([]); setSelAll(false);
    setSearch(""); setTypeFilter(""); setImageFilter(false);
    setLoadingCrit(true);
    try {
      const r = await getCriteresByProcessus(proc.id);
      setCriteres(Array.isArray(r.data) ? r.data : []);
    } finally {
      setLoadingCrit(false);
    }
  }, []);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [plantsRes, segmentsRes, processusRes] = await Promise.all([
          getAllPlants(), getAllSegments(), getAllProcessus(),
        ]);
        const processList = Array.isArray(processusRes.data) ? processusRes.data : [];
        setPlants(Array.isArray(plantsRes.data) ? plantsRes.data : []);
        setSegments(Array.isArray(segmentsRes.data) ? segmentsRes.data : []);
        setProcessus(processList);

        const initialProc = initialProcessusId
          ? processList.find(p => String(p.id) === String(initialProcessusId))
          : null;
        if (initialProc) {
          setShowFilterStep(false);
          await handleSelectProcessus(initialProc);
        } else {
          setShowFilterStep(true);
        }
      } finally {
        setLoadingProcessus(false);
      }
    };
    loadInitialData();
  }, [initialProcessusId, handleSelectProcessus]);

  useEffect(() => { setPage(0); }, [search, typeFilter, imageFilter, selectedProc]);

  const reload = async () => {
    if (!selectedProc) return;
    setLoadingCrit(true);
    try {
      const r = await getCriteresByProcessus(selectedProc.id);
      setCriteres(Array.isArray(r.data) ? r.data : []);
    } finally {
      setLoadingCrit(false);
      setSel([]); setSelAll(false);
    }
  };

  const filtered = criteres
    .filter(c => !typeFilter || c.type === typeFilter)
    .filter(c => !imageFilter || Boolean(c.image))
    .filter(c => !search || [c.nom, c.description, c.nomAr].some(t => t?.toLowerCase().includes(search.toLowerCase())));

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const stats = TYPES.reduce((acc, type) => {
    acc[type] = criteres.filter(c => c.type === type).length;
    return acc;
  }, {});
  const canImport = canEdit && processus.length > 0;

  const toggleAll = () => {
    if (selAll) { setSel([]); setSelAll(false); }
    else        { setSel(filtered.map(c => c.id)); setSelAll(true); }
  };
  const toggleOne = (id) => setSel(prev => {
    const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    setSelAll(n.length === filtered.length && filtered.length > 0);
    return n;
  });

  const handleBulkDelete = async () => {
    if (!sel.length) return;
    setLoadingCrit(true);
    try {
      const res = await batchDeleteCriteres(sel);
      await reload();
      const apiMessage = typeof res?.data === "string" ? res.data : (res?.data?.message || "");
      if (apiMessage) window.alert(apiMessage);
    } catch (err) {
      window.alert(getApiErrorMessage(err, "sprint2.criteria.errors.bulkDelete"));
    } finally {
      setLoadingCrit(false);
      setBulkDel(false);
    }
  };

  const handleRecomputeImages = async () => {
    if (!selectedProc?.id || recomputeLoading) return;
    const confirmed = window.confirm("Régénérer les images IA de ce processus ? Les anciennes images locales seront remplacées.");
    if (!confirmed) return;
    setRecomputeLoading(true);
    try {
      const res = await recomputeCritereImages(selectedProc.id, true, 0);
      const updated = Number(res?.data?.updated || 0);
      await reload();
      window.alert(`${updated} image(s) régénérée(s).`);
    } catch (e) {
      window.alert(e.response?.data?.error || "Erreur lors de la régénération IA.");
    } finally {
      setRecomputeLoading(false);
    }
  };

  const handleChangeProcessus = (procId) => {
    const proc = processus.find(p => String(p.id) === String(procId));
    if (proc) handleSelectProcessus(proc);
  };

  const handleCreateChecklist = () => {
    openCreate();
  };

  const handleImportPdf = () => {
    setShowImport(true);
  };

  const handleOpenPdfPreview = () => {
    if (selectedProc) {
      setPdfPreviewOpen(true);
    }
  };

  const handleClosePdfPreview = () => {
    setPdfPreviewOpen(false);
  };

  // Persist preview PDF URL across SPA navigation so the preview remains
  // available when the user navigates away and comes back.
  useEffect(() => {
    // On mount, restore from sessionStorage if present
    try {
      const raw = sessionStorage.getItem('ok_preview_pdf_list');
      if (raw) {
        const list = JSON.parse(raw || '[]');
        setPreviewList(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          const last = list[list.length - 1];
          setPreviewPdfUrl(last.url);
          setPreviewPdfName(last.name || 'checklist.pdf');
        }
      }
    } catch (e) {
      // ignore sessionStorage errors
    }
  }, []);

  // Revoke object URL only on full page unload to avoid losing the preview
  // when navigating inside the SPA. Also keep sessionStorage in sync.
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        const raw = sessionStorage.getItem('ok_preview_pdf_list');
        if (raw) {
          const list = JSON.parse(raw || '[]');
          (Array.isArray(list) ? list : []).forEach(e => {
            try { if (e?.url) URL.revokeObjectURL(e.url); } catch (err) {}
          });
        }
        sessionStorage.removeItem('ok_preview_pdf_list');
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const togglePlant = (plantId) => {
    setSelectedPlants(prev => prev.includes(plantId) ? prev.filter(id => id !== plantId) : [...prev, plantId]);
  };
  const toggleSegment = (segmentId) => {
    setSelectedSegments(prev => prev.includes(segmentId) ? prev.filter(id => id !== segmentId) : [...prev, segmentId]);
  };

  const handleProceedToProcessus = () => {
    if (selectedPlants.length === 0 && selectedSegments.length === 0) {
      setMsg("Veuillez sélectionner au moins un plant ou segment");
      return;
    }
    setShowFilterStep(false);
  };

  const handleBackToFilter = () => {
    setShowFilterStep(true);
    setSelectedProc(null);
    setCriteres([]);
    setMsg("");
  };

  const handleResetFilters = () => {
    setSelectedPlants([]);
    setSelectedSegments([]);
  };

  void [
    plants,
    segments,
    canImport,
    handleRecomputeImages,
    handleChangeProcessus,
    handleOpenPdfPreview,
    togglePlant,
    toggleSegment,
    handleProceedToProcessus,
    handleBackToFilter,
    handleResetFilters,
  ];

  const clearImageSelection = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview("");
    setImageFile(null);
    setWikiSource(false);
    setAiSource(false);
  };

  const handleAiGenerate = async () => {
    const targetId = modal === "edit" ? selected?.id : null;
    if (!targetId) {
      setMsg("Enregistre d'abord le critere avant de generer une image IA.");
      return;
    }
    setAiSearching(true);
    try {
      const res = await generateAiCritereImage(targetId, aiPrompt || "");
      const url = res?.data?.url || "";
      const warning = res?.data?.warning || "";
      if (!url) {
        setMsg(warning || "Image IA non generee.");
      } else {
        setForm(f => ({ ...f, image: url }));
        setAiSource(true);
        clearImageSelection();
      }
    } catch (e) {
      setMsg(getAiErrorMessage(e));
    } finally {
      setAiSearching(false);
    }
  };

  const handleWikiSearch = async () => {
    const query = (form.nom || "").trim();
    if (!query) return;
    setWikiSearching(true);
    let kw = "";
    try {
      const stopwords = new Set(["le","la","les","de","du","des","un","une","et","ou","pour","dans","sur","avec","est","sont","vérifier","contrôler","verifier","que","en","à","au","aux","par","se","si","il","ce","cette","ces","lors","avant","après","sous","présence","absence","bon","bonne","état"]);
      kw = query.toLowerCase()
        .replace(/[^a-zàâäéèêëïîôöùûüçœ\s-]/g, " ")
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopwords.has(w))
        .sort((a,b) => b.length - a.length)
        .slice(0,2)
        .join(" ");
    } catch (e) {
      kw = "";
    }

    if (!kw) { setWikiSearching(false); return; }

    try {
      const tryLang = async (language, kwToSearch) => {
        const url = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(kwToSearch)}`;
        const r = await fetch(url);
        if (!r.ok) return null;
        const data = await r.json();
        const src = data?.thumbnail?.source;
        return src ? src.replace(/\/\d+px-/, "/320px-") : null;
      };

      let imgUrl = await tryLang("fr", kw);
      if (!imgUrl) imgUrl = await tryLang("en", kw);

      if (imgUrl) {
        setForm(f => ({ ...f, image: imgUrl }));
        setWikiSource(true);
        clearImageSelection();
      } else {
        setMsg("Aucune image trouvée sur Wikipedia avec: " + kw);
      }
    } catch(e) {
      setMsg("Erreur lors de la recherche d'image.");
    }
    setWikiSearching(false);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) { setMsg(ts('sprint2.criteria.errors.imageFormat', undefined, 'Format image invalide')); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg(ts('sprint2.criteria.errors.imageTooLarge', undefined, 'Image trop grande (max 5 Mo)')); return; }
    clearImageSelection();
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setForm(f => ({ ...f, image: "" }));
  };

  const openCreate = () => {
    clearImageSelection();
    setForm({
      nom:"", description:"", nomAr:"", descriptionAr:"",
      type:"QUALITE", couleur:"Rouge", moyenVerification:"VISUEL",
      categorie:"Machine", processusId: String(selectedProc?.id || ""), image:""
    });
    setAiPrompt("");
    setModal("create");
  };

  const openEdit = (c) => {
    clearImageSelection();
    setSelected(c);
    const isWikiImg = Boolean(c.image && /^https?:\/\/.*wikipedia/i.test(c.image));
    setWikiSource(isWikiImg);
    setForm({
      nom:              c.nom                || "",
      description:      c.description        || "",
      nomAr:            c.nomAr              || "",
      descriptionAr:    c.descriptionAr      || "",
      type:             c.type               || "QUALITE",
      couleur:          c.couleur            || "Rouge",
      moyenVerification:c.moyenVerification  || "VISUEL",
      categorie:        c.categorie          || "Machine",
      processusId:      String(c.processusId ?? c.processus?.id ?? selectedProc?.id ?? ""),
      image:            c.image              || "",
    });
    setAiPrompt("");
    setModal("edit");
  };

  const closeModal = () => { clearImageSelection(); setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const parsedProcessusId = Number(form.processusId);
      if (!Number.isInteger(parsedProcessusId) || parsedProcessusId <= 0) {
        setMsg(ts('sprint2.criteria.errors.processRequired', undefined, 'Processus requis'));
        return;
      }
      let imageUrl = form.image || "";
      if (imageFile) {
        const uploadRes = await uploadCritereImage(imageFile);
        imageUrl = uploadRes?.data?.url || "";
        if (!imageUrl) { setMsg(ts('sprint2.criteria.errors.imageUpload', undefined, 'Erreur upload image')); return; }
      }
      const payload = { ...form, image: imageUrl, processusId: parsedProcessusId };
      if (modal === "create") await createCritere(payload);
      else                    await updateCritere(selected.id, payload);
      if (modal === "create") {
        const createdProc = processus.find(proc => String(proc.id) === String(parsedProcessusId));
        if (createdProc) {
          setSelectedProc(createdProc);
          setShowFilterStep(false);
        }
      }
      await reload();
      closeModal();
    } catch(err) {
      setMsg(err.response?.data?.message || err.response?.data || ts('sprint2.criteria.errors.save', undefined, 'Erreur lors de la sauvegarde'));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) {
      setDeleteMsg(ts('sprint2.criteria.errors.delete', undefined, 'Erreur suppression'));
      return;
    }
    setDeleteLoading(true);
    try {
      await deleteCritere(deleteId);
      setDeleteMsg("");
      setDeleteId(null);
      await reload();
    } catch (err) {
      setDeleteMsg(getApiErrorMessage(err, 'sprint2.criteria.errors.delete'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const displayImage = imagePreview || resolveCritereImageUrl(form.image);

  return (
    <div style={p.page}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideInLeft { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        
        .crit-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .crit-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
          pointer-events: none;
        }
        .crit-card:hover::before {
          transform: translateX(100%);
        }
        .crit-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        
        .stat-chip {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .stat-chip::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          transform: translate(-50%, -50%);
          transition: width 0.4s, height 0.4s;
        }
        .stat-chip:active::after {
          width: 200px;
          height: 200px;
        }
        .stat-chip:hover {
          transform: translateY(-3px);
        }
        
        .action-btn {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .action-btn::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          transform: translate(-50%, -50%);
          transition: width 0.4s, height 0.4s;
        }
        .action-btn:active::after {
          width: 200px;
          height: 200px;
        }
        .action-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.05);
        }
        
        .filter-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .filter-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        
        .proc-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .proc-card:hover {
          transform: translateY(-4px);
        }
        
        .landing-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .landing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(99,102,241,0.15);
        }
        
        .checklist-item {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .checklist-item:hover {
          background: var(--bg-1);
          border-color: #c7d2fe;
          transform: translateX(4px);
        }
        
        .icon-btn {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .icon-btn:hover {
          transform: scale(1.1);
          background: var(--bg-2) !important;
        }
        .icon-btn:active {
          transform: scale(0.95);
        }
        
        .img-zone {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .img-zone:hover {
          border-color: #6366f1 !important;
          background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%) !important;
        }
        
        .thumb-img {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .thumb-img:hover {
          transform: scale(1.08);
        }
        
        .detail-img {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .detail-img:hover {
          transform: scale(1.02);
        }
        
        /* Premium scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: var(--gray-100);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background: var(--gray-400);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: var(--gray-500);
        }
        
        /* Glass morphism effect for sidebar */
        .glass-effect {
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(10px);
        }
      `}</style>

      {showFilterStep && !selectedProc && (
        <ProcessusSelector
          onCreateChecklistClick={handleCreateChecklist}
          onImportClick={handleImportPdf}
          loading={loadingProcessus}
          translate={translate}
        />
      )}

      {/* Modal de prévisualisation PDF */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={handleClosePdfPreview}
        pdfUrl={previewPdfUrl}
        pdfName={previewPdfName || "checklist.pdf"}
        previewList={previewList}
        onSelectPreview={(url, name) => { setPreviewPdfUrl(url); setPreviewPdfName(name); }}
      />
      
      {selectedProc && (
        <>
          {/* HEADER avec breadcrumb premium */}
          <div style={p.header}>
            <div style={p.headerLeft}>
              <div style={p.headerIconWrap}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="white"/>
                  <path d="M8 7h8M8 11h6M8 15h4" stroke="white"/>
                </svg>
              </div>
              <div>
                <h1 style={p.title}>
                  {safeStr(translate(selectedProc.nom), selectedProc.nom)}
                </h1>
                <div style={p.breadcrumb}>
                  <span style={{ color: "var(--primary)", fontSize: 12, fontWeight: 600 }}>
                    {ts('sprint2.criteria.breadcrumb.criteria', undefined, 'Critères')}
                  </span>
                  <span style={p.sep}>/</span>
                  <span style={p.count}>{criteres.length} {ts('sprint2.criteria.breadcrumb.total', undefined, 'éléments')}</span>
                </div>
              </div>
            </div>
            <div style={p.actions}>
              {canEdit && (
                <>
                  <button className="action-btn" style={p.btnPrimary} onClick={openCreate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" stroke="currentColor"/>
                    </svg>
                    {ts('sprint2.criteria.actions.new', undefined, 'Nouveau critère')}
                  </button>
                  {sel.length > 0 && (
                    <button className="action-btn" style={p.btnDanger} onClick={() => setBulkDel(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" stroke="currentColor"/>
                      </svg>
                      {ts('sprint2.criteria.actions.bulkDelete', { count: sel.length }, `Supprimer (${sel.length})`)}
                    </button>
                  )}
                  <button className="action-btn" style={p.btnSecondary} onClick={() => setShowImport(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m-4-4l4 4 4-4" stroke="currentColor"/>
                    </svg>
                    {ts('sprint2.criteria.actions.importPdf', undefined, 'Importer PDF')}
                  </button>
                  <button className="action-btn" style={p.btnSecondary} onClick={handleOpenPdfPreview}>
                  
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor"/>
                      <path d="M14 2v6h6" stroke="currentColor"/>
                    </svg>
                    {ts('sprint2.criteria.actions.previewPdf', undefined, 'Prévisualiser PDF')}
                  </button>
                  <button
                    className="action-btn"
                    style={{
                      ...p.btnSecondary,
                      background: recomputeLoading
                        ? "var(--bg-2)"
                        : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                      color: recomputeLoading ? "var(--tx-4)" : "#15803d",
                      border: "1px solid #bbf7d0",
                      opacity: recomputeLoading ? 0.7 : 1,
                      cursor: recomputeLoading ? "not-allowed" : "pointer",
                    }}
                    onClick={handleRecomputeImages}
                    disabled={recomputeLoading}
                    title="Régénérer toutes les images IA du processus"
                  >
                    {recomputeLoading ? (
                      <>
                        <div style={{ width: 14, height: 14, border: "2px solid #94a3b8", borderTop: "2px solid transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                        Génération...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor"/>
                        </svg>
                        Régénérer images IA
                      </>
                    )}
                  </button>

                </>
              )}
            </div>
          </div>

          {/* STAT CHIPS Premium */}
          <div style={p.statsRow}>
            {TYPES.map(typeKey => {
              const cfg = TC[typeKey];
              const active = typeFilter === typeKey;
              const typeLabelMap = {
                QUALITE:   ts('operator.types.quality',   undefined, 'Qualité'),
                SECURITE:  ts('operator.types.security',  undefined, 'Sécurité'),
                TECHNIQUE: ts('operator.types.technical', undefined, 'Technique'),
              };
              return (
                <button key={typeKey} className="stat-chip" style={{
                  ...p.statChip,
                  background:  active ? `linear-gradient(135deg, ${cfg.color} 0%, ${cfg.color}dd 100%)` : "var(--bg-1)",
                  borderColor: active ? cfg.color : cfg.border,
                  color:       active ? "#fff"    : cfg.color,
                  boxShadow:   active ? `0 8px 20px ${cfg.color}40` : "0 2px 8px rgba(0,0,0,0.05)",
                }} onClick={() => setTypeFilter(active ? "" : typeKey)}>
                  <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px" }}>{stats[typeKey]}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", opacity: 0.85, marginTop: 2 }}>
                      {typeLabelMap[typeKey] || cfg.label}
                    </div>
                  </div>
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--tx-4)", fontWeight: 500 }}>
              <button
                onClick={() => setImageFilter(f => !f)}
                style={{
                  background: imageFilter ? "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" : "transparent",
                  border: imageFilter ? "1px solid #bbf7d0" : "1px solid var(--bd-1)",
                  borderRadius: 40,
                  padding: "6px 16px",
                  color: imageFilter ? "#15803d" : "var(--tx-4)",
                  fontWeight: imageFilter ? 700 : 500,
                  cursor: "pointer",
                  fontSize: 12,
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor"/>
                  <circle cx="8.5" cy="8.5" r="2.5" fill="currentColor" stroke="none"/>
                  <path d="M21 15l-5-4-3 3-4-4-5 6" stroke="currentColor"/>
                </svg>
                {criteres.filter(c => c.image).length} avec image {imageFilter ? "✕" : ""}
              </button>
              <div style={{ width: 1, height: 20, background: "var(--bd-1)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" stroke="currentColor"/>
                  <path d="M12 8v4M12 16h.01" stroke="currentColor"/>
                </svg>
                <span>{criteres.length} total</span>
              </div>
            </div>
          </div>

          {/* FILTRES Premium */}
          <div style={p.filtersBar}>
            <div style={p.searchWrap}>
              <span style={p.searchIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor"/>
                </svg>
              </span>
              <input
                style={p.searchInput}
                placeholder={ts('sprint2.criteria.searchPlaceholder', undefined, 'Rechercher un critère...')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button style={p.clearX} onClick={() => setSearch("")}>✕</button>}
            </div>
            {canEdit && filtered.length > 0 && (
              <label style={p.checkAll}>
                <input type="checkbox" checked={selAll} onChange={toggleAll} style={{ accentColor: "var(--l5)", width: 16, height: 16, cursor: "pointer", marginRight: 8 }}/>
                <span style={{ fontSize: 12, color: "var(--tx-3)", fontWeight: 600 }}>{ts('sprint2.criteria.selectAll', undefined, 'Tout sélectionner')}</span>
              </label>
            )}
            {(search || typeFilter || imageFilter) && (
              <button style={p.clearFilters} onClick={() => { setSearch(""); setTypeFilter(""); setImageFilter(false); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor"/>
                </svg>
                {ts('sprint2.criteria.clearFilters', undefined, 'Effacer filtres')}
              </button>
            )}
            {!loadingCrit && (
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--tx-4)", fontWeight: 500, background: "var(--bg-2)", padding: "4px 12px", borderRadius: 40 }}>
                {ts('sprint2.criteria.filteredCount', { filtered: filtered.length, total: criteres.length }, `${filtered.length} / ${criteres.length}`)}
              </span>
            )}
          </div>

          {/* LISTE */}
          {loadingCrit ? (
            <div style={p.loadBox}>
              <div style={p.spinner}/>
              <span style={{ color: "var(--tx-3)", fontSize: 13, fontWeight: 500 }}>{ts('sprint2.criteria.loading', undefined, 'Chargement des critères...')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={p.emptyBox}>
              <div style={{ fontSize: 64, marginBottom: 20, opacity: 0.7 }}>📭</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--tx-2)", marginBottom: 8 }}>
                {criteres.length === 0
                  ? ts('sprint2.criteria.empty.none',      undefined, 'Aucun critère')
                  : ts('sprint2.criteria.empty.noResults', undefined, 'Aucun résultat')}
              </div>
              <div style={{ fontSize: 14, color: "var(--tx-3)", marginBottom: 28 }}>
                {criteres.length === 0
                  ? ts('sprint2.criteria.empty.hintCreate',  undefined, 'Créez votre premier critère pour commencer.')
                  : ts('sprint2.criteria.empty.hintFilters', undefined, 'Modifiez vos filtres ou réinitialisez-les.')}
              </div>
              {canEdit && criteres.length === 0 && (
                <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                  <button className="action-btn" style={{ ...p.btnSecondary, padding: "12px 24px" }} onClick={() => setShowImport(true)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m-4-4l4 4 4-4" stroke="currentColor"/>
                    </svg>
                    {ts('sprint2.criteria.actions.importPdf', undefined, 'Importer PDF')}
                  </button>
                  <button className="action-btn" style={{ ...p.btnPrimary, padding: "12px 24px" }} onClick={openCreate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" stroke="currentColor"/>
                    </svg>
                    {ts('sprint2.criteria.actions.new', undefined, 'Nouveau critère')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ animation: "fadeUp 0.4s ease" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {paginated.map((c, i) => (
                  <CritereCard
                    key={c.id} c={c} canEdit={canEdit} index={i}
                    canViewHistory={canViewHistory}
                    selected={sel.includes(c.id)} expanded={expandedId === c.id}
                    onSelect={() => toggleOne(c.id)}
                    onExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => { setDeleteMsg(""); setDeleteId(c.id); }}
                    onLightbox={url => setLightbox(resolveCritereImageUrl(url))}
                    onHistorique={() => setShowHistorique({ id: c.id, nom: safeStr(translate(c.nom), c.nom) })}
                    onAutoRegenImage={handleAutoRegenImage}
                    translate={translate}
                    lang={lang}
                  />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE}/>
            </div>
          )}
        </>
      )}

      {/* MODALS (inchangés) */}
      {showImport && (
        <ImportChecklistModal
          processus={processus}
          currentProcessusId={selectedProc?.id || ""}
          lang={lang}
          onImport={(targetProcId, file, pdfName) => {
            const tp = processus.find(proc => String(proc.id) === String(targetProcId));
            if (tp) handleSelectProcessus(tp);
            if (file) {
              const nextUrl = URL.createObjectURL(file);
              const name = pdfName || file.name || "checklist.pdf";
              const entry = { url: nextUrl, name, ts: Date.now() };
              setPreviewList(prev => {
                const next = Array.isArray(prev) ? [...prev, entry] : [entry];
                try { sessionStorage.setItem('ok_preview_pdf_list', JSON.stringify(next)); } catch (e) {}
                return next;
              });
              setPreviewPdfUrl(nextUrl);
              setPreviewPdfName(name);
            }
            setShowImport(false);
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      {modal && (
        <Modal
          title={modal === "create"
            ? ts('sprint2.criteria.modal.createTitle', undefined, 'Nouveau critère')
            : ts('sprint2.criteria.modal.editTitle',   undefined, 'Modifier le critère')}
          onClose={closeModal}
          size="wide"
        >
          <form onSubmit={handleSubmit} style={{ width:"100%", maxWidth:"100%", maxHeight:"85vh", overflowY:"auto", paddingRight:4 }}>
            {/* Identification */}
            <div style={fm.section}>
              <div style={fm.sectionLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="currentColor"/>
                  <circle cx="12" cy="7" r="4" stroke="currentColor"/>
                </svg>
                Identification
              </div>
              <div style={fm.grid2}>
                <div style={fm.field}>
                  <label style={fm.label}>{ts('sprint2.criteria.modal.nameFr', undefined, 'Nom (FR)')} *</label>
                  <textarea style={{...fm.input, minHeight:62, resize:"vertical"}} value={form.nom} required
                    placeholder={ts('sprint2.criteria.modal.nameFrPlaceholder', undefined, 'Nom en français')}
                    onChange={e => setForm({...form, nom:e.target.value})}/>
                </div>
                <div style={fm.field}>
                  <label style={fm.label}>{ts('sprint2.criteria.modal.nameAr', undefined, 'Nom (AR)')}</label>
                  <textarea style={{...fm.input, minHeight:62, resize:"vertical", direction:"rtl"}} value={form.nomAr}
                    placeholder={ts('sprint2.criteria.modal.nameArPlaceholder', undefined, 'الاسم بالعربية')}
                    onChange={e => setForm({...form, nomAr:e.target.value})}/>
                </div>
              </div>
              <div style={fm.grid2}>
                <div style={fm.field}>
                  <label style={fm.label}>{ts('sprint2.criteria.modal.descriptionFr', undefined, 'Description (FR)')}</label>
                  <textarea style={{...fm.input, minHeight:74, resize:"vertical"}} value={form.description}
                    placeholder={ts('sprint2.criteria.modal.descriptionFrPlaceholder', undefined, 'Description en français')}
                    onChange={e => setForm({...form, description:e.target.value})}/>
                </div>
                <div style={fm.field}>
                  <label style={fm.label}>{ts('sprint2.criteria.modal.descriptionAr', undefined, 'Description (AR)')}</label>
                  <textarea style={{...fm.input, minHeight:74, resize:"vertical", direction:"rtl"}} value={form.descriptionAr}
                    placeholder={ts('sprint2.criteria.modal.descriptionArPlaceholder', undefined, 'الوصف بالعربية')}
                    onChange={e => setForm({...form, descriptionAr:e.target.value})}/>
                </div>
              </div>
            </div>

            {/* Classification */}
            <div style={fm.section}>
              <div style={fm.sectionLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor"/>
                </svg>
                Classification
              </div>
              <div style={fm.grid4}>
                {[
                  { key:"type",              label:ts('sprint2.criteria.modal.type',     undefined, 'Type'),     opts:TYPES,    fmt:v => v },
                  { key:"couleur",           label:ts('sprint2.criteria.modal.color',    undefined, 'Couleur'),  opts:COULEURS, fmt:v => v },
                  { key:"moyenVerification", label:ts('sprint2.criteria.modal.method',   undefined, 'Méthode'),  opts:MOYENS,   fmt:v => MC[v]?.label || v },
                  { key:"categorie",         label:ts('sprint2.criteria.modal.category', undefined, 'Catégorie'), opts:["Machine","Méthode","Milieu"], fmt:v => v },
                ].map(({ key, label, opts, fmt }) => (
                  <div key={key} style={fm.field}>
                    <label style={fm.label}>{label}</label>
                    <select style={fm.select} value={form[key]} onChange={e => setForm({...form, [key]:e.target.value})}>
                      {opts.map(o => <option key={o} value={o}>{fmt(o)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={fm.field}>
                <label style={fm.label}>{ts('sprint2.criteria.modal.process', undefined, 'Processus')} *</label>
                <select style={fm.select} value={form.processusId} required onChange={e => setForm({...form, processusId:e.target.value})}>
                  <option value="">{ts('common.select', undefined, 'Sélectionner')}</option>
                  {processus.map(pr => (
                    <option key={pr.id} value={String(pr.id)}>{safeStr(translate(pr.nom), pr.nom)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Image */}
            <div style={fm.section}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, flexWrap:"wrap", gap:8 }}>
                <div style={fm.sectionLabel}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor"/>
                    <circle cx="8.5" cy="8.5" r="2.5" stroke="currentColor"/>
                    <path d="M21 15l-5-4-3 3-4-4-5 6" stroke="currentColor"/>
                  </svg>
                  {ts('sprint2.criteria.modal.referenceImage', undefined, 'Image de référence')}
                  {wikiSource && (
                    <span style={{ marginLeft: 10, fontSize: 10, background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                      🌐 Wikipedia
                    </span>
                  )}
                  {aiSource && (
                    <span style={{ marginLeft: 10, fontSize: 10, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 20, padding: "2px 10px", fontWeight: 700 }}>
                      ✨ IA
                    </span>
                  )}
                  {displayImage && !wikiSource && (
                    <span style={{ marginLeft: 10, fontSize: 10, color: "#059669", fontWeight: 600 }}>
                      ● Image personnalisée
                    </span>
                  )}
                </div>
                {form.nom && !displayImage && (
                  <button
                    type="button"
                    disabled={wikiSearching}
                    onClick={handleWikiSearch}
                    style={{
                      display:"inline-flex", alignItems:"center", gap:8,
                      background: wikiSearching ? "#f1f5f9" : "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
                      color: wikiSearching ? "#94a3b8" : "#15803d",
                      border: "1px solid #bbf7d0",
                      borderRadius: 40,
                      padding:"6px 16px",
                      fontSize:12,
                      fontWeight:600,
                      cursor: wikiSearching ? "not-allowed" : "pointer",
                      transition:"all .2s",
                    }}
                  >
                    {wikiSearching
                      ? <><div style={{ width:12, height:12, border:"2px solid #94a3b8", borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin .7s linear infinite" }}/> Recherche...</>
                      : <>🔍 Trouver image (Wikipedia)</>
                    }
                  </button>
                )}
              </div>

              {modal === "edit" && (
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16, flexWrap:"wrap" }}>
                  <input
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Prompt IA (optionnel) - Ex: 'une machine industrielle moderne'"
                    style={{ ...fm.input, flex:1, minWidth:220 }}
                  />
                  <button
                    type="button"
                    disabled={aiSearching}
                    onClick={handleAiGenerate}
                    style={{
                      display:"inline-flex", alignItems:"center", gap:8,
                      background: aiSearching ? "#f1f5f9" : "linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)",
                      color: aiSearching ? "#94a3b8" : "#4f46e5",
                      border: "1px solid #c7d2fe",
                      borderRadius: 40,
                      padding:"6px 20px",
                      fontSize:12,
                      fontWeight:600,
                      cursor: aiSearching ? "not-allowed" : "pointer",
                      transition:"all .2s",
                      whiteSpace:"nowrap",
                    }}
                  >
                    {aiSearching
                      ? <><div style={{ width:12, height:12, border:"2px solid #94a3b8", borderTop:"2px solid transparent", borderRadius:"50%", animation:"spin .7s linear infinite" }}/> Génération...</>
                      : <>✨ Générer avec IA</>
                    }
                  </button>
                </div>
              )}

              <div
                className="img-zone"
                style={{
                  ...fm.imgZone,
                  borderColor: wikiSource ? "#bbf7d0" : displayImage ? "#6366f1" : "var(--bd-1)",
                  background: wikiSource ? "#f0fdf4" : displayImage ? "linear-gradient(135deg, #fafafe 0%, #f3e8ff 100%)" : "var(--bg-1)",
                }}
                onClick={() => !displayImage && imgInputRef.current?.click()}
              >
                <input ref={imgInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImageChange}/>
                {displayImage ? (
                  <div style={fm.imgPreviewWrap}>
                    <img src={displayImage} alt="preview" style={fm.imgPreview}/>
                    <div style={fm.imgActions}>
                      {!wikiSource && (
                        <button type="button" style={fm.imgBtnChange} onClick={e => { e.stopPropagation(); imgInputRef.current?.click(); }}>✏️ Changer</button>
                      )}
                      {wikiSource && form.nom && (
                        <button type="button" style={{ ...fm.imgBtnChange, background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0" }} onClick={e => { e.stopPropagation(); handleWikiSearch(); }}>🔄 Re-chercher</button>
                      )}
                      <button type="button" style={fm.imgBtnRemove} onClick={e => { e.stopPropagation(); clearImageSelection(); setForm(f => ({...f, image:""})); }}>🗑 Supprimer</button>
                    </div>
                  </div>
                ) : (
                  <div style={fm.imgEmpty}>
                    <div style={fm.imgEmptyIcon}>📷</div>
                    <div style={fm.imgEmptyTitle}>{ts('sprint2.criteria.modal.imageHint', undefined, 'Cliquez pour ajouter une image')}</div>
                    <div style={fm.imgEmptyHint}>{ts('sprint2.criteria.modal.imageFormats', undefined, 'JPG, PNG, WebP — max 5 Mo')}</div>
                  </div>
                )}
              </div>
            </div>

            {msg && <div style={fm.errorBox}><span>⚠️</span> {msg}</div>}

            <div style={{ display:"flex", gap:12, justifyContent:"flex-end", marginTop:24 }}>
              <button type="button" style={p.btnCancel} onClick={closeModal}>{ts('common.cancel', undefined, 'Annuler')}</button>
              <button type="submit" className="action-btn" style={p.btnPrimary}>
                {modal === "create"
                  ? ts('sprint2.criteria.actions.create', undefined, 'Créer')
                  : ts('common.save', undefined, 'Enregistrer')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Modal
          title={ts('sprint2.criteria.delete.title', undefined, 'Supprimer le critère')}
          onClose={() => { setDeleteId(null); setDeleteMsg(""); }}
        >
          <div style={{ textAlign:"center", padding:"20px 0 24px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>🗑️</div>
            <p style={{ color:"var(--tx-2)", lineHeight:1.7, fontSize:14 }}>
              {ts('sprint2.criteria.delete.confirm', undefined, 'Confirmer la suppression ?')}<br/>
              <span style={{ fontSize:12, color:"var(--tx-4)" }}>{ts('sprint2.criteria.delete.warning', undefined, 'Cette action est irréversible.')}</span>
            </p>
            {deleteMsg && (
              <div style={{ ...fm.errorBox, marginTop:16 }}>
                <span>⚠️</span> {deleteMsg}
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button style={p.btnCancel} onClick={() => { setDeleteId(null); setDeleteMsg(""); }} disabled={deleteLoading}>
              {ts('common.cancel', undefined, 'Annuler')}
            </button>
            <button
              className="action-btn"
              style={{...p.btnPrimary, background:"linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", boxShadow:"0 6px 20px #dc262640", opacity: deleteLoading ? 0.7 : 1}}
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "..." : ts('common.delete', undefined, 'Supprimer')}
            </button>
          </div>
        </Modal>
      )}

      {bulkDel && (
        <Modal
          title={ts('sprint2.criteria.bulkDelete.title', undefined, 'Suppression multiple')}
          onClose={() => setBulkDel(false)}
        >
          <div style={{ textAlign:"center", padding:"20px 0 16px" }}>
            <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
            <p style={{ color:"var(--tx-2)", lineHeight:1.7, fontSize:14 }}>
              {ts('sprint2.criteria.bulkDelete.confirm', { count: sel.length }, `Supprimer ${sel.length} critère(s) ?`)}<br/>
              <span style={{ fontSize:12, color:"var(--tx-4)" }}>{ts('sprint2.criteria.bulkDelete.warning', undefined, 'Cette action est irréversible.')}</span>
            </p>
          </div>
          <div style={{ maxHeight:160, overflowY:"auto", background:"var(--bg-2)", padding:"12px 16px", borderRadius:12, marginBottom:20, border:"1px solid var(--bd-1)" }}>
            {criteres.filter(c => sel.includes(c.id)).map(c => (
              <div key={c.id} style={{ padding:"6px 0", borderBottom:"1px solid var(--bd-1)", fontSize:13 }}>
                <strong>{safeStr(translate(c.nom), c.nom)}</strong>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:12, justifyContent:"flex-end" }}>
            <button style={p.btnCancel} onClick={() => setBulkDel(false)}>{ts('common.cancel', undefined, 'Annuler')}</button>
            <button className="action-btn" style={{...p.btnPrimary, background:"linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)", boxShadow:"0 6px 20px #dc262640"}} onClick={handleBulkDelete}>
              {ts('sprint2.criteria.bulkDelete.delete', { count: sel.length }, `Supprimer (${sel.length})`)}
            </button>
          </div>
        </Modal>
      )}

      {lightbox && (
        <div style={p.lightbox} onClick={() => setLightbox(null)}>
          <button style={p.lightboxClose}>✕</button>
          <img src={lightbox} alt={ts('sprint2.criteria.modal.referenceImageAlt', undefined, 'Image de référence')} style={p.lightboxImg} onClick={e => e.stopPropagation()}/>
        </div>
      )}

      {showHistorique && (
        <CritereHistoriqueModal critereId={showHistorique.id} critereNom={showHistorique.nom} onClose={() => setShowHistorique(null)}/>
      )}
    </div>
  );
}

// ── Utilitaire texte ──────────────────────────────────────────────
const displayText = {
  cleanFr: (text = "") => {
    if (!text) return "";
    let out = text
      .replace(/\u00A0/g, " ").replace(/[\u200E\u200F\u202A-\u202E]/g, " ")
      .replace(/\b\d{1,2}\s*[:.)-]+\s*[''`´a-zàâéèêëîïôùûüç\s]{0,8}(?=\s|$)/gi, " ")
      .replace(/\s{2,}/g, " ").replace(/\s*[:;,.-]+\s*$/g, "").trim();
    for (let i = 0; i < 3; i++) {
      const b = out;
      out = out.replace(/([A-Za-z])\s+([àâäéèêëîïôöùûüçœ])\s+([A-Za-z]{2,})/giu,"$1$2$3")
               .replace(/([A-Za-z]{2,})\s+([àâäéèêëîïôöùûüçœ])\s+([A-Za-z]{2,})/giu,"$1$2$3")
               .replace(/\s{2,}/g," ").trim();
      if (out === b) break;
    }
    return out;
  },
  cleanAr: (text = "") => {
    if (!text) return "";
    return text
      .replace(/[\u200E\u200F\u202A-\u202E]/g," ")
      .replace(/\b(Rouge|Jaune|Vert|Visuel|Simulation|En\s*production|VISUEL|SIMULATION)\b/gi," ")
      .replace(/[A-Za-zÀ-ÿ]{2,}/g," ").replace(/\b\d{1,2}\s*[:.)-]\s*/g," ")
      .replace(/^[\s,;:."'`´«»-]+/g,"").replace(/[\s,;:."'`´«»-]+$/g,"")
      .replace(/\s{2,}/g," ").trim();
  }
};

// ── Carte Critère (design amélioré) ─────────────────────────────────
function CritereCard({ c, canEdit, canViewHistory, index, selected, expanded, onSelect, onExpand, onEdit, onDelete, onLightbox, onHistorique, onAutoRegenImage, translate, lang }) {
  const [imageFailed, setImageFailed] = useState(false);
  const tc = TC[c.type] || TC.QUALITE;
  const cc = CC[c.couleur] || CC.Rouge;
  const mc = MC[c.moyenVerification] || MC.VISUEL;
  const imageRef = resolveCritereImageUrl(c.image);
  const hasImage = Boolean(imageRef);
  useEffect(() => { setImageFailed(false); }, [imageRef]);

  const isAr = lang === "ar";
  const baseNom  = c.nom || c.description || "";
  const baseDesc = c.description || c.nom || "";
  const frNom         = displayText.cleanFr(baseNom) || baseNom;
  const frDescription = displayText.cleanFr(baseDesc) || baseDesc;
  const arNom  = displayText.cleanAr(c.nomAr  || (isAr ? safeStr(translate ? translate(baseNom)  : baseNom,  baseNom)  : ""));
  const arDesc = displayText.cleanAr(c.descriptionAr || (isAr ? safeStr(translate ? translate(baseDesc) : baseDesc, baseDesc) : ""));
  const arCompact = arNom || arDesc;
  const displayNom = getCritereNom(c, lang);
  const trimmedNom = displayNom.length > 120 ? displayNom.substring(0, 117) + "…" : displayNom;

  return (
    <div className="crit-card" style={{
      borderRadius: 16,
      borderTop: `1px solid ${selected ? tc.color+"66" : "var(--bd-1)"}`,
      borderRight: `1px solid ${selected ? tc.color+"66" : "var(--bd-1)"}`,
      borderBottom: `1px solid ${selected ? tc.color+"66" : "var(--bd-1)"}`,
      borderLeft: `5px solid ${tc.color}`,
      background: selected ? `linear-gradient(135deg, ${tc.bg} 0%, #ffffff 100%)` : "var(--bg-1)",
      marginBottom: 10,
      overflow: "hidden",
      boxShadow: selected ? `0 4px 16px ${tc.color}28` : "0 2px 8px rgba(0,0,0,0.04)",
      animation: `fadeUp 0.3s ease ${index * 0.03}s both`,
    }}>
      <div style={{ display:"flex", alignItems:"stretch" }}>
        {/* Thumbnail */}
        {hasImage && !imageFailed ? (
          <div
            style={{ width:80, minHeight:80, flexShrink:0, background:"linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)", cursor:"zoom-in", overflow:"hidden", position:"relative", display:"flex", alignItems:"center", justifyContent:"center" }}
            onClick={e => { e.stopPropagation(); onLightbox(imageRef); }}
            title="Voir l'image en grand"
          >
            <img
              src={imageRef} alt="réf."
              className="thumb-img"
              style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", transition:"transform 0.3s ease" }}
              onError={() => { setImageFailed(true); onAutoRegenImage?.(c.id); }}
            />
            <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent, rgba(0,0,0,0.6))", padding:"6px 0 4px", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:10, color:"#fff", fontWeight:700, letterSpacing:"0.5px" }}>🔍 ZOOM</span>
            </div>
          </div>
        ) : (
          <div style={{ width:80, minHeight:80, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
            <CriterionImage criterion={{ id:c.id, description_fr:c.description||c.nom||"", description_ar:c.descriptionAr||c.nomAr||"", category:c.type||"", flag_color:c.couleur||"" }} size={72}/>
          </div>
        )}

        {/* Corps */}
        <div style={{ flex:1, display:"flex", alignItems:"flex-start", gap:12, padding:"14px 18px" }}>
          {canEdit && (
            <div style={{ paddingTop:2, flexShrink:0 }}>
              <input type="checkbox" checked={selected} onChange={onSelect} onClick={e => e.stopPropagation()}
                style={{ accentColor:tc.color, width:16, height:16, cursor:"pointer" }}/>
            </div>
          )}

          <span style={{ flexShrink:0, padding:"4px 12px", borderRadius:40, fontSize:11, fontWeight:700, background:tc.bg, color:tc.color, border:`1.5px solid ${tc.border}`, whiteSpace:"nowrap", letterSpacing:"0.4px" }}>
            {tc.icon} {tc.label}
          </span>

          <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={onExpand}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--tx-1)", lineHeight:1.45, wordBreak:"break-word" }}>
              {trimmedNom}
            </div>
            {arCompact && !expanded && (
              <div style={{ fontSize:11, color:"var(--tx-3)", direction:"rtl", textAlign:"right", lineHeight:1.5, marginTop:6, fontStyle:"italic", borderRight:`3px solid ${tc.color}60`, paddingRight:8 }}>
                {arCompact.substring(0,130)}{arCompact.length > 130 ? "…" : ""}
              </div>
            )}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8, alignItems:"center" }}>
              <span style={{ padding:"3px 10px", borderRadius:40, fontSize:10, fontWeight:600, background:cc.bg, color:cc.color, border:`1px solid ${cc.light}`, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:cc.dot, flexShrink:0 }}/>{c.couleur}
              </span>
              <span style={{ padding:"3px 10px", borderRadius:40, fontSize:10, fontWeight:600, background:mc.bg, color:mc.color, display:"flex", alignItems:"center", gap:4 }}>
                <span>{mc.icon}</span> {mc.label}
              </span>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
            {canEdit && (
              <>
                <button className="icon-btn" style={{ ...ic.btn, padding:"6px 8px" }} title="Modifier" onClick={e => { e.stopPropagation(); onEdit(); }}>✏️</button>
                <button className="icon-btn" style={{ ...ic.btnDanger, padding:"6px 8px" }} title="Supprimer" onClick={e => { e.stopPropagation(); onDelete(); }}>🗑️</button>
              </>
            )}
            {canViewHistory && (
              <button className="icon-btn" style={{ ...ic.btn, padding:"6px 8px" }} title="Historique" onClick={e => { e.stopPropagation(); onHistorique(); }}>🕐</button>
            )}
            <button className="icon-btn" style={{ ...ic.expand, padding:"6px 8px" }} onClick={onExpand}>
              <span style={{ display:"block", transform:expanded ? "rotate(180deg)" : "none", transition:"transform 0.25s" }}>▼</span>
            </button>
          </div>
        </div>
      </div>

      {/* Panneau étendu */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${tc.color}18`,
          background: `${tc.bg}55`,
          padding: "20px 24px",
          maxHeight: 500,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: hasImage ? "1fr 260px" : "1fr",
          gap: 24,
        }}>
          <div>
            {frDescription && (
              <div style={{ marginBottom:16 }}>
                <div style={{ ...det.label, marginBottom:8 }}>📝 Description complète (FR)</div>
                <div style={{ fontSize:13, color:"var(--tx-2)", lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-word", background:"rgba(255,255,255,0.6)", padding:"12px 16px", borderRadius:12 }}>
                  {frDescription}
                </div>
              </div>
            )}
            {(arNom || arDesc) && (
              <div>
                <div style={{ ...det.label, marginBottom:8 }}>📝 الوصف الكامل (AR)</div>
                <div style={{ fontSize:13, color:"var(--tx-2)", direction:"rtl", textAlign:"right", lineHeight:1.7, whiteSpace:"pre-wrap", wordBreak:"break-word", background:"rgba(255,255,255,0.6)", padding:"12px 16px", borderRadius:12, borderRight:`3px solid ${tc.color}` }}>
                  {arNom || arDesc}
                  {arNom && arDesc && arNom !== arDesc && <span style={{ display:"block", marginTop:8, opacity:0.7 }}>{arDesc}</span>}
                </div>
              </div>
            )}
          </div>
          {hasImage && (
            <div>
              <div style={det.label}>🖼 Image de référence</div>
              <div style={det.imgCard} onClick={() => onLightbox(imageRef)}>
                <img src={imageRef} alt="référence" className="detail-img" style={det.img}/>
                <div style={det.caption}>
                  <span style={{ fontSize:12, fontWeight:600 }}>🔍 Cliquer pour agrandir</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
const gsModern = {
  container: {
    padding: "40px 0 20px",
    maxWidth: 1200,
    margin: "0 auto",
  },
  
  // Hero Section
  heroSection: {
    textAlign: "center",
    marginBottom: 60,
    position: "relative",
  },
  heroContent: {
    marginBottom: 32,
  },
  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    background: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
    padding: "6px 16px",
    borderRadius: 40,
    fontSize: 12,
    fontWeight: 600,
    color: "#4f46e5",
    marginBottom: 20,
  },
  heroBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#4f46e5",
    animation: "pulse 2s infinite",
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1.2,
    marginBottom: 16,
    color: "#1f2937",
    letterSpacing: "-0.02em",
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    maxWidth: 500,
    margin: "0 auto",
    lineHeight: 1.5,
  },
  heroStats: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    padding: "16px 24px",
    background: "rgba(255,255,255,0.8)",
    backdropFilter: "blur(10px)",
    borderRadius: 80,
    width: "fit-content",
    margin: "0 auto",
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    border: "1px solid rgba(255,255,255,0.5)",
  },
  statItem: {
    textAlign: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#4f46e5",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    background: "linear-gradient(to bottom, transparent, #e5e7eb, transparent)",
  },

  // Cards Container
  cardsContainer: {
    marginBottom: 48,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: 32,
    maxWidth: 900,
    margin: "0 auto",
  },
  
  // Card Styles
  card: {
    position: "relative",
    background: "#ffffff",
    borderRadius: 28,
    padding: "32px 28px 36px",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
    border: "1px solid rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  cardHover: {
    boxShadow: "0 25px 50px -12px rgba(99,102,241,0.25)",
  },
  cardGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    opacity: 0.08,
    transition: "height 0.4s ease",
  },
  cardGradientAlt: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    background: "linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)",
    opacity: 0.08,
    transition: "height 0.4s ease",
  },
  cardIconWrapper: {
    marginBottom: 24,
    position: "relative",
    zIndex: 2,
  },
  cardIconBg: {
    width: 70,
    height: 70,
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    boxShadow: "0 12px 24px -8px rgba(99,102,241,0.4)",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12,
    color: "#1f2937",
    position: "relative",
    zIndex: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.5,
    marginBottom: 24,
    position: "relative",
    zIndex: 2,
  },
  cardFeatures: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 28,
    position: "relative",
    zIndex: 2,
  },
  featureItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 12,
    color: "#4b5563",
    "& svg": {
      color: "#10b981",
    },
  },
  cardButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    background: "#f3f4f6",
    borderRadius: 40,
    fontSize: 13,
    fontWeight: 600,
    color: "#4f46e5",
    transition: "all 0.2s ease",
    width: "fit-content",
    position: "relative",
    zIndex: 2,
  },
  cardShine: {
    position: "absolute",
    top: 0,
    left: "-100%",
    width: "100%",
    height: "100%",
    background: "linear-gradient(90deg, transparent, rgba(99,102,241,0.1), transparent)",
    transition: "left 0.6s ease",
  },
  cardShineAlt: {
    position: "absolute",
    top: 0,
    left: "-100%",
    width: "100%",
    height: "100%",
    background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.1), transparent)",
    transition: "left 0.6s ease",
  },

  // Info Section
  infoSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: 40,
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 24,
    maxWidth: 1000,
    margin: "0 auto",
  },
  infoItem: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px 16px",
    background: "#f9fafb",
    borderRadius: 16,
    transition: "all 0.2s ease",
  },
  infoIcon: {
    width: 36,
    height: 36,
    background: "white",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#4f46e5",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  infoText: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    "& strong": {
      fontSize: 13,
      fontWeight: 700,
      color: "#1f2937",
    },
    "& span": {
      fontSize: 11,
      color: "#9ca3af",
    },
  },

  // Loading
  loadBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    minHeight: 400,
    background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
    borderRadius: 32,
    margin: "40px auto",
    maxWidth: 500,
  },
  spinner: {
    position: "relative",
    width: 60,
    height: 60,
  },
  spinnerRing: {
    width: 60,
    height: 60,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #4f46e5",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
};

const p = {
  page:          { padding:"0 0 56px", minHeight:"100vh", background:"var(--bg-page, #f8fafc)" },
  header:        { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24, flexWrap:"wrap", gap:16 },
  headerLeft:    { display:"flex", alignItems:"center", gap:16 },
  headerIconWrap:{ width:52, height:52, background:"linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 6px 16px rgba(99,102,241,0.25)", flexShrink:0 },
  title:         { fontSize:26, fontWeight:900, color:"var(--tx-1)", margin:"0 0 6px", letterSpacing:"-0.8px" },
  breadcrumb:    { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" },
  sep:           { color:"var(--tx-4)", fontSize:14, fontWeight:300 },
  count:         { fontSize:13, color:"var(--tx-4)", fontWeight:500, background:"var(--bg-2)", padding:"2px 10px", borderRadius:20 },
  backBtn:       { background:"none", border:"none", color:"var(--l5)", cursor:"pointer", fontWeight:700, fontSize:12, padding:0, fontFamily:"inherit", textDecoration:"underline" },
  actions:       { display:"flex", gap:12, flexWrap:"wrap" },
  btnPrimary:    { background:"linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color:"#fff", border:"none", borderRadius:12, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:13, boxShadow:"0 4px 14px rgba(99,102,241,0.35)", transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" },
  btnSecondary:  { background:"linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)", color:"#7c3aed", border:"1px solid #e9d5ff", borderRadius:12, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:13, transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" },
  btnDanger:     { background:"linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", color:"#dc2626", border:"1px solid #fecaca", borderRadius:12, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:13, transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit" },
  btnCancel:     { background:"var(--bg-2)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"9px 20px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"inherit", transition:"all 0.2s" },
  statsRow:      { display:"flex", gap:12, marginBottom:24, flexWrap:"wrap", alignItems:"center" },
  statChip:      { display:"flex", alignItems:"center", gap:12, padding:"12px 20px", borderRadius:16, border:"1.5px solid", cursor:"pointer", fontFamily:"inherit", minWidth:120, userSelect:"none", transition:"all 0.25s cubic-bezier(0.4,0,0.2,1)" },
  filtersBar:    { display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap", background:"var(--bg-surface, white)", padding:"12px 20px", borderRadius:16, boxShadow:"0 1px 3px rgba(0,0,0,0.05)", border:"1px solid var(--bd-1)" },
  searchWrap:    { position:"relative", flex:1, minWidth:240 },
  searchIcon:    { position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, pointerEvents:"none", color:"var(--tx-4)" },
  searchInput:   { width:"100%", padding:"10px 38px", border:"1.5px solid var(--bd-1)", borderRadius:12, fontSize:13, fontFamily:"inherit", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", boxSizing:"border-box", transition:"all 0.2s" },
  clearX:        { position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"var(--tx-4)", fontSize:12, padding:4, borderRadius:20 },
  checkAll:      { display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"8px 14px", borderRadius:12, background:"var(--bg-2)", border:"1px solid var(--bd-1)", userSelect:"none", transition:"all 0.2s" },
  clearFilters:  { background:"none", border:"none", color:"var(--l5)", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:40, transition:"all 0.2s" },
  loadBox:       { display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:64, background:"var(--bg-surface, white)", borderRadius:20, marginTop:16 },
  spinner:       { width:32, height:32, border:"3px solid var(--bd-1)", borderTop:"3px solid var(--l5)", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  emptyBox:      { textAlign:"center", padding:"64px 20px", background:"var(--bg-surface, white)", borderRadius:20, marginTop:16, border:"1px solid var(--bd-1)" },
  lightbox:      { position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", backdropFilter:"blur(8px)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", cursor:"zoom-out", animation:"fadeIn 0.2s ease" },
  lightboxClose: { position:"absolute", top:24, right:28, background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", fontSize:18, width:44, height:44, borderRadius:"50%", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s" },
  lightboxImg:   { maxWidth:"90vw", maxHeight:"90vh", borderRadius:16, boxShadow:"0 24px 80px rgba(0,0,0,0.5)", cursor:"default" },
};

const ic = {
  btn:       { background:"transparent", border:"none", cursor:"pointer", fontSize:13, padding:"6px 8px", borderRadius:8, color:"var(--tx-3)", transition:"all 0.15s", fontFamily:"inherit" },
  btnDanger: { background:"transparent", border:"none", cursor:"pointer", fontSize:13, padding:"6px 8px", borderRadius:8, color:"#ef4444", transition:"all 0.15s", fontFamily:"inherit" },
  expand:    { background:"transparent", border:"none", cursor:"pointer", fontSize:11, padding:"6px 8px", borderRadius:8, color:"var(--tx-4)", transition:"all 0.15s", fontFamily:"inherit" },
};

const det = {
  label:   { fontSize:11, fontWeight:700, color:"var(--tx-4)", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:6 },
  imgCard: { borderRadius:14, overflow:"hidden", cursor:"zoom-in", border:"1px solid var(--bd-1)", background:"#f8f9fc", boxShadow:"0 4px 12px rgba(0,0,0,0.08)" },
  img:     { width:"100%", aspectRatio:"4/3", objectFit:"cover", display:"block", transition:"transform 0.3s ease" },
  caption: { background:"linear-gradient(transparent, rgba(0,0,0,0.7))", padding:"8px 12px", display:"flex", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:600 },
};

const fm = {
  section:       { marginBottom:20, padding:"20px 22px", background:"var(--bg-2)", borderRadius:16, border:"1px solid var(--bd-1)" },
  sectionLabel:  { fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:"1px", color:"var(--tx-4)", marginBottom:14, display:"flex", alignItems:"center", gap:8 },
  grid2:         { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))", gap:14, marginBottom:0 },
  grid4:         { display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:12, marginBottom:0 },
  field:         { marginBottom:12 },
  label:         { display:"block", marginBottom:6, fontSize:12, fontWeight:700, color:"var(--tx-3)", textTransform:"uppercase", letterSpacing:"0.5px" },
  input:         { width:"100%", padding:"10px 14px", border:"1.5px solid var(--bd-1)", borderRadius:10, fontSize:13, boxSizing:"border-box", fontFamily:"inherit", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", transition:"all 0.2s" },
  select:        { width:"100%", padding:"10px 14px", border:"1.5px solid var(--bd-1)", borderRadius:10, fontSize:13, boxSizing:"border-box", fontFamily:"inherit", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", cursor:"pointer", transition:"all 0.2s" },
  imgZone:       { border:"2px dashed", borderRadius:16, cursor:"pointer", overflow:"hidden", minHeight:140, transition:"all 0.2s", display:"flex", alignItems:"stretch" },
  imgPreviewWrap:{ width:"100%", position:"relative", display:"flex", flexDirection:"column", alignItems:"center" },
  imgPreview:    { maxHeight:220, maxWidth:"100%", objectFit:"contain", display:"block", margin:"16px auto", borderRadius:12 },
  imgActions:    { display:"flex", gap:12, padding:"12px 0 16px", justifyContent:"center" },
  imgBtnChange:  { background:"var(--bg-3)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:12, fontFamily:"inherit", color:"var(--tx-2)", transition:"all 0.2s" },
  imgBtnRemove:  { background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fecaca", borderRadius:10, padding:"8px 18px", fontWeight:700, cursor:"pointer", fontSize:12, fontFamily:"inherit", transition:"all 0.2s" },
  imgEmpty:      { width:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:"32px 24px", color:"var(--tx-4)" },
  imgEmptyIcon:  { fontSize:42, lineHeight:1, transition:"transform 0.2s" },
  imgEmptyTitle: { fontSize:14, fontWeight:600, color:"var(--tx-3)" },
  imgEmptyHint:  { fontSize:12, color:"var(--tx-4)" },
  errorBox:      { background:"linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)", color:"#dc2626", padding:"12px 18px", borderRadius:12, fontSize:13, marginBottom:16, border:"1px solid #fecaca", display:"flex", alignItems:"center", gap:10 },
};