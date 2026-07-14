import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import {
  getDashboardStats,
  getDashboardProcessus,
  getDashboardRecentLists,
  getDashboardOperatorPerformance,
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';

Chart.register(...registerables);

// ── Helpers ────────────────────────────────────────────────────────────────
const scoreColor = (v) => (v >= 90 ? '#10b981' : v >= 75 ? '#f59e0b' : '#ef4444');
const scoreBg   = (v) => (v >= 90 ? 'rgba(16,185,129,0.1)' : v >= 75 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)');

// LTPM Flag colors based on checklist status
const getLtpmColor = (cl) => {
  if (cl.statut === 'VALIDE_FINAL' && cl.criteresNok === 0) return '#16a34a'; // VERT
  if (cl.statut === 'REJETE' || cl.criteresNok > 0) return '#dc2626'; // ROUGE
  return '#ca8a04'; // JAUNE (SOUMIS, VALIDE_N1, VALIDE_N2)
};

const getInitials = (n) => {
  if (!n) return '??';
  const p = n.trim().split(' ');
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.substring(0, 2)).toUpperCase();
};
const toDateKey = (d) => d.toISOString().slice(0, 10);
const buildDateRange = (days) => {
  const end = new Date(); end.setHours(0,0,0,0);
  return Array.from({ length: days }, (_, i) => { const d = new Date(end); d.setDate(end.getDate() - (days - 1 - i)); return d; });
};

