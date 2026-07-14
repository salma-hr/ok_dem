import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  getDashboardRecentLists,
  getDashboardOperatorPerformance,
  getAllProcessus,
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';

Chart.register(...registerables);

// ── Helpers ────────────────────────────────────────────────────────────────
const scoreColor = (v) => (v >= 90 ? '#10b981' : v >= 75 ? '#f59e0b' : '#ef4444');
const toDateKey = (d) => d.toISOString().slice(0, 10);
const buildDateRange = (days) => {
  const end = new Date(); end.setHours(0,0,0,0);
  return Array.from({ length: days }, (_, i) => { const d = new Date(end); d.setDate(end.getDate() - (days - 1 - i)); return d; });
};

// ── Composant Filtres ────────────────────────────────────────────────────────
function FilterBar({ filters, onFilterChange, processusList, scopeLabel, scopeSubLabel, t }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      marginBottom: 24,
      padding: '16px 20px',
      background: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: 16,
      alignItems: 'flex-end'
    }}>
      <div style={{ flex: 1.2, minWidth: 220 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
          {t('dashboardTechnicien.scopeLabel', {}, 'Scope')}
        </label>
        <div style={{
          width: '100%',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 13,
          background: '#f8fafc',
          color: '#0f172a',
          minHeight: 40,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 2,
        }}>
          <strong style={{ fontSize: 13, fontWeight: 700 }}>{scopeLabel}</strong>
          <span style={{ fontSize: 11, color: '#64748b' }}>{scopeSubLabel}</span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 180 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'block' }}>
          {t('dashboardTechnicien.filters.process', {}, 'Processus')}
        </label>
        <select
          value={filters.processus}
          onChange={(e) => onFilterChange('processus', e.target.value)}
          style={{
            width: '100%',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            background: '#f8fafc',
            color: '#0f172a',
            cursor: 'pointer'
          }}
        >
          <option value="all">{t('dashboardTechnicien.filters.allProcesses', {}, 'Tous les processus')}</option>
          {processusList.map(processus => (
            <option key={processus.id} value={processus.id}>
              {processus.nom || processus.code || processus.name}
            </option>
          ))}
        </select>
      </div>

      {filters.processus !== 'all' && (
        <div>
          <button
            onClick={() => {
              onFilterChange('processus', 'all');
            }}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '8px 16px',
              fontSize: 12,
              background: '#f8fafc',
              color: '#64748b',
              cursor: 'pointer',
              marginTop: 18
            }}
          >
            {t('dashboardTechnicien.filters.reset', {}, 'Réinitialiser')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Statut badge ────────────────────────────────────────────────────────────
function StatusBadge({ statut }) {
  const map = {
    VALIDE_FINAL: { label: 'Validé', bg: '#10b981', color: '#fff', icon: '✓' },
    VALIDE_N2:    { label: 'Val. N2', bg: '#3b82f6', color: '#fff', icon: '◉' },
    VALIDE_N1:    { label: 'Val. N1', bg: '#f59e0b', color: '#fff', icon: '○' },
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

// ── KPI card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, color = '#3b82f6', sub }) {
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
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
          {value}
        </div>
        {sub && <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{sub}</div>}
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: color }} />
    </div>
  );
}

