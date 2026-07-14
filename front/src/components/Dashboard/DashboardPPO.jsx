import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  getAllMachines,
  getAllChecklists,
  planActionAPI,
} from '../../api';
import { useAuth } from '../../context/AuthContext';

Chart.register(...registerables);

// ── Design Tokens ──────────────────────────────────────────────────────────
const T = {
  blue:    '#1a73c8',
  teal:    '#00b09b',
  amber:   '#f5a623',
  red:     '#e8354a',
  green:   '#27ae60',
  purple:  '#7c5cbf',

  blue10:  'rgba(26,115,200,0.10)',
  teal10:  'rgba(0,176,155,0.10)',
  amber10: 'rgba(245,166,35,0.10)',
  red10:   'rgba(232,53,74,0.10)',
  green10: 'rgba(39,174,96,0.10)',
  purple10:'rgba(124,92,191,0.10)',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const scoreColor = (v) => v >= 90 ? T.green  : v >= 75 ? T.amber : T.red;
const scoreBg    = (v) => v >= 90 ? T.green10: v >= 75 ? T.amber10: T.red10;
const safeToDateKey = (d) => {
  const date = d instanceof Date ? d : new Date(d);
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};
const buildDateRange = (days) => {
  const end = new Date(); end.setHours(0,0,0,0);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (days - 1 - i));
    return d;
  });
};

// ── Styles globaux injectés ────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap');

  .ppo-root * { box-sizing: border-box; font-family: 'IBM Plex Sans', sans-serif; }

  .ppo-root {
    --bg: #f5f7fb;
    --surface: #ffffff;
    --surface2: #f8fafc;
    --border: rgba(15,23,42,0.08);
    --border2: rgba(15,23,42,0.14);
    --tx: #0f172a;
    --tx2: #334155;
    --tx3: #64748b;
    background: linear-gradient(180deg, #f8fbff 0%, #eef3f9 100%);
    min-height: 100vh;
  }

  .ppo-tab-btn {
    padding: 10px 20px;
    background: transparent;
    border: none;
    border-radius: 8px 8px 0 0;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    color: var(--tx2);
    transition: all 0.18s;
    position: relative;
  }
  .ppo-tab-btn.active {
    color: ${T.blue};
    font-weight: 700;
    background: var(--surface);
  }
  .ppo-tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0; right: 0;
    height: 3px;
    background: ${T.blue};
    border-radius: 2px 2px 0 0;
  }
  .ppo-tab-btn:hover:not(.active) {
    background: rgba(26,115,200,0.07);
    color: ${T.blue};
  }

  .ppo-kpi-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 22px;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .ppo-kpi-card:hover {
    box-shadow: 0 6px 28px rgba(0,0,0,0.10);
    transform: translateY(-2px);
  }
  .ppo-kpi-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
  }

  .ppo-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 22px 24px;
  }

  .ppo-machine-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    transition: box-shadow 0.18s;
  }
  .ppo-machine-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }

  .ppo-cl-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: box-shadow 0.18s;
  }
  .ppo-cl-item:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }

  .ppo-plan-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid ${T.blue};
    border-radius: 12px;
    padding: 16px 18px;
    transition: box-shadow 0.18s;
  }
  .ppo-plan-card:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  }

  .ppo-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .ppo-section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--tx2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 14px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ppo-section-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border2);
  }

  .ppo-search {
    width: 100%;
    padding: 10px 14px 10px 38px;
    border: 1px solid var(--border2);
    border-radius: 10px;
    background: var(--surface2);
    color: var(--tx);
    font-size: 13px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .ppo-search:focus {
    border-color: ${T.blue};
    box-shadow: 0 0 0 3px rgba(26,115,200,0.12);
  }

  .ppo-sparkline {
    width: 80px;
    height: 30px;
  }

  @keyframes ppo-fade-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .ppo-animate {
    animation: ppo-fade-in 0.32s ease forwards;
  }
`;

// ── Inject CSS ─────────────────────────────────────────────────────────────
function useGlobalCSS(css) {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = css;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, [css]);
}

// ── Chart Canvas ───────────────────────────────────────────────────────────
function ChartCanvas({ id, config, height = 220 }) {
  const ref  = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(ref.current, config);
    return () => { if (inst.current) inst.current.destroy(); };
  }, [config]);
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas ref={ref} id={id} role="img" aria-label={id} />
    </div>
  );
}

// ── Sparkline SVG ──────────────────────────────────────────────────────────
function Sparkline({ data = [], color = T.blue }) {
  if (!data || data.length < 2) return null;
  const W = 80, H = 30;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${H} ${polyline} ${W},${H}`;
  return (
    <svg width={W} height={H} className="ppo-sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace('#','')})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color = T.blue, sparkData, sub }) {
  return (
    <div className="ppo-kpi-card" style={{ '--accent': color }}>
      <style>{`.ppo-kpi-card[style*="${color}"]::before { background: ${color}; }`}</style>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: color, borderRadius: '14px 14px 0 0'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--tx2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        <div style={{
          width: 34, height: 34,
          borderRadius: 10,
          background: color + '18',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16
        }}>{icon}</div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--tx)', lineHeight: 1, fontFamily: "'IBM Plex Mono', monospace" }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 6 }}>{sub}</div>
      )}
      {sparkData && (
        <div style={{ marginTop: 10 }}>
          <Sparkline data={sparkData} color={color} />
        </div>
      )}
    </div>
  );
}

