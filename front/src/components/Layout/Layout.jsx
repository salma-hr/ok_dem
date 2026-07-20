import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOperateurSession } from '../Operateursessioncontext';
import { useNotifications } from '../../hooks/useNotifications';
import { useI18n } from '../../context/I18nContext';
import { getBrouillonsActifs } from '../../api';
import { NotificationBell } from '../NotificationBell';

// ── Icônes SVG inline ────────────────────────────────────────────────────────
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

const icons = {
  dashboard:  "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  users:      ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
  profil:     ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2","M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8"],
  checklist:  ["M9 11l3 3L22 4","M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  settings:   ["M12 20h9","M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5"],
  processus:  ["M12 2L2 7l10 5 10-5-10-5","M2 17l10 5 10-5","M2 12l10 5 10-5"],
  criteres:   ["M8 6h13","M8 12h13","M8 18h13","M3 6h.01","M3 12h.01","M3 18h.01"],
  segment:    ["M12 2a10 10 0 0 1 10 10H12V2","M12 12L2 12a10 10 0 0 0 10 10V12"],
  plant:      "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  site:       ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0","M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"],
  pdf:        ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8","M14 2v6h6","M9 13h6","M9 17h3"],
  clipboard:  ["M9 2h6a2 2 0 0 1 2 2v2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3V4a2 2 0 0 1 2-2z","M9 6h6"],
  logout:     ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4","M16 17l5-5-5-5","M21 12H9"],
  bell:       ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9","M13.73 21a2 2 0 0 1-3.46 0"],
  moon:       "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  sun:        ["M12 1v2","M12 21v2","M4.22 4.22l1.42 1.42","M18.36 18.36l1.42 1.42","M1 12h2","M21 12h2","M4.22 19.78l1.42-1.42","M18.36 5.64l1.42-1.42","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8"],
  chevL:      "M15 18l-6-6 6-6",
  chevR:      "M9 18l6-6-6-6",
  chevD:      "M6 9l6 6 6-6",
  menu:       ["M3 12h18","M3 6h18","M3 18h18"],
  search:     ["M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16","M21 21l-4.35-4.35"],
  shield:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10",
  chart2:     ["M18 20V10","M12 20V4","M6 20v-6"],
  check:      ["M22 11.08V12a10 10 0 1 1-5.93-9.14","M22 4 12 14.01l-3-3"],
  warn:       ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0","M12 9v4","M12 17h.01"],
  info:       ["M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20","M12 16v-4","M12 8h.01"],
};