// ── ChartCanvas ─────────────────────────────────────────────────────────────
function ChartCanvas({ id, config, height = 200 }) {
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

// ── Dashboard Technicien ────────────────────────────────────────────────────
export default function DashboardTechnicien() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [allChecklists, setAllChecklists] = useState([]);
  const [opPerf, setOpPerf]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [rangeDays, setRangeDays] = useState(14);
  const [filterYear, setFilterYear] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const dashboardRef = useRef(null);
  
  // Filtres
  const [filters, setFilters] = useState({
    processus: 'all',
  });
  const [processusList, setProcessusList] = useState([]);

  const scopePlantId = user?.plantId != null ? String(user.plantId) : '';
  const scopeSiteId = user?.siteId != null ? String(user.siteId) : '';
  const scopeLabel = [user?.siteNom, user?.plantNom].filter(Boolean).join(' / ') || t('dashboardTechnicien.scopeUnknown', {}, 'Mon périmètre');
  const scopeSubLabel = [user?.siteNom && `${t('dashboardTechnicien.filters.site', {}, 'Site')}: ${user.siteNom}`, user?.plantNom && `${t('dashboardTechnicien.filters.plant', {}, 'Plant')}: ${user.plantNom}`].filter(Boolean).join(' · ') || t('dashboardTechnicien.scopeInfo', {}, 'Données limitées à votre périmètre.');

  const isInScope = useCallback((row) => {
    if (!row) return false;
    const rowPlantId = row.plantId ?? row.plant?.id ?? row.plant?.plantId ?? null;
    const rowSiteId = row.siteId ?? row.site?.id ?? row.site?.siteId ?? null;
    const plantOk = !scopePlantId || (rowPlantId != null && String(rowPlantId) === scopePlantId);
    const siteOk = !scopeSiteId || (rowSiteId != null && String(rowSiteId) === scopeSiteId);
    return plantOk && siteOk;
  }, [scopePlantId, scopeSiteId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, op, proc] = await Promise.all([
        getDashboardRecentLists(100).then(x => x.data).catch(() => []),
        getDashboardOperatorPerformance(rangeDays).then(x => x.data).catch(() => []),
        getAllProcessus().then(x => x.data).catch(() => []),
      ]);
      setAllChecklists(Array.isArray(r) ? r : []);
      setOpPerf(Array.isArray(op) ? op : []);
      setProcessusList(Array.isArray(proc) ? proc : []);
    } finally { setLoading(false); }
  }, [rangeDays]);

  useEffect(() => { load(); }, [load]);

  // Filtrer les checklists selon les critères
  const scopedChecklists = React.useMemo(() => allChecklists.filter(isInScope), [allChecklists, isInScope]);

  const filteredChecklists = React.useMemo(() => {
    let filtered = [...scopedChecklists];
    if (filters.processus !== 'all') {
      filtered = filtered.filter(cl => cl.processusId === filters.processus);
    }
    if (filterYear !== null) {
      filtered = filtered.filter(cl => {
        const d = new Date(cl.dateControle || cl.dateCreation);
        return !isNaN(d) && d.getFullYear() === filterYear;
      });
    }
    return filtered;
  }, [scopedChecklists, filters, filterYear]);

  const totalCL  = filteredChecklists.length;
  const totalNC  = filteredChecklists.reduce((s, c) => s + (c.criteresNok || 0), 0);
  const rejetes  = filteredChecklists.filter(c => c.statut === 'REJETE').length;
  const enAttente = filteredChecklists.filter(c => ['SOUMIS','VALIDE_N1','VALIDE_N2'].includes(c.statut)).length;
  const tauxConf = totalCL > 0 ? Math.round(((totalCL - rejetes) / totalCL) * 100) : 0;
  const totalProcessus = new Set(filteredChecklists.map(c => c.processusId || c.processusNom).filter(Boolean)).size;
  const totalSitesPlants = new Set(filteredChecklists.map(c => `${c.siteId || c.siteNom || ''}:${c.plantId || c.plantNom || ''}`).filter(v => v !== ':')).size;
  const scopedProcessusList = React.useMemo(() => {
    const allowedIds = new Set(scopedChecklists.map(c => String(c.processusId)).filter(Boolean));
    return processusList.filter(processus => allowedIds.has(String(processus.id)) || allowedIds.has(String(processus.code)) || allowedIds.has(String(processus.nom)));
  }, [processusList, scopedChecklists]);
  const scopedOpPerf = React.useMemo(() => opPerf.filter(isInScope), [opPerf, isInScope]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  /* Available years */
  const availableYears = React.useMemo(() => {
    const years = new Set();
    scopedChecklists.forEach(c => {
      const d = new Date(c.dateControle || c.dateCreation);
      if (!isNaN(d)) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [scopedChecklists]);

  /* Export PDF */
  const handleExportPDF = useCallback(() => {
    setExporting(true);
    const style = document.createElement('style');
    style.id = 'tc-print-style';
    style.textContent = `@media print {
      body * { visibility: hidden; }
      #tc-dashboard-print, #tc-dashboard-print * { visibility: visible; }
      #tc-dashboard-print { position: absolute; left: 0; top: 0; width: 100%; }
      .no-print { display: none !important; }
      @page { margin: 12mm; size: A4 landscape; }
    }`;
    document.head.appendChild(style);
    if (dashboardRef.current) dashboardRef.current.id = 'tc-dashboard-print';
    setTimeout(() => {
      window.print();
      document.head.removeChild(style);
      if (dashboardRef.current) dashboardRef.current.removeAttribute('id');
      setExporting(false);
    }, 300);
  }, []);

  const processConfig = React.useMemo(() => {
    const map = new Map();
    filteredChecklists.forEach(c => {
      const key = c.processusNom || c.processusCode || c.processusId || '-';
      const cur = map.get(key) || { total: 0, nc: 0 };
      cur.total += 1;
      cur.nc += c.criteresNok || 0;
      map.set(key, cur);
    });
    const sorted = [...map.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    return {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => String(k).length > 20 ? String(k).substring(0, 20) + '...' : String(k)),
        datasets: [{
          label: t('dashboardTechnicien.charts.checklists', {}, 'Checklists'),
          data: sorted.map(([, v]) => v.total),
          backgroundColor: 'rgba(59,130,246,0.8)',
          borderRadius: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#64748b' }, grid: { color: '#e2e8f0' } },
        },
      },
    };
  }, [filteredChecklists, t]);

  const trendConfig = React.useMemo(() => {
    const days = buildDateRange(Math.min(rangeDays, 14));
    const labels = days.map(d => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }));
    const ncPerDay = days.map(d => {
      const key = toDateKey(d);
      return filteredChecklists
        .filter(c => toDateKey(new Date(c.dateControle || c.dateCreation)) === key)
        .reduce((s, c) => s + (c.criteresNok || 0), 0);
    });
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{ 
          label: 'NC', 
          data: ncPerDay, 
          borderColor: '#ef4444', 
          backgroundColor: 'rgba(239,68,68,0.05)', 
          fill: true, 
          borderWidth: 3, 
          pointRadius: 4,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          tension: 0.4 
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { 
          legend: { display: false },
          tooltip: { 
            backgroundColor: '#1e293b',
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { display: false } },
          y: { ticks: { font: { size: 10 }, color: '#64748b' }, grid: { color: '#e2e8f0' }, beginAtZero: true },
        },
      },
    };
  }, [filteredChecklists, rangeDays]);

  const TABS = [
    { key: 'activity',    label: t('dashboardTechnicien.tabs.activity', {}, '📋 Activité') },
    { key: 'validation',  label: t('dashboardTechnicien.tabs.validation', {}, '✅ À valider') },
    { key: 'processus',   label: t('dashboardTechnicien.tabs.processus', {}, '⚙️ Processus') },
    { key: 'tendance',    label: t('dashboardTechnicien.tabs.tendance', {}, '📈 Tendance') },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, flexDirection: 'column', gap: 16, background: '#f8fafc' }}>
        <div style={{ width: 50, height: 50, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardTechnicien.loading', {}, 'Chargement du tableau de bord technicien...')}</p>
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  const clAValider = filteredChecklists.filter(c => ['SOUMIS', 'VALIDE_N1'].includes(c.statut)).slice(0, 15);
  const recentActivity = [...filteredChecklists]
    .sort((a, b) => new Date(b.dateControle || b.dateCreation || 0) - new Date(a.dateControle || a.dateCreation || 0))
    .slice(0, 10);

  const css = `
    .tc-root {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    .tc-kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
    .tc-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .tc-tabs { display: flex; gap: 8px; background: #ffffff; padding: 6px; border-radius: 14px; margin-bottom: 24px; border: 1px solid #e2e8f0; }
    .tc-tab { 
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
    .tc-tab:hover { background: #f8fafc; }
    .tc-tab.active { 
      background: #3b82f6; 
      color: white; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .tc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tc-table th { 
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
    .tc-table td { padding: 14px 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; }
    .tc-table tr:last-child td { border-bottom: none; }
    .tc-table tbody tr { transition: background 0.15s ease; }
    .tc-table tbody tr:hover { background: #f8fafc; }
    @media (max-width: 768px) { 
      .tc-kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .tc-tab { padding: 8px 14px; font-size: 12px; }
    }
  `;

  return (
    <div ref={dashboardRef} className="tc-root" style={{ background: '#f8fafc', minHeight: '100vh', padding: 28 }}>
      <style>{css}</style>

      {/* ── En-tête ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ 
                background: '#3b82f6', 
                color: 'white', 
                borderRadius: 8, 
                padding: '4px 14px', 
                fontSize: 11, 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.07em',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {t('dashboardTechnicien.badge', {}, 'TECHNICIEN')}
              </div>
              {totalNC > 0 && (
                <div style={{ 
                  background: '#ef4444', 
                  color: 'white', 
                  borderRadius: 8, 
                  padding: '4px 14px', 
                  fontSize: 11, 
                  fontWeight: 700,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}>
                  ⚠️ {totalNC} NC actives
                </div>
              )}
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, marginBottom: 4 }}>
              {t('dashboardTechnicien.title', {}, 'Tableau de bord Technicien')}
            </h1>
            <p style={{ fontSize: 14, color: '#64748b' }}>
              {t('dashboardTechnicien.subtitle', {}, 'Vue opérationnelle des données de l\'application')} · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
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
                {[7, 14, 30].map(n => <option key={n} value={n}>{n} jours</option>)}
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
              {t('dashboardTechnicien.refresh', {}, '↺ Actualiser')}
            </button>
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

      {/* ── Filtres ────────────────────────────────────────────────────── */}
      <FilterBar 
        filters={filters}
        onFilterChange={handleFilterChange}
        processusList={scopedProcessusList}
        scopeLabel={scopeLabel}
        scopeSubLabel={scopeSubLabel}
        t={t}
      />

      {/* ── KPIs ──────────────────────────────────────────────────────── */}
      <div className="tc-kpi-grid">
        <KpiCard label={t('dashboardTechnicien.kpi.checklists', {}, 'Checklists')} value={totalCL} icon="📋" color="#3b82f6" sub={t('dashboardTechnicien.kpi.filteredData', {}, 'Données filtrées')} />
        <KpiCard label={t('dashboardTechnicien.kpi.toValidate', {}, 'À valider')} value={enAttente} icon="⏳" color="#f59e0b" sub={t('dashboardTechnicien.kpi.pendingTechnician', {}, 'En attente technicien')} />
        <KpiCard label={t('dashboardTechnicien.kpi.ncDetected', {}, 'Non-conformités')} value={totalNC} icon="⚠️" color="#ef4444" sub={t('dashboardTechnicien.kpi.rejected', { count: rejetes }, `${rejetes} rejetées`)} />
        <KpiCard label={t('dashboardTechnicien.kpi.scopeSummary', {}, 'Processus / plants')} value={`${totalProcessus} / ${totalSitesPlants}`} icon="🏭" color="#8b5cf6" sub={t('dashboardTechnicien.kpi.scopeDistribution', {}, 'Répartition app')} />
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="tc-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`tc-tab${activeTab === t.key ? ' active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Activité ─────────────────────────────────────────────────── */}
      {activeTab === 'activity' && (
        <div className="tc-card">
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t('dashboardTechnicien.activity.title', {}, 'Activité récente')}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{t('dashboardTechnicien.activity.subtitle', {}, "Dernières checklists enregistrées dans l'application")}</div>
          <div style={{ overflowX: 'auto' }}>
            {recentActivity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
                <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardTechnicien.activity.empty', {}, 'Aucune activité disponible.')}</p>
              </div>
            ) : (
              <table className="tc-table">
                <thead>
                  <tr>
                    <th>{t('dashboardTechnicien.table.date', {}, 'Date')}</th>
                    <th>{t('dashboardTechnicien.table.checklist', {}, 'Checklist')}</th>
                    <th>{t('dashboardTechnicien.table.operator', {}, 'Opérateur')}</th>
                    <th>{t('dashboardTechnicien.table.process', {}, 'Processus')}</th>
                    <th>{t('dashboardTechnicien.table.scope', {}, 'Site / Plant')}</th>
                    <th>{t('dashboardTechnicien.table.status', {}, 'Statut')}</th>
                    <th>{t('dashboardTechnicien.table.nc', {}, 'NC')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.map((cl, i) => (
                    <tr key={cl.id || i}>
                      <td style={{ color: '#64748b', fontSize: 12 }}>{cl.dateControle ? new Date(cl.dateControle).toLocaleDateString('fr-FR') : '-'}</td>
                      <td style={{ fontWeight: 600 }}>{cl.nom || cl.checklistNom || `#${cl.id || '-'}`}</td>
                      <td style={{ color: '#64748b' }}>{cl.operateurNom || '-'}</td>
                      <td style={{ color: '#64748b' }}>{cl.processusNom || cl.processusCode || '-'}</td>
                      <td style={{ color: '#64748b' }}>{cl.siteNom || cl.plantNom || cl.siteCode || cl.plantCode || '-'}</td>
                      <td><StatusBadge statut={cl.statut} /></td>
                      <td style={{ fontWeight: 700, color: (cl.criteresNok || 0) > 0 ? '#ef4444' : '#64748b' }}>{cl.criteresNok || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Validation ──────────────────────────────────────────────── */}
      {activeTab === 'validation' && (
        <div className="tc-card">
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t('dashboardTechnicien.validation.title', {}, 'Checklists en attente de validation')}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{t('dashboardTechnicien.validation.subtitle', {}, "Triées par priorité à partir des données de l'application")}</div>
          <div style={{ overflowX: 'auto' }}>
            {clAValider.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
                <p style={{ color: '#64748b', fontSize: 14 }}>{t('dashboardTechnicien.validation.empty', {}, 'Aucune checklist en attente de validation.')}</p>
              </div>
            ) : (
              <table className="tc-table">
                <thead>
                  <tr>
                    <th>{t('dashboardTechnicien.table.checklist', {}, 'Checklist')}</th>
                    <th>{t('dashboardTechnicien.table.operator', {}, 'Opérateur')}</th>
                    <th>{t('dashboardTechnicien.table.date', {}, 'Date')}</th>
                    <th>{t('dashboardTechnicien.table.process', {}, 'Processus')}</th>
                    <th>{t('dashboardTechnicien.table.nc', {}, 'NC')}</th>
                    <th>{t('dashboardTechnicien.table.status', {}, 'Statut')}</th>
                    <th>{t('dashboardTechnicien.table.priority', {}, 'Priorité')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clAValider
                    .sort((a, b) => (b.criteresNok || 0) - (a.criteresNok || 0))
                    .map((cl, i) => {
                      const nc = cl.criteresNok || 0;
                      const prio = nc >= 5 ? { label: 'Urgent', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' } : nc > 0 ? { label: 'Normal', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' } : { label: 'Faible', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
                      return (
                        <tr key={cl.id || i}>
                          <td style={{ fontWeight: 600 }}>{cl.nom || cl.checklistNom || `#${cl.id || '-'}`}</td>
                          <td style={{ color: '#64748b' }}>{cl.operateurNom || '-'}</td>
                          <td style={{ color: '#64748b', fontSize: 12 }}>{cl.dateControle ? new Date(cl.dateControle).toLocaleDateString('fr-FR') : '-'}</td>
                          <td style={{ color: '#64748b' }}>{cl.processusNom || cl.processusCode || '-'}</td>
                          <td style={{ fontWeight: 700, color: nc > 0 ? '#ef4444' : '#64748b' }}>{nc}</td>
                          <td><StatusBadge statut={cl.statut} /></td>
                          <td>
                            <span style={{ 
                              background: prio.bg, 
                              color: prio.color, 
                              padding: '2px 10px', 
                              borderRadius: 20, 
                              fontSize: 11, 
                              fontWeight: 600,
                              display: 'inline-block'
                            }}>
                              {prio.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Processus ────────────────────────────────────────────────── */}
      {activeTab === 'processus' && (
        <div className="tc-card">
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t('dashboardTechnicien.processes.title', {}, 'Répartition par processus')}</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{t('dashboardTechnicien.processes.subtitle', {}, "Vue synthétique des checklists par processus dans l'application")}</div>
          <ChartCanvas id="tc-processus" config={processConfig} height={280} />
        </div>
      )}

      {/* ── Tendance NC ───────────────────────────────────────────────── */}
      {activeTab === 'tendance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="tc-card">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t('dashboardTechnicien.trend.title', {}, 'Tendance des NC dans le temps')}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{t('dashboardTechnicien.trend.subtitle', { count: Math.min(rangeDays, 14) }, `Nombre de non-conformités par jour sur les ${Math.min(rangeDays, 14)} derniers jours`)}</div>
            <ChartCanvas id="tc-trend" config={trendConfig} height={260} />
          </div>

          <div className="tc-card">
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{t('dashboardTechnicien.operators.title', {}, 'Performance des opérateurs')}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>{t('dashboardTechnicien.operators.subtitle', { count: rangeDays }, `Classement par taux de conformité — ${rangeDays} jours`)}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="tc-table">
                <thead>
                  <tr>
                    <th>{t('dashboardTechnicien.operators.columns.operator', {}, 'Opérateur')}</th>
                    <th>{t('dashboardTechnicien.operators.columns.checklists', {}, 'Checklists')}</th>
                    <th>{t('dashboardTechnicien.operators.columns.nc', {}, 'NC')}</th>
                    <th>{t('dashboardTechnicien.operators.columns.conformity', {}, 'Conformité')}</th>
                    <th>{t('dashboardTechnicien.operators.columns.gauge', {}, 'Jauge')}</th>
                  </tr>
                </thead>
                <tbody>
                  {scopedOpPerf.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>{t('dashboardTechnicien.noData', {}, 'Aucune donnée')}</td></tr>
                  ) : scopedOpPerf.slice(0, 8).map((op, i) => {
                    const rate = Math.round(op.tauxConformite ?? 0);
                    return (
                      <tr key={op.operateurId || i}>
                        <td style={{ fontWeight: 500 }}>{op.operateurNom || '-'}</td>
                        <td style={{ color: '#64748b' }}>{op.totalChecklists ?? '-'}</td>
                        <td style={{ color: (op.nonConformites || 0) > 0 ? '#ef4444' : '#64748b', fontWeight: (op.nonConformites || 0) > 0 ? 700 : 400 }}>{op.nonConformites ?? 0}</td>
                        <td style={{ fontWeight: 700, color: scoreColor(rate) }}>{rate}%</td>
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
          </div>
        </div>
      )}
    </div>
  );
}