// ── Progress Bar ───────────────────────────────────────────────────────────
function ProgressBar({ value, color }) {
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${value}%`, height: '100%',
        background: color,
        borderRadius: 3,
        transition: 'width 0.5s ease'
      }} />
    </div>
  );
}

// ── Machine Card ───────────────────────────────────────────────────────────
function MachineCard({ machine, checklists }) {
  const mCL  = checklists.filter(c => c.machineId === machine.id || c.machineNom === machine.nom);
  const total = mCL.length;
  const ncs   = mCL.reduce((s, c) => s + (c.criteresNok || 0), 0);
  const ok    = mCL.reduce((s, c) => s + (c.criteresOk  || 0), 0);
  const tot   = mCL.reduce((s, c) => s + (c.criteresTotal || 0), 0);
  const rate  = tot > 0 ? Math.round((ok / tot) * 100) : 0;
  const color = scoreColor(rate);
  const bg    = scoreBg(rate);

  return (
    <div className="ppo-machine-card">
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0
      }}>⚙️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, color: 'var(--tx)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {machine.nom || machine.code || '-'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2, marginBottom: 6 }}>
          {total} checklist{total !== 1 ? 's' : ''} · {ncs} NC
        </div>
        <ProgressBar value={rate} color={color} />
      </div>
      <div style={{
        fontSize: 15, fontWeight: 800, color,
        fontFamily: "'IBM Plex Mono', monospace",
        minWidth: 44, textAlign: 'right'
      }}>
        {rate}%
      </div>
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
const STATUS_CFG = {
  BROUILLON:    { label: 'Brouillon',  bg: '#e5e7eb', tx: '#374151' },
  SOUMIS:       { label: 'Soumis',     bg: T.blue10,  tx: T.blue   },
  VALIDE_N1:    { label: 'Val. N1',    bg: T.amber10, tx: T.amber  },
  VALIDE_N2:    { label: 'Val. N2',    bg: T.teal10,  tx: T.teal   },
  VALIDE_FINAL: { label: 'Validé',     bg: T.green10, tx: T.green  },
  REJETE:       { label: 'Rejeté',     bg: T.red10,   tx: T.red    },
};

function StatusBadge({ statut }) {
  const s = STATUS_CFG[statut] || { label: statut, bg: '#e5e7eb', tx: '#374151' };
  return (
    <span className="ppo-badge" style={{ background: s.bg, color: s.tx }}>
      {s.label}
    </span>
  );
}

// ── Checklist Item ─────────────────────────────────────────────────────────
function ChecklistItem({ checklistId, machineNom, dateCreation, statut, conformite }) {
  const color = scoreColor(conformite);
  return (
    <div className="ppo-cl-item">
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--tx)', fontFamily: "'IBM Plex Mono', monospace" }}>
            #{String(checklistId).padStart(4,'0')}
          </span>
          <StatusBadge statut={statut} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>
          {machineNom} · {new Date(dateCreation).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
        </div>
      </div>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: color + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color,
        fontFamily: "'IBM Plex Mono', monospace",
        flexShrink: 0, marginLeft: 12
      }}>
        {conformite}%
      </div>
    </div>
  );
}

// ── Action Plan Card ───────────────────────────────────────────────────────
const PRIORITE_CFG = {
  HAUTE:   { bg: T.red10,   tx: T.red,   icon: '🔴' },
  MOYENNE: { bg: T.amber10, tx: T.amber, icon: '🟡' },
  BASSE:   { bg: T.green10, tx: T.green, icon: '🟢' },
};
const STATUT_PLAN_CFG = {
  OUVERT:   { bg: T.blue10,   tx: T.blue   },
  EN_COURS: { bg: T.amber10,  tx: T.amber  },
  FERME:    { bg: T.green10,  tx: T.green  },
};

function ActionPlanCard({ titre, statut, dateEcheance, priorite }) {
  const p = PRIORITE_CFG[priorite]  || { bg: '#e5e7eb', tx:'#374151', icon:'⚪' };
  const s = STATUT_PLAN_CFG[statut] || { bg: '#e5e7eb', tx:'#374151' };
  const daysLeft = dateEcheance
    ? Math.ceil((new Date(dateEcheance) - new Date()) / 86400000)
    : null;
  const deadlineColor = daysLeft === null ? 'var(--tx3)' : daysLeft > 7 ? T.green : daysLeft > 0 ? T.amber : T.red;
  const borderColor = daysLeft !== null && daysLeft <= 0 ? T.red : daysLeft !== null && daysLeft <= 7 ? T.amber : T.blue;

  return (
    <div className="ppo-plan-card" style={{ borderLeftColor: borderColor }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx)', marginBottom: 8, lineHeight: 1.4 }}>
            {titre}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="ppo-badge" style={{ background: s.bg, color: s.tx }}>{statut}</span>
            <span className="ppo-badge" style={{ background: p.bg, color: p.tx }}>{p.icon} {priorite}</span>
          </div>
        </div>
      </div>
      {daysLeft !== null && (
        <div style={{
          marginTop: 12, paddingTop: 10,
          borderTop: '1px solid var(--border)',
          fontSize: 11, color: deadlineColor, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 5
        }}>
          {daysLeft > 0 ? `⏱ ${daysLeft}j restants` : `⚠ En retard de ${Math.abs(daysLeft)}j`}
          {dateEcheance && (
            <span style={{ fontWeight: 400, color: 'var(--tx3)', marginLeft: 4 }}>
              · {new Date(dateEcheance).toLocaleDateString('fr-FR')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
function DashHeader({ user }) {
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0d2950 0%, #1a4a8a 60%, #1e5aa8 100%)',
      borderRadius: 18, padding: '28px 32px',
      marginBottom: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Déco */}
      <div style={{
        position: 'absolute', right: -40, top: -40,
        width: 200, height: 200, borderRadius: '50%',
        background: 'rgba(255,255,255,0.04)'
      }} />
      <div style={{
        position: 'absolute', right: 60, bottom: -30,
        width: 120, height: 120, borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            OK Démarrage · LEONI
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#ffffff',
            margin: 0, lineHeight: 1.2
          }}>
            {greeting}{user?.prenom ? `, ${user.prenom}` : ''} 👋
          </h1>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>
            {now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.10)',
          borderRadius: 14, padding: '14px 20px', textAlign: 'right',
          border: '1px solid rgba(255,255,255,0.12)'
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Tableau de bord
          </div>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>Production</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Temps réel</div>
        </div>
      </div>
    </div>
  );
}

// ── Donut mini ─────────────────────────────────────────────────────────────
function DonutMini({ value, color, size = 56 }) {
  const r = 20, cx = size/2, cy = size/2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={cx} y={cy+4} textAnchor="middle" fontSize="10" fontWeight="700"
        fill={color} fontFamily="'IBM Plex Mono', monospace">
        {value}%
      </text>
    </svg>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPPO() {
  useGlobalCSS(GLOBAL_CSS);
  const { user } = useAuth();
  const [machines, setMachines]          = useState([]);
  const [allChecklists, setAllChecklists] = useState([]);
  const [actionPlans, setActionPlans]    = useState([]);
  const [loading, setLoading]            = useState(true);
  const [activeTab, setActiveTab]        = useState('overview');
  const [machineFilter, setMachineFilter] = useState('');
  const [filterYear, setFilterYear]      = useState(null);
  const [exporting, setExporting]        = useState(false);
  const dashboardRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, cl, ap] = await Promise.all([
        getAllMachines().then(x => x.data).catch(() => []),
        getAllChecklists().then(x => x.data).catch(() => []),
        planActionAPI.findAll().then(x => x.data).catch(() => []),
      ]);
      setMachines(Array.isArray(m) ? m : []);
      setAllChecklists(Array.isArray(cl) ? cl.sort((a,b) => new Date(b.dateCreation)-new Date(a.dateCreation)) : []);
      setActionPlans(Array.isArray(ap) ? ap : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Available years */
  const availableYears = React.useMemo(() => {
    const years = new Set();
    allChecklists.forEach(c => {
      const d = new Date(c.dateCreation || c.date);
      if (!isNaN(d)) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allChecklists]);

  /* Apply year filter */
  const visibleChecklists = React.useMemo(() => {
    if (filterYear === null) return allChecklists;
    return allChecklists.filter(c => {
      const d = new Date(c.dateCreation || c.date);
      return !isNaN(d) && d.getFullYear() === filterYear;
    });
  }, [allChecklists, filterYear]);

  /* Export PDF */
  const handleExportPDF = useCallback(() => {
    setExporting(true);
    const style = document.createElement('style');
    style.id = 'ppo-print-style';
    style.textContent = `@media print {
      body * { visibility: hidden; }
      #ppo-dashboard-print, #ppo-dashboard-print * { visibility: visible; }
      #ppo-dashboard-print { position: absolute; left: 0; top: 0; width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 12mm; size: A4 landscape; }
    }`;
    document.head.appendChild(style);
    if (dashboardRef.current) dashboardRef.current.id = 'ppo-dashboard-print';
    setTimeout(() => {
      window.print();
      document.head.removeChild(style);
      if (dashboardRef.current) dashboardRef.current.removeAttribute('id');
      setExporting(false);
    }, 300);
  }, []);
  const totalChecklists     = visibleChecklists.length;
  const checklistsValidated = visibleChecklists.filter(c => c.statut?.includes('VALIDE')).length;
  const checklistsRejected  = visibleChecklists.filter(c => c.statut === 'REJETE').length;
  const avgConformity = totalChecklists > 0
    ? Math.round(visibleChecklists.reduce((s, c) => {
        const ok = c.criteresOk || 0, tot = c.criteresTotal || 1;
        return s + (ok / tot) * 100;
      }, 0) / totalChecklists)
    : 0;
  const openPlans    = actionPlans.filter(p => p.statut === 'OUVERT').length;
  const overduePlans = actionPlans.filter(p => p.dateEcheance && new Date(p.dateEcheance) < new Date() && p.statut !== 'FERME').length;

  // ── Trend ─────────────────────────────────────────────────────────────
  const trendDays = filterYear !== null ? 12 : 14;
  const dateRange = filterYear !== null
    ? Array.from({ length: 12 }, (_, i) => new Date(filterYear, i, 1))
    : buildDateRange(14);
  const conformByDate = {};
  dateRange.forEach(d => { const k = filterYear !== null ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : safeToDateKey(d); if(k) conformByDate[k] = { sum:0, count:0 }; });
  visibleChecklists.forEach(cl => {
    const d = new Date(cl.dateCreation || cl.date);
    const key = filterYear !== null
      ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      : safeToDateKey(cl.dateCreation || cl.date);
    if (key && Object.prototype.hasOwnProperty.call(conformByDate, key)) {
      const ok = cl.criteresOk || 0, tot = cl.criteresTotal || 1;
      conformByDate[key].sum   += (ok/tot)*100;
      conformByDate[key].count += 1;
    }
  });
  const trendData = dateRange.map(d => {
    const k = filterYear !== null ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : safeToDateKey(d);
    const entry = k ? conformByDate[k] : null;
    return entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : null;
  });
  const trendLabels = filterYear !== null
    ? dateRange.map(d => d.toLocaleDateString('fr-FR', { month: 'short' }))
    : dateRange.map(d => d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' }));

  const trendChartConfig = {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'Conformité %',
        data: trendData,
        borderColor: T.teal,
        backgroundColor: 'rgba(0,176,155,0.08)',
        borderWidth: 2.5,
        tension: 0.42,
        fill: true,
        pointRadius: trendData.map(v => v !== null ? 4 : 0),
        pointBackgroundColor: T.teal,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        spanGaps: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1a2038', titleColor: '#fff', bodyColor: '#94a3b8',
        padding: 10, cornerRadius: 8,
        callbacks: { label: ctx => ` ${ctx.parsed.y ?? 0}% conformité` }
      }},
      scales: {
        y: { beginAtZero: true, max: 100,
          ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => v + '%' },
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false } },
        x: { ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 30 },
          grid: { display: false } },
      }
    }
  };

  // ── Statut doughnut ───────────────────────────────────────────────────────
  const statusCounts = visibleChecklists.reduce((acc, cl) => {
    const s = cl.statut || 'BROUILLON';
    acc[s] = (acc[s] || 0) + 1; return acc;
  }, {});
  const statusColors = { BROUILLON:'#9ca3af', SOUMIS:T.blue, VALIDE_N1:T.amber, VALIDE_N2:T.teal, VALIDE_FINAL:T.green, REJETE:T.red };
  const statusLabels = { BROUILLON:'Brouillon', SOUMIS:'Soumis', VALIDE_N1:'Validé N1', VALIDE_N2:'Validé N2', VALIDE_FINAL:'Validé Final', REJETE:'Rejeté' };

  const doughnutConfig = {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts).map(s => statusLabels[s] || s),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: Object.keys(statusCounts).map(s => statusColors[s] || '#999'),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a2038', titleColor: '#fff', bodyColor: '#94a3b8',
          padding: 10, cornerRadius: 8
        }
      }
    }
  };

  // ── Machines bar chart ─────────────────────────────────────────────────────
  const topMachines = machines
    .map(m => {
      const mCL = visibleChecklists.filter(c => c.machineId === m.id || c.machineNom === m.nom);
      const ok  = mCL.reduce((s, c) => s + (c.criteresOk||0), 0);
      const tot = mCL.reduce((s, c) => s + (c.criteresTotal||0), 0);
      return { nom: m.nom || m.code || '-', rate: tot > 0 ? Math.round((ok/tot)*100) : 0 };
    })
    .sort((a,b) => b.rate - a.rate)
    .slice(0, 8);

  const barConfig = {
    type: 'bar',
    data: {
      labels: topMachines.map(m => m.nom.length > 14 ? m.nom.slice(0,13)+'…' : m.nom),
      datasets: [{
        label: 'Conformité %',
        data: topMachines.map(m => m.rate),
        backgroundColor: topMachines.map(m =>
          m.rate >= 90 ? T.green + 'cc' : m.rate >= 75 ? T.amber + 'cc' : T.red + 'cc'
        ),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#1a2038', titleColor: '#fff', bodyColor: '#94a3b8',
        padding: 10, cornerRadius: 8
      }},
      scales: {
        x: { beginAtZero: true, max: 100,
          ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => v + '%' },
          grid: { color: 'rgba(0,0,0,0.05)' } },
        y: { ticks: { color: '#9ca3af', font: { size: 11 } }, grid: { display: false } },
      }
    }
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredMachines = machines.filter(m =>
    !machineFilter || (m.nom || m.code || '').toLowerCase().includes(machineFilter.toLowerCase())
  );
  const recentChecklists = visibleChecklists.slice(0, 8);
  const upcomingPlans = actionPlans
    .filter(p => p.dateEcheance)
    .sort((a,b) => new Date(a.dateEcheance)-new Date(b.dateEcheance))
    .slice(0, 8);

  const TABS = [
    { id: 'overview',   label: '📊 Vue d\'ensemble' },
    { id: 'machines',   label: '⚙️ Machines' },
    { id: 'checklists', label: '📋 Checklists' },
    { id: 'plans',      label: '📌 Plans d\'action' },
  ];

  if (loading) {
    return (
      <div className="ppo-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 42, height: 42, borderRadius: '50%',
            border: `3px solid ${T.blue}`,
            borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ color: 'var(--tx2)', fontSize: 14 }}>Chargement des données…</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dashboardRef} className="ppo-root" style={{ padding: '24px 28px' }}>
      {/* Header */}
      <DashHeader user={user} />

      {/* Year filter + PDF export bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        marginBottom: 20,
        padding: '12px 18px',
        background: 'var(--surface)',
        borderRadius: 12,
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Période :
        </span>
        <select
          value={filterYear !== null ? `year:${filterYear}` : 'all'}
          onChange={e => {
            const v = e.target.value;
            setFilterYear(v.startsWith('year:') ? Number(v.replace('year:', '')) : null);
          }}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
            background: 'var(--surface2)',
            color: 'var(--tx)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <option value="all">Toutes les années</option>
          {availableYears.map(y => <option key={y} value={`year:${y}`}>Année {y}</option>)}
        </select>
        {filterYear !== null && (
          <span style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 20,
            background: T.blue + '18', color: T.blue, fontWeight: 600,
          }}>
            Filtré : {filterYear}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={load}
            style={{
              border: `1px solid var(--border)`,
              borderRadius: 8, padding: '7px 16px', fontSize: 13,
              background: 'transparent', color: 'var(--tx2)',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            ↺ Actualiser
          </button>
          <button
            className="no-print"
            onClick={handleExportPDF}
            disabled={exporting}
            style={{
              border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13,
              background: exporting ? T.red + 'aa' : T.red, color: '#fff',
              cursor: exporting ? 'wait' : 'pointer', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {exporting ? '⏳ Export…' : '⬇ Exporter PDF'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 24
      }}>
        <KpiCard
          label="Checklists totales"
          value={totalChecklists}
          icon="📋"
          color={T.blue}
          sub={`${checklistsValidated} validées`}
        />
        <KpiCard
          label="Conformité moy."
          value={`${avgConformity}%`}
          icon="✓"
          color={scoreColor(avgConformity)}
          sub={<DonutMini value={avgConformity} color={scoreColor(avgConformity)} />}
        />
        <KpiCard
          label="Validées"
          value={checklistsValidated}
          icon="✅"
          color={T.green}
          sub={totalChecklists > 0 ? `${Math.round((checklistsValidated/totalChecklists)*100)}% du total` : '–'}
        />
        <KpiCard
          label="Plans ouverts"
          value={openPlans}
          icon="📌"
          color={T.amber}
          sub={overduePlans > 0 ? `⚠ ${overduePlans} en retard` : 'Aucun retard'}
        />
        <KpiCard
          label="Rejetées"
          value={checklistsRejected}
          icon="❌"
          color={T.red}
          sub={totalChecklists > 0 ? `${Math.round((checklistsRejected/totalChecklists)*100)}% du total` : '–'}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '14px 14px 0 0',
        border: '1px solid var(--border)',
        borderBottom: '2px solid var(--border)',
        display: 'flex', gap: 4, padding: '8px 12px 0'
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`ppo-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 14px 14px',
        padding: '24px',
        marginBottom: 24,
      }} className="ppo-animate">

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
            {/* Tendance conformité */}
            <div>
              <p className="ppo-section-title">Tendance conformité — 14 jours</p>
              <ChartCanvas id="trend-conform" config={trendChartConfig} height={230} />
            </div>
            {/* Distribution statuts */}
            <div>
              <p className="ppo-section-title">Distribution des statuts</p>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: '0 0 180px', height: 180 }}>
                  <ChartCanvas id="status-dist" config={doughnutConfig} height={180} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(statusCounts).map(([s, count]) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: statusColors[s] || '#999', flexShrink: 0 }} />
                      <span style={{ color: 'var(--tx2)', flex: 1 }}>{statusLabels[s] || s}</span>
                      <span style={{ fontWeight: 700, color: 'var(--tx)', fontFamily: "'IBM Plex Mono', monospace" }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Top machines */}
            {topMachines.length > 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <p className="ppo-section-title">Top machines — conformité</p>
                <ChartCanvas id="machines-bar" config={barConfig} height={Math.max(180, topMachines.length * 38)} />
              </div>
            )}
          </div>
        )}

        {/* ── Machines ──────────────────────────────────────────────────────── */}
        {activeTab === 'machines' && (
          <div>
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--tx3)', fontSize: 15, pointerEvents: 'none'
              }}>🔍</span>
              <input
                className="ppo-search"
                type="text"
                placeholder="Filtrer par machine..."
                value={machineFilter}
                onChange={e => setMachineFilter(e.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {filteredMachines.length > 0
                ? filteredMachines.map(m => (
                    <MachineCard key={m.id} machine={m} checklists={allChecklists} />
                  ))
                : <div style={{ gridColumn:'1/-1', padding:32, textAlign:'center', color:'var(--tx3)' }}>
                    Aucune machine trouvée
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── Checklists ───────────────────────────────────────────────────── */}
        {activeTab === 'checklists' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p className="ppo-section-title" style={{ margin: 0, flex: 1 }}>
                Checklists récentes ({recentChecklists.length})
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
              {recentChecklists.length > 0
                ? recentChecklists.map(cl => (
                    <ChecklistItem
                      key={cl.id}
                      checklistId={cl.id}
                      machineNom={cl.machineNom || '–'}
                      dateCreation={cl.dateCreation}
                      statut={cl.statut}
                      conformite={cl.criteresTotal > 0 ? Math.round((cl.criteresOk / cl.criteresTotal) * 100) : 0}
                    />
                  ))
                : <div style={{ gridColumn:'1/-1', padding:32, textAlign:'center', color:'var(--tx3)' }}>
                    Aucune checklist
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── Plans d'action ────────────────────────────────────────────────── */}
        {activeTab === 'plans' && (
          <div>
            {overduePlans > 0 && (
              <div style={{
                background: T.red10, border: `1px solid ${T.red}40`,
                borderRadius: 10, padding: '10px 16px', marginBottom: 16,
                fontSize: 13, color: T.red, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                ⚠️ {overduePlans} plan{overduePlans > 1 ? 's' : ''} en retard nécessite{overduePlans > 1 ? 'nt' : ''} votre attention
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {upcomingPlans.length > 0
                ? upcomingPlans.map(ap => (
                    <ActionPlanCard
                      key={ap.id}
                      titre={ap.titre || ap.description || 'N/A'}
                      statut={ap.statut}
                      dateEcheance={ap.dateEcheance}
                      priorite={ap.priorite}
                    />
                  ))
                : <div style={{ gridColumn:'1/-1', padding:32, textAlign:'center', color:'var(--tx3)' }}>
                    Aucun plan d'action
                  </div>
              }
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--tx3)', paddingBottom: 8 }}>
        OK Démarrage · LEONI · Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')}
      </div>
    </div>
  );
}