// ── Sub-components ─────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, trend, trendUp, color = '#3b82f6' }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 16,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'all 0.2s ease',
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}
    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${color}10`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24
        }}>
          {icon}
        </div>
        {trend && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 4,
            padding: '4px 8px',
            borderRadius: 20,
            background: trendUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'
          }}>
            <span style={{ fontSize: 12, color: trendUp ? '#10b981' : '#ef4444' }}>
              {trendUp ? '▲' : '▼'} {trend}
            </span>
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
          {value}
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
    </div>
  );
}

function ChartCanvas({ id, config, height = 220 }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, config);
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [config]);
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <canvas ref={canvasRef} id={id} role="img" aria-label={id} />
    </div>
  );
}

function StatusBadge({ statut }) {
  const map = {
    VALIDE_FINAL: { label: 'Validé', bg: '#10b981', color: '#fff', icon: '✓' },
    VALIDE_N2:    { label: 'Validé N2', bg: '#3b82f6', color: '#fff', icon: '◉' },
    VALIDE_N1:    { label: 'Validé N1', bg: '#f59e0b', color: '#fff', icon: '○' },
    SOUMIS:       { label: 'Soumis', bg: '#6b7280', color: '#fff', icon: '📤' },
    REJETE:       { label: 'Rejeté', bg: '#ef4444', color: '#fff', icon: '✗' },
    BROUILLON:    { label: 'Brouillon', bg: '#9ca3af', color: '#fff', icon: '✎' },
  };
  const s = map[statut] || { label: statut, bg: '#6b7280', color: '#fff', icon: '•' };
  return (
    <span style={{ 
      background: s.bg, 
      color: s.color, 
      borderRadius: 20, 
      padding: '4px 12px', 
      fontSize: 11, 
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
    }}>
      <span style={{ fontSize: 12 }}>{s.icon}</span>
      {s.label}
    </span>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardChefLigne() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats]               = useState(null);
  const [processusCounts, setProcessusCounts] = useState([]);
  const [recentCL, setRecentCL]         = useState([]);
  const [opPerf, setOpPerf]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [rangeDays, setRangeDays]       = useState(30);
  const [filterYear, setFilterYear]     = useState(null);
  const [exporting, setExporting]       = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const dashboardRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, r, op] = await Promise.all([
        getDashboardStats().then(x => x.data).catch(() => null),
        getDashboardProcessus().then(x => x.data).catch(() => []),
        getDashboardRecentLists(50).then(x => x.data).catch(() => []),
        getDashboardOperatorPerformance(rangeDays).then(x => x.data).catch(() => []),
      ]);
      setStats(s);
      setProcessusCounts(Array.isArray(p) ? p : []);
      setRecentCL(Array.isArray(r) ? r : []);
      setOpPerf(Array.isArray(op) ? op : []);
    } finally { setLoading(false); }
  }, [rangeDays]);

  useEffect(() => { load(); }, [load]);

  /* Available years */
  const availableYears = React.useMemo(() => {
    const years = new Set();
    recentCL.forEach(c => {
      const d = new Date(c.dateControle || c.dateCreation || c.date);
      if (!isNaN(d)) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [recentCL]);

  /* Apply year filter on top of rangeDays */
  const filteredCL = React.useMemo(() => {
    if (filterYear !== null) {
      return recentCL.filter(c => {
        const d = new Date(c.dateControle || c.dateCreation || c.date);
        return !isNaN(d) && d.getFullYear() === filterYear;
      });
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    return recentCL.filter(c => {
      const d = new Date(c.dateControle || c.dateCreation || c.date);
      return !isNaN(d) && d >= cutoff;
    });
  }, [recentCL, rangeDays, filterYear]);

  /* Export PDF */
  const handleExportPDF = useCallback(() => {
    setExporting(true);
    const style = document.createElement('style');
    style.id = 'cl-print-style';
    style.textContent = `@media print {
      body * { visibility: hidden; }
      #cl-dashboard-print, #cl-dashboard-print * { visibility: visible; }
      #cl-dashboard-print { position: absolute; left: 0; top: 0; width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 12mm; size: A4 landscape; }
    }`;
    document.head.appendChild(style);
    if (dashboardRef.current) dashboardRef.current.id = 'cl-dashboard-print';
    setTimeout(() => {
      window.print();
      document.head.removeChild(style);
      if (dashboardRef.current) dashboardRef.current.removeAttribute('id');
      setExporting(false);
    }, 300);
  }, []);

  const totalCL   = filteredCL.length;
  const validees  = filteredCL.filter(c => c.statut === 'VALIDE_FINAL').length;
  const rejetes   = filteredCL.filter(c => c.statut === 'REJETE').length;
  const enCours   = filteredCL.filter(c => ['SOUMIS','VALIDE_N1','VALIDE_N2'].includes(c.statut)).length;
  const tauxConf  = stats?.tauxConformite ?? (totalCL > 0 ? Math.round((validees / totalCL) * 100) : 0);
  const totalNC   = stats?.nonConformites ?? rejetes;
  const alertRate = totalCL > 0 ? ((rejetes / totalCL) * 100).toFixed(1) : '0.0';

  const ncTrendConfig = React.useMemo(() => {
    const days = filterYear !== null
      ? Array.from({ length: 12 }, (_, i) => new Date(filterYear, i, 1))
      : buildDateRange(rangeDays);
    const labels = filterYear !== null
      ? days.map(d => d.toLocaleDateString('fr-FR', { month: 'short' }))
      : days.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const ncPerDay = days.map(d => {
      const key = filterYear !== null ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : toDateKey(d);
      return filteredCL
        .filter(c => {
          const cd = new Date(c.dateControle || c.dateCreation);
          const ckey = filterYear !== null
            ? `${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}`
            : toDateKey(cd);
          return ckey === key && (c.criteresNok > 0);
        })
        .reduce((s, c) => s + (c.criteresNok || 0), 0);
    });
    const confPerDay = days.map(d => {
      const key = filterYear !== null ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` : toDateKey(d);
      const day = filteredCL.filter(c => {
        const cd = new Date(c.dateControle || c.dateCreation);
        const ckey = filterYear !== null
          ? `${cd.getFullYear()}-${String(cd.getMonth()+1).padStart(2,'0')}`
          : toDateKey(cd);
        return ckey === key;
      });
      if (!day.length) return null;
      const ok  = day.reduce((a, c) => a + (c.criteresOk || 0), 0);
      const tot = day.reduce((a, c) => a + (c.criteresTotal || 1), 0);
      return tot > 0 ? Math.round((ok / tot) * 100) : null;
    });
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { 
            label: 'NC', 
            data: ncPerDay, 
            backgroundColor: 'rgba(239,68,68,0.7)', 
            borderRadius: 8, 
            yAxisID: 'y', 
            order: 2 
          },
          { 
            label: 'Conformité %', 
            data: confPerDay, 
            type: 'line', 
            borderColor: '#10b981', 
            backgroundColor: 'transparent', 
            borderWidth: 3, 
            pointRadius: 4,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.35, 
            yAxisID: 'y2', 
            order: 1, 
            spanGaps: true 
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { 
          legend: { display: false }, 
          tooltip: { 
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8,
            bodyFont: { size: 11 }, 
            titleFont: { size: 11 } 
          } 
        },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false } },
          y: { position: 'left', ticks: { font: { size: 10 }, color: '#64748b' }, grid: { color: '#e2e8f0' }, title: { display: true, text: 'NC', font: { size: 10, weight: 'bold' } } },
          y2: { position: 'right', min: 0, max: 100, ticks: { font: { size: 10 }, color: '#64748b', callback: v => `${v}%` }, grid: { display: false }, title: { display: true, text: 'Conformité', font: { size: 10, weight: 'bold' } } },
        },
      },
    };
  }, [filteredCL, rangeDays, filterYear]);

  const processusConfig = React.useMemo(() => {
    const data = processusCounts.slice(0, 8);
    const labels = data.map(p => p.processusNom || '-');
    const rates  = data.map(p => p.tauxConformite ?? 0);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{ 
          label: 'Conformité %', 
          data: rates, 
          backgroundColor: rates.map(scoreBg), 
          borderColor: rates.map(scoreColor), 
          borderWidth: 2, 
          borderRadius: 8,
          borderSkipped: false 
        }],
      },
      options: {
        indexAxis: 'y', 
        responsive: true, 
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false }, 
          tooltip: { 
            callbacks: { label: ctx => `${ctx.raw}%` },
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8
          } 
        },
        scales: {
          x: { min: 0, max: 100, ticks: { callback: v => `${v}%`, font: { size: 10 }, color: '#64748b' }, grid: { color: '#e2e8f0' } },
          y: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false } },
        },
      },
    };
  }, [processusCounts]);

  const topNC = React.useMemo(() => {
    const counts = {};
    filteredCL.forEach(cl => (cl.reponses || []).forEach(r => {
      if (r.valeur === 'ROUGE') { const k = r.critereNom || `Critère ${r.critereId}`; counts[k] = (counts[k] || 0) + 1; }
    }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [filteredCL]);

  const maxNC = topNC[0]?.[1] || 1;
  const derniersCL = filteredCL.slice(0, 8);

  const SECTIONS = [
    { key: 'overview', label: t('dashboardChefLigne.nav.overview', {}, '📊 Vue globale') },
    { key: 'processus', label: t('dashboardChefLigne.nav.processus', {}, '🏭 Processus') },
    { key: 'nc', label: t('dashboardChefLigne.nav.nc', {}, '⚠️ Non-conformités') },
    { key: 'checklists', label: t('dashboardChefLigne.nav.checklists', {}, '📋 Checklists') },
    { key: 'operators', label: t('dashboardChefLigne.nav.operators', {}, '👥 Opérateurs') },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 16, background: '#f8fafc' }}>
        <div style={{ width: 50, height: 50, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardChefLigne.loading', {}, 'Chargement du tableau de bord...')}</p>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  const css = `
    .cl-root {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .cl-grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .cl-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .cl-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .cl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cl-table th { 
      padding: 12px 16px; 
      text-align: left; 
      font-weight: 600; 
      font-size: 11px; 
      text-transform: uppercase; 
      letter-spacing: 0.08em; 
      color: #64748b; 
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .cl-table td { padding: 14px 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
    .cl-table tr:last-child td { border-bottom: none; }
    .cl-table tbody tr { transition: background 0.15s ease; }
    .cl-table tbody tr:hover { background: #f8fafc; }
    .cl-nav { display: flex; gap: 8px; background: #ffffff; padding: 6px; border-radius: 14px; margin-bottom: 28px; border: 1px solid #e2e8f0; }
    .cl-nav-btn { 
      border: none; 
      background: transparent; 
      padding: 10px 20px; 
      border-radius: 10px; 
      font-size: 14px; 
      font-weight: 500; 
      cursor: pointer; 
      color: #64748b; 
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cl-nav-btn:hover { background: #f8fafc; }
    .cl-nav-btn.active { 
      background: #3b82f6; 
      color: white; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .cl-section-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .cl-section-sub { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .cl-bar-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
    .cl-bar-row:last-child { border-bottom: none; }
    .cl-mini-bar { height: 8px; background: #e2e8f0; border-radius: 4px; flex: 1; overflow: hidden; }
    .cl-mini-fill { height: 100%; border-radius: 4px; transition: width 0.3s ease; }
    @media (max-width: 768px) { 
      .cl-grid-4 { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .cl-grid-2 { grid-template-columns: 1fr; gap: 16px; }
      .cl-nav-btn { padding: 8px 14px; font-size: 12px; }
    }
  `;

  return (
    <div ref={dashboardRef} className="cl-root" style={{ background: '#f8fafc', minHeight: '100vh', padding: 28 }}>
      <style>{css}</style>

      {/* ── En-tête ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 700, 
              background: '#3b82f6', 
              color: 'white', 
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              {t('dashboardChefLigne.badge', {}, 'CHEF DE LIGNE')}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginBottom: 4 }}>
              {t('dashboardChefLigne.title', { line: user?.processusNom || user?.segmentNom || t('dashboardChefLigne.lineFallback', {}, 'Ma ligne') }, 'Tableau de bord — {{line}}')}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b' }}>
              {t('dashboardChefLigne.subtitle', {}, 'Suivi qualité de votre ligne de production')} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Period filter */}
            <select
              value={filterYear !== null ? `year:${filterYear}` : String(rangeDays)}
              onChange={e => {
                const v = e.target.value;
                if (v.startsWith('year:')) { setFilterYear(Number(v.replace('year:', ''))); }
                else { setRangeDays(Number(v)); setFilterYear(null); }
              }}
              style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: 12, 
                padding: '8px 16px', 
                fontSize: 13, 
                background: '#ffffff', 
                color: '#0f172a', 
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              <optgroup label="Derniers jours">
                {[7, 14, 30, 90].map(n => <option key={n} value={n}>{n} jours</option>)}
              </optgroup>
              {availableYears.length > 0 && (
                <optgroup label="Par année">
                  {availableYears.map(y => <option key={y} value={`year:${y}`}>Année {y}</option>)}
                </optgroup>
              )}
            </select>
            <button
              onClick={load}
              style={{ 
                border: 'none', 
                borderRadius: 12, 
                padding: '8px 20px', 
                fontSize: 13, 
                background: '#3b82f6', 
                color: '#fff', 
                cursor: 'pointer', 
                fontWeight: 600,
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {t('dashboardChefLigne.refresh', {}, '↺ Actualiser')}
            </button>
            {/* Export PDF */}
            <button
              className="no-print"
              onClick={handleExportPDF}
              disabled={exporting}
              style={{ 
                border: 'none', 
                borderRadius: 12, 
                padding: '8px 20px', 
                fontSize: 13, 
                background: exporting ? '#dc2626aa' : '#dc2626', 
                color: '#fff', 
                cursor: exporting ? 'wait' : 'pointer', 
                fontWeight: 600,
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { if (!exporting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              {exporting ? '⏳ Export…' : '⬇ Exporter PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="cl-grid-4" style={{ marginBottom: 28 }}>
        <KpiCard label={t('dashboardChefLigne.kpi.conformityRate', {}, 'Taux de conformité')} value={`${tauxConf.toFixed(1)}%`} icon="✅" trendUp={tauxConf >= 80} trend={stats?.evolutionTaux || null} color="#10b981" />
        <KpiCard label={t('dashboardChefLigne.kpi.ncDetected', {}, 'NC détectées')} value={totalNC} icon="⚠️" trendUp={false} trend={null} color="#ef4444" />
        <KpiCard label={t('dashboardChefLigne.kpi.validatedChecklists', {}, 'Checklists validées')} value={validees} icon="📋" trendUp={true} trend={null} color="#3b82f6" />
        <KpiCard label={t('dashboardChefLigne.kpi.pendingValidation', {}, 'En cours de validation')} value={enCours} icon="⏳" trend={null} color="#f59e0b" />
      </div>

      {/* ── Navigation sections ────────────────────────────────────────── */}
      <nav className="cl-nav">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            className={`cl-nav-btn${activeSection === s.key ? ' active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* ── Section : Vue globale ──────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="cl-grid-2">
            <div className="cl-card">
              <div className="cl-section-title">{t('dashboardChefLigne.charts.ncEvolution', {}, 'Évolution des non-conformités')}</div>
              <div className="cl-section-sub">{t('dashboardChefLigne.charts.ncEvolutionSub', {}, 'NC par jour + courbe de conformité')}</div>
              <ChartCanvas id="chef-nc-trend" config={ncTrendConfig} height={260} />
              <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 12, color: '#64748b' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(239,68,68,0.7)', borderRadius: 3, marginRight: 6 }} />NC</span>
                <span><span style={{ display: 'inline-block', width: 24, height: 3, background: '#10b981', marginRight: 6, verticalAlign: 'middle' }} />Conformité</span>
              </div>
            </div>

            <div className="cl-card">
              <div className="cl-section-title">{t('dashboardChefLigne.charts.lineSummary', {}, 'Synthèse de la ligne')}</div>
              <div className="cl-section-sub">{t('dashboardChefLigne.charts.lineSummarySub', {}, 'Indicateurs clés de performance')}</div>
              {[
                { label: t('dashboardChefLigne.charts.globalAlertRate', {}, "Taux d'alerte global"), value: `${alertRate}%`, color: parseFloat(alertRate) > 15 ? '#ef4444' : '#10b981' },
                { label: t('dashboardChefLigne.charts.totalChecklists', {}, 'Total checklists analysées'), value: totalCL, color: '#0f172a' },
                { label: t('dashboardChefLigne.charts.conformingChecklists', {}, 'Checklists conformes'), value: validees, color: '#10b981' },
                { label: t('dashboardChefLigne.charts.rejectedChecklists', {}, 'Checklists rejetées'), value: rejetes, color: '#ef4444' },
                { label: t('dashboardChefLigne.charts.pendingValidation', {}, 'En attente de validation'), value: enCours, color: '#f59e0b' },
                { label: t('dashboardChefLigne.charts.activeOperators', {}, 'Opérateurs actifs'), value: opPerf.length, color: '#3b82f6' },
                { label: t('dashboardChefLigne.charts.supervisedProcesses', {}, 'Processus supervisés'), value: processusCounts.length, color: '#8b5cf6' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e2e8f0', fontSize: 13 }}>
                  <span style={{ color: '#64748b' }}>{item.label}</span>
                  <strong style={{ color: item.color, fontSize: 16 }}>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Section : Processus ───────────────────────────────────────── */}
      {activeSection === 'processus' && (
        <div className="cl-card">
          <div className="cl-section-title">{t('dashboardChefLigne.charts.processByConformity', {}, 'Conformité par processus')}</div>
          <div className="cl-section-sub">{t('dashboardChefLigne.charts.processByConformitySub', {}, 'Taux de conformité de chaque processus sur la période sélectionnée')}</div>
          {processusCounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
              <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardChefLigne.charts.noProcessData', {}, 'Aucune donnée de processus disponible.')}</p>
            </div>
          ) : (
            <ChartCanvas id="chef-processus" config={processusConfig} height={Math.max(320, processusCounts.length * 40)} />
          )}
        </div>
      )}

      {/* ── Section : Non-conformités ─────────────────────────────────── */}
      {activeSection === 'nc' && (
        <div className="cl-card">
          <div className="cl-section-title">{t('dashboardChefLigne.charts.top8Criteria', {}, 'Top 8 critères les plus souvent non-conformes')}</div>
          <div className="cl-section-sub">{t('dashboardChefLigne.charts.top8CriteriaSub', {}, 'Classement basé sur les réponses ROUGE des checklists')}</div>
          {topNC.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
              <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardChefLigne.charts.noNcDetected', {}, 'Aucune non-conformité détectée sur la période.')}</p>
            </div>
          ) : topNC.map(([name, count], i) => {
            const pct = Math.round((count / maxNC) * 100);
            const color = i < 2 ? '#ef4444' : i < 4 ? '#f59e0b' : '#6b7280';
            const bg    = i < 2 ? 'rgba(239,68,68,0.1)' : i < 4 ? 'rgba(245,158,11,0.1)' : 'rgba(107,114,128,0.1)';
            return (
              <div key={name} className="cl-bar-row">
                <span style={{ 
                  fontSize: 12, 
                  fontWeight: 700, 
                  width: 28, 
                  textAlign: 'center', 
                  background: bg, 
                  color, 
                  borderRadius: 6, 
                  padding: '4px 0' 
                }}>#{i + 1}</span>
                <span style={{ flex: '0 0 220px', fontSize: 13, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                  {name}
                </span>
                <div className="cl-mini-bar">
                  <div className="cl-mini-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color, minWidth: 40, textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Section : Checklists récentes ─────────────────────────────── */}
      {activeSection === 'checklists' && (
        <div className="cl-card">
          <div className="cl-section-title">{t('dashboardChefLigne.table.recentChecklists', {}, 'Dernières checklists soumises')}</div>
          <div className="cl-section-sub">{t('dashboardChefLigne.table.recentChecklistsSub', {}, 'Dernières 8 checklists de votre ligne')}</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="cl-table">
              <thead>
                <tr>
                    <th>{t('dashboardChefLigne.table.columns.checklist', {}, 'Checklist')}</th>
                  <th>{t('dashboardChefLigne.table.columns.operator', {}, 'Opérateur')}</th>
                  <th>{t('dashboardChefLigne.table.columns.date', {}, 'Date')}</th>
                    <th>{t('dashboardChefLigne.table.columns.process', {}, 'Processus')}</th>
                    <th>{t('dashboardChefLigne.table.columns.scope', {}, 'Site / Plant')}</th>
                  <th>{t('dashboardChefLigne.table.columns.conformity', {}, 'Conformes')}</th>
                  <th>{t('dashboardChefLigne.table.columns.nc', {}, 'NC')}</th>
                  <th>{t('dashboardChefLigne.table.columns.status', {}, 'Statut')}</th>
                </tr>
              </thead>
              <tbody>
                {derniersCL.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                    {t('dashboardChefLigne.table.noChecklist', {}, 'Aucune checklist trouvée')}
                  </td></tr>
                ) : derniersCL.map((cl, i) => (
                  <tr key={cl.id || i}>
                    <td style={{ fontWeight: 600 }}>{cl.nom || cl.checklistNom || `#${cl.id || '-'}`}</td>
                    <td style={{ color: '#64748b' }}>{cl.operateurNom || '-'}</td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{cl.dateControle ? new Date(cl.dateControle).toLocaleDateString('fr-FR') : '-'}</td>
                    <td style={{ color: '#64748b' }}>{cl.processusNom || cl.processusCode || '-'}</td>
                    <td style={{ color: '#64748b' }}>{cl.siteNom || cl.plantNom || cl.siteCode || cl.plantCode || '-'}</td>
                    <td style={{ color: '#10b981', fontWeight: 600 }}>{cl.criteresOk ?? '-'}</td>
                    <td style={{ color: cl.criteresNok > 0 ? '#ef4444' : '#64748b', fontWeight: cl.criteresNok > 0 ? 700 : 400 }}>{cl.criteresNok ?? 0}</td>
                    <td><StatusBadge statut={cl.statut} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section : Opérateurs ──────────────────────────────────────── */}
      {activeSection === 'operators' && (
        <div className="cl-card">
          <div className="cl-section-title">{t('dashboardChefLigne.operators.title', {}, 'Performance des opérateurs de la ligne')}</div>
          <div className="cl-section-sub">{t('dashboardChefLigne.operators.titleSub', { count: rangeDays }, `Taux de conformité sur ${rangeDays} jours — du meilleur au moins bon`)}</div>
          {opPerf.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👥</div>
              <p style={{ color: '#64748b', fontSize: 14 }}>Aucun opérateur trouvé.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="cl-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('dashboardChefLigne.operators.columns.operator', {}, 'Opérateur')}</th>
                    <th>{t('dashboardChefLigne.operators.columns.checklists', {}, 'Checklists')}</th>
                    <th>{t('dashboardChefLigne.operators.columns.nc', {}, 'NC')}</th>
                    <th>{t('dashboardChefLigne.operators.columns.conformity', {}, 'Conformité')}</th>
                    <th>{t('dashboardChefLigne.operators.columns.gauge', {}, 'Jauge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {opPerf.slice(0, 10).map((op, i) => {
                    const rate = Math.round(op.tauxConformite ?? 0);
                    const medalColor = i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#64748b';
                    return (
                      <tr key={op.operateurId || i}>
                        <td style={{ fontWeight: 800, color: medalColor, fontSize: 16 }}>#{i+1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ 
                              width: 40, 
                              height: 40, 
                              borderRadius: '50%', 
                              background: scoreBg(rate), 
                              color: scoreColor(rate), 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              fontSize: 14, 
                              fontWeight: 700 
                            }}>
                              {getInitials(op.operateurNom)}
                            </div>
                            <span style={{ fontWeight: 600 }}>{op.operateurNom || '-'}</span>
                          </div>
                        </td>

                        <td style={{ color: '#64748b' }}>{op.totalChecklists ?? '-'}</td>
                        <td style={{ color: (op.nonConformites || 0) > 0 ? '#ef4444' : '#64748b', fontWeight: (op.nonConformites || 0) > 0 ? 700 : 400 }}>{op.nonConformites ?? 0}</td>
                        <td style={{ fontWeight: 800, color: scoreColor(rate), fontSize: 16 }}>{rate}%</td>
                        <td style={{ minWidth: 100 }}>
                          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: scoreColor(rate), borderRadius: 4, transition: 'width 0.3s ease' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}