const BASE_MENU = [
  { groupKey: 'menu.group.main', items: [
    { labelKey: 'menu.item.dashboard', path: '/dashboard-advanced', icon: 'chart2', roles: ['ADMIN','ADMIN_PLANT'] },
    { labelKey: 'menu.item.dashboardChefLigne', path: '/dashboard/chef-ligne', icon: 'chart2', roles: ['CHEF_LIGNE'] },
    { labelKey: 'menu.item.dashboardTechnicien', path: '/dashboard/technicien', icon: 'chart2', roles: ['TECHNICIEN'] },
    { labelKey: 'menu.item.dashboardAgentQualite', path: '/dashboard/agent-qualite', icon: 'chart2', roles: ['AGENT_QUALITE'] },
    { labelKey: 'menu.item.dashboardPPO', path: '/dashboard/ppo', icon: 'chart2', roles: ['PPO'] },
    { labelKey: 'menu.item.profile', path: '/profil', icon: 'profil', roles: null },
  ]},
  { groupKey: 'menu.group.operations', items: [
    { labelKey: 'menu.item.checklists', path: '/checklist', icon: 'checklist', roles: ['ADMIN','ADMIN_PLANT','AGENT_QUALITE','TECHNICIEN','CHEF_LIGNE'] },
    { labelKey: 'menu.item.operateursLtpm', path: '/checklist/operateurs-ltpm', icon: 'checklist', roles: ['ADMIN','ADMIN_PLANT','AGENT_QUALITE','TECHNICIEN','CHEF_LIGNE'] },
    { labelKey: 'menu.item.checklistEntry', path: '/checklist/operateur', icon: 'checklist', roles: ['OPERATEUR'] },
  ]},
  { groupKey: 'menu.group.quality', items: [
    { labelKey: 'menu.item.qualityHub', path: '/qualityMangement', icon: 'clipboard', roles: ['ADMIN', 'ADMIN_PLANT', 'CHEF_LIGNE', 'TECHNICIEN', 'AGENT_QUALITE'] },
  ]},
  { groupKey: 'menu.group.management', items: [
    { labelKey: 'menu.item.users', path: '/admin/utilisateurs', icon: 'users', roles: ['ADMIN','ADMIN_PLANT'] },
    { labelKey: 'menu.item.machines', path: '/machines', icon: 'settings', roles: ['PPO','ADMIN','ADMIN_PLANT'] },
    { labelKey: 'menu.item.processes', path: '/processus', icon: 'processus', roles: ['PPO','ADMIN','ADMIN_PLANT'] },
    { labelKey: 'menu.item.criteria', path: '/criteres', icon: 'criteres', roles: ['PPO','ADMIN','ADMIN_PLANT'] },
  ]},
  { groupKey: 'menu.group.config', items: [
    { labelKey: 'menu.item.sites', path: '/sites', icon: 'site', roles: ['ADMIN', 'ADMIN_PLANT', 'PPO'] },
    { labelKey: 'menu.item.plants', path: '/plants', icon: 'plant', roles: ['ADMIN', 'ADMIN_PLANT', 'PPO'] },
    { labelKey: 'menu.item.segments', path: '/segments', icon: 'segment', roles: ['ADMIN', 'ADMIN_PLANT', 'PPO'] },
  ]},
]
const ROLE_COLORS = {
  OPERATEUR:   { color: '#10b981', bg: 'rgba(16,185,129,.15)' },
  CHEF_LIGNE:  { color: '#3b82f6', bg: 'rgba(59,130,246,.15)' },
  ADMIN:       { color: '#6366f1', bg: 'rgba(99,102,241,.15)' },
  ADMIN_PLANT: { color: '#4f46e5', bg: 'rgba(79,70,229,.15)' },
  PPO:         { color: '#f59e0b', bg: 'rgba(245,158,11,.15)' },
};

const SESSION_META = {
  M: { icon: '🌅', labelKey: 'layout.session.morning' },
  S: { icon: '🌆', labelKey: 'layout.session.evening' },
  N: { icon: '🌙', labelKey: 'layout.session.night' },
};

export default function Layout({ children }) {
  const { t, lang, setLang, isRtl } = useI18n();
  const { user, logout } = useAuth();
  const { activeSession }  = useOperateurSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed,     setCollapsed]     = useState(false);
  const [theme,         setTheme]         = useState('light');
  const [showProfile,   setShowProfile]   = useState(false);
  const [showDrafts,    setShowDrafts]    = useState(false);
  const [drafts,        setDrafts]        = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [showLangMenu,  setShowLangMenu]  = useState(false);

  // ── Notifications réelles ──────────────────────────────────────────────
  const { notifs } = useNotifications();

  const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
  const today = new Date().toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  const initials  = (user?.nom || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const handleLogout = () => { closeAll(); logout(); navigate('/login'); };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };


  // ── Construction du menu avec badges ───────────────────────────────────
  const menuWithBadges = BASE_MENU.map(g => ({
    ...g,
    items: g.items.map(i => {
      
      if (i.path === '/validations') {
        // Compter les validations en attente pour l'utilisateur courant
        return { ...i, badge: 0 }; // À remplacer par le vrai count si disponible
      }
      return i;
    }),
  }));

  // ── Filtrage des groupes visibles selon le rôle ────────────────────────
  const visibleGroups = menuWithBadges.map(g => ({
    key: g.groupKey,
    label: t(g.groupKey),
    items: g.items
      .filter(i => !i.roles || i.roles.includes(user?.role))
      .map(i => ({ ...i, label: t(i.labelKey) })),
  })).filter(g => g.items.length > 0);

  const sessionMeta = Object.entries(SESSION_META).reduce((acc, [key, meta]) => {
    acc[key] = { icon: meta.icon, label: t(meta.labelKey) };
    return acc;
  }, {});
  const sessionDefault = { icon: '⏱', label: t('layout.session.default') };

  const isOperateur = user?.role === 'OPERATEUR';
  const isOperateurChecklistPage = isOperateur && location.pathname === '/checklist/operateur';
  const todayISO = new Date().toISOString().split('T')[0];
  const rc = ROLE_COLORS[user?.role] || { color: 'var(--tx-3)', bg: 'rgba(107,114,128,.12)' };
  const sidebarW = collapsed ? 'var(--sb-c)' : 'var(--sb-w)';
  const mainStyle = isRtl
    ? { marginRight: sidebarW, marginLeft: 0, flex: 1 }
    : { marginLeft: sidebarW, marginRight: 0, flex: 1 };
  const sidebarToggleIcon = collapsed
    ? (isRtl ? icons.chevL : icons.chevR)
    : (isRtl ? icons.chevR : icons.chevL);

  const fetchDrafts = useCallback(async () => {
    if (!isOperateurChecklistPage || !user?.id) return;
    setLoadingDrafts(true);
    try {
      const res = await getBrouillonsActifs(user.id, todayISO);
      setDrafts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }, [isOperateurChecklistPage, user?.id, todayISO]);

  useEffect(() => {
    if (isOperateurChecklistPage) {
      fetchDrafts();
      return;
    }

    setShowDrafts(false);
    setDrafts([]);
  }, [isOperateurChecklistPage, fetchDrafts]);

  useEffect(() => {
    const handleDraftRefresh = () => {
      if (isOperateurChecklistPage) fetchDrafts();
    };

    window.addEventListener('operateur:drafts:refresh', handleDraftRefresh);
    return () => window.removeEventListener('operateur:drafts:refresh', handleDraftRefresh);
  }, [isOperateurChecklistPage, fetchDrafts]);

  const closeAll  = () => { setShowProfile(false); setShowDrafts(false); };

  const handleToggleDrafts = () => {
    if (!isOperateurChecklistPage) return;

    const next = !showDrafts;
    setShowDrafts(next);
    setShowProfile(false);

    if (next) fetchDrafts();
  };

  const handleResumeDraft = (draft) => {
    window.dispatchEvent(new CustomEvent('operateur:draft-resume', { detail: draft }));
    setShowDrafts(false);
  };

  const handleHideDraft = (draftId) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
  };

  return (
    <div className="app-shell">

      {/* ════ SIDEBAR ════ */}
      <aside className={`sb${collapsed ? ' collapsed' : ''}`}>

        <div className="sb-hd">
          <div className="sb-brand">
            <div className="sb-logo">
              <Icon d={icons.shield} size={collapsed ? 18 : 20} />
            </div>
            {!collapsed && (
              <div className="sb-brand-text">
                <div className="sb-name">{t('brand.app')}</div>
                <div className="sb-sub">{t('brand.tagline')}</div>
              </div>
            )}
          </div>
          <button className="sb-toggle" onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? t('layout.sidebar.toggleExpand') : t('layout.sidebar.toggleCollapse')}>
            <Icon d={sidebarToggleIcon} size={14} />
          </button>
        </div>

        <nav className="sb-nav">
          {visibleGroups.map(group => (
            <div key={group.key} className="sb-group">
              {!collapsed && <div className="sb-group-lbl">{group.label}</div>}
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sb-item${isActive ? ' active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <span className="sb-item-icon"><Icon d={icons[item.icon]} size={17} /></span>
                  {!collapsed && <span className="sb-item-lbl">{item.label}</span>}
                  {!collapsed && item.badge > 0 && (
                    <span style={{
                      marginInlineStart: 'auto',
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 800,
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      lineHeight: 1,
                    }}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sb-ft">
          <div className="sb-user">
            <div className="sb-avatar">{initials}</div>
            {!collapsed && (
              <div className="sb-user-info">
                <div className="sb-user-name">{user?.nom || t('common.userFallback')}</div>
                <div className="sb-user-role">{user?.role || ''}</div>
              </div>
            )}
          </div>
          <button className="sb-logout" onClick={handleLogout} title={t('common.logout')}>
            <Icon d={icons.logout} size={15} />
            {!collapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* ════ MAIN AREA ════ */}
      <div className="app-main" style={mainStyle}>

        {(showProfile || showDrafts) && (
          <div className="nb-backdrop" onClick={closeAll} style={{ zIndex: 999 }} />
        )}

        {/* ── NAVBAR ── */}
        <nav className={`nb${collapsed ? ' collapsed' : ''}`}>

          <div className="nb-left">
            {isOperateur ? (
              <div style={nbStyles.opInfo}>
                <div style={nbStyles.opAvatar}>{initials}</div>
                <div style={nbStyles.opDetails}>
                  <div style={nbStyles.opName}>{user?.nom}</div>
                  <div style={nbStyles.opMeta}>
                    <span style={{ ...nbStyles.opRoleBadge, background: rc.bg, color: rc.color }}>
                      {user?.role}
                    </span>
                    <span style={nbStyles.opSep}>·</span>
                    <span style={nbStyles.opMatricule}>{user?.matricule || '—'}</span>
                    {user?.plantNom && (
                      <>
                        <span style={nbStyles.opSep}>·</span>
                        <span style={nbStyles.opPlant}>🏭 {user.plantNom}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={nbStyles.opDivider} />
                {/* Plant & Processus assignés */}
                <div style={nbStyles.opContext}>
                  {user?.processusNom && (
                    <span style={nbStyles.opContextChip}>
                      ⚙️ {user.processusNom}
                    </span>
                  )}
                </div>
                <div style={nbStyles.opDivider} />
                <div style={nbStyles.opDate}>{today}</div>
                {activeSession && (
                  <div style={{
                    ...nbStyles.opShift,
                    background:  activeSession.soft,
                    color:       activeSession.accent,
                    borderColor: activeSession.ring,
                  }}>
                    {activeSession.icon} {activeSession.label} · {activeSession.hours}
                  </div>
                )}
              </div>
            ) : (
              <div />
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="nb-right">
            
            {/* Theme */}
            <button className="nb-icon" onClick={toggleTheme}
              title={theme === 'light' ? t('layout.theme.dark') : t('layout.theme.light')}>
              <Icon d={theme === 'light' ? icons.moon : icons.sun} size={17} />
            </button>

            {/* ── Language dropdown ── */}
            <div style={{ position: 'relative' }}>
              <button
                className="nb-icon"
                onClick={() => setShowLangMenu(v => !v)}
                title={t('common.language')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 'var(--r-f)',
                  border: '1.5px solid var(--bd-1)',
                  background: showLangMenu ? 'var(--l1)' : 'var(--bg-2)',
                  color: 'var(--tx-1)', fontWeight: 700, fontSize: 12,
                  cursor: 'pointer', transition: 'all .18s',
                  minWidth: 60,
                }}
              >
                <span style={{ fontSize: 16 }}>
                  { lang === 'fr' ? '🇫🇷' : lang === 'ar' ? '🇸🇦' : lang === 'de' ? '🇩🇪' : '🇬🇧' }
                </span>
                <span>{ lang === 'fr' ? 'FR' : lang === 'ar' ? 'AR' : lang === 'de' ? 'DE' : 'EN' }</span>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transition: 'transform .2s', transform: showLangMenu ? 'rotate(180deg)' : 'none' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {showLangMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                    onClick={() => setShowLangMenu(false)}
                  />
                  {/* Dropdown list */}
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)',
                    right: 0, zIndex: 999,
                    background: 'var(--bg-1)',
                    border: '1.5px solid var(--bd-1)',
                    borderRadius: 'var(--r-xl)',
                    boxShadow: '0 8px 24px rgba(15,23,42,.12)',
                    minWidth: 170, overflow: 'hidden',
                    animation: 'fadeSlideDown .15s ease',
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '8px 14px 6px',
                      fontSize: 10, fontWeight: 800, letterSpacing: '.6px',
                      color: 'var(--tx-4)', textTransform: 'uppercase',
                      borderBottom: '1px solid var(--bd-1)',
                    }}>
                      {t('common.language')}
                    </div>

                    {[
                      { code: 'fr', flag: '🇫🇷', label: 'Français',  native: 'French'   },
                      { code: 'en', flag: '🇬🇧', label: 'English',   native: 'English'  },
                      { code: 'ar', flag: '🇸🇦', label: 'العربية',   native: 'Arabic'   },
                      { code: 'de', flag: '🇩🇪', label: 'Deutsch',   native: 'German'   },
                    ].map(({ code, flag, label, native }) => {
                      const isActive = lang === code;
                      return (
                        <button
                          key={code}
                          onClick={() => { setLang(code); setShowLangMenu(false); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center',
                            gap: 10, padding: '9px 14px',
                            background: isActive ? 'var(--l1)' : 'transparent',
                            border: 'none', cursor: 'pointer',
                            transition: 'background .15s',
                            borderLeft: isActive ? '3px solid var(--l5)' : '3px solid transparent',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-2)'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <span style={{ fontSize: 20 }}>{flag}</span>
                          <span style={{ flex: 1, textAlign: 'left' }}>
                            <span style={{
                              display: 'block', fontSize: 13, fontWeight: isActive ? 800 : 600,
                              color: isActive ? 'var(--l5)' : 'var(--tx-1)',
                            }}>{label}</span>
                            <span style={{ fontSize: 10, color: 'var(--tx-4)', fontWeight: 500 }}>{native}</span>
                          </span>
                          {isActive && (
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                              stroke="var(--l5)" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <NotificationBell />

            
          </div>
        </nav>

        {/* ── PAGE CONTENT ── */}
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Styles inline pour la zone opérateur dans la navbar ─────────────────── */
const nbStyles = {
  opInfo:       { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  opAvatar:     { width: 36, height: 36, borderRadius: '50%', background: 'var(--l5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 13, flexShrink: 0, boxShadow: '0 0 0 2px rgba(0,87,168,.25)' },
  opDetails:    { display: 'flex', flexDirection: 'column', gap: 2 },
  opName:       { fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', fontFamily: "'Pacifico', cursive", lineHeight: 1 },
  opMeta:       { display: 'flex', alignItems: 'center', gap: 6 },
  opRoleBadge:  { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-f)', letterSpacing: '.4px' },
  opSep:        { color: 'var(--tx-4)', fontSize: 12 },
  opMatricule:  { fontSize: 11, color: 'var(--tx-4)', fontWeight: 500 },
  opPlant:      { fontSize: 11, color: 'var(--tx-2)', fontWeight: 600 },
  opDivider:    { width: 1, height: 32, background: 'var(--bd-1)', flexShrink: 0, margin: '0 4px' },
  opContext:    { display: 'flex', alignItems: 'center', gap: 6 },
  opContextChip:{ 
    fontSize: 11, 
    fontWeight: 600, 
    padding: '3px 10px', 
    borderRadius: 'var(--r-f)',
    background: 'rgba(0,87,168,.10)', 
    color: 'var(--l5)', 
    border: '1px solid rgba(0,87,168,.20)' 
  },
  opDate:       { fontSize: 12, color: 'var(--tx-4)', textTransform: 'capitalize', fontWeight: 500 },
  opShift:      { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 'var(--r-f)', fontSize: 12, fontWeight: 700, border: '1.5px solid', transition: 'all .25s ease' },
};