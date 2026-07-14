import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../api';
import { useI18n } from '../context/I18nContext';

/* ─── Types ─────────────────────────────────────────────────────────────── */
const TYPE_CONFIG = {
  NON_CONFORMITE: { icon: '⚠️', color: '#EF4444', bg: '#FEF2F2', key: 'notifications.types.nonConformity', fromKey: 'notifications.from.qualitySystem' },
  PLAN_ACTION:    { icon: '📋', color: '#F59E0B', bg: '#FFFBEB', key: 'notifications.types.planAction', fromKey: 'notifications.from.qualityManager' },
  VALIDATION:     { icon: '✅', color: '#22C55E', bg: '#F0FDF4', key: 'notifications.types.validation', fromKey: 'notifications.from.qualityAgent' },
  CHECK:          { icon: '✅', color: '#22C55E', bg: '#F0FDF4', key: 'notifications.types.validation', fromKey: 'notifications.from.qualityAgent' },
  SUSPECT:        { icon: '⚠️', color: '#D97706', bg: '#FFFBEB', key: 'notifications.types.warning', fromKey: 'notifications.from.system' },
  TRES_SUSPECT:   { icon: '🚨', color: '#DC2626', bg: '#FEF2F2', key: 'notifications.types.warning', fromKey: 'notifications.from.system' },
  ANOMALY:        { icon: '⚠️', color: '#D97706', bg: '#FFFBEB', key: 'notifications.types.warning', fromKey: 'notifications.from.system' },
  SUCCESS:        { icon: '✅', color: '#22C55E', bg: '#F0FDF4', key: 'notifications.types.success', fromKey: 'notifications.from.system' },
  REJET:          { icon: '❌', color: '#F97316', bg: '#FFF7ED', key: 'notifications.types.rejected', fromKey: 'notifications.from.lineChief' },
  WARN:           { icon: '⚠️', color: '#F59E0B', bg: '#FFFBEB', key: 'notifications.types.warning', fromKey: 'notifications.from.system' },
  INFO:           { icon: 'ℹ️', color: '#6366F1', bg: '#EEF2FF', key: 'notifications.types.info', fromKey: 'notifications.from.system' },
};

function getConfig(type) {
  return TYPE_CONFIG[(type || '').toUpperCase()] || TYPE_CONFIG.INFO;
}

function getNotificationLink(n) {
  if (!n) return '/notifications';
  const type = String(n.type || '').toUpperCase();

  if (type.includes('SUSPECT') || type === 'WARN') {
    return '/analyse-suspicion';
  }
  if (type === 'PLAN_ACTION') return '/plan-actions';
  if (type === 'NON_CONFORMITE') return '/non-conformites';
  if (type === 'VALIDATION' || type === 'CHECK' || type === 'REJET') {
    return n.checklistId ? `/validation/${n.checklistId}` : '/validations';
  }
  if (n.checklistId) return `/validation/${n.checklistId}`;
  return '/notifications';
}

/* ─── Bell icon ─────────────────────────────────────────────────────────── */
function IconBell({ count }) {
  return (
    <div style={{ position: 'relative', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -5, right: -6,
          minWidth: 18, height: 18, borderRadius: 9,
          background: '#EF4444', color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px', boxShadow: '0 0 0 2px #fff',
          lineHeight: 1,
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </div>
  );
}

/* ─── Email-style notification item ─────────────────────────────────────── */
function MailItem({ n, onRead, onOpen, locale }) {
  const cfg = getConfig(n.type);
  const { t } = useI18n();

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return t('notifications.time.justNow') || "À l'instant";
    if (diff < 3600000) return t('notifications.time.minutesAgo', { count: Math.floor(diff / 60000) }) || `Il y a ${Math.floor(diff / 60000)} min`;
    if (diff < 86400000) return t('notifications.time.hoursAgo', { count: Math.floor(diff / 3600000) }) || `Il y a ${Math.floor(diff / 3600000)} h`;
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  };

  const handleClick = () => {
    if (!n.lue) onRead(n.id);
    if (onOpen) onOpen(n);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #f0f2f8',
        cursor: 'pointer',
        background: n.lue ? '#fff' : '#f8f9ff',
        transition: 'background 0.15s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!n.lue) e.currentTarget.style.background = '#f0f4ff'; }}
      onMouseLeave={e => { e.currentTarget.style.background = n.lue ? '#fff' : '#f8f9ff'; }}
    >
      {/* Unread indicator strip */}
      <div style={{
        width: 3,
        background: n.lue ? 'transparent' : cfg.color,
        flexShrink: 0,
        borderRadius: '0 2px 2px 0',
        transition: 'background 0.2s',
      }} />

      {/* Sender avatar */}
      <div style={{ padding: '12px 10px 12px 12px', display: 'flex', alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: cfg.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, flexShrink: 0,
          border: `1px solid ${cfg.color}22`,
        }}>
          {cfg.icon}
        </div>
      </div>

      {/* Email content */}
      <div style={{ flex: 1, padding: '12px 14px 12px 0', minWidth: 0 }}>
        {/* FROM + TIME row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
            color: cfg.color, textTransform: 'uppercase',
          }}>
            {t(cfg.fromKey) || cfg.fromKey}
          </span>
          <span style={{ fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', marginLeft: 8 }}>
            {formatTime(n.creeLe)}
          </span>
        </div>

        {/* SUBJECT */}
        <div style={{
          fontSize: 13,
          fontWeight: n.lue ? 500 : 700,
          color: n.lue ? '#666' : '#1a1a2e',
          marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {n.titre || t(cfg.key)}
        </div>

        {/* BODY preview */}
        <div style={{
          fontSize: 12, color: '#888', lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {n.message}
        </div>

        {/* Checklist badge */}
        {n.checklistId && (
          <div style={{ marginTop: 5 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              borderRadius: 10, background: cfg.bg, color: cfg.color,
              border: `1px solid ${cfg.color}33`, letterSpacing: 0.3,
            }}>
              CHECKLIST #{n.checklistId}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── NotificationBell (dropdown) ───────────────────────────────────────── */
export function NotificationBell() {
  const { t, lang } = useI18n();
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.count || 0);
    } catch (e) { /* silencieux */ }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, [loadCount]);

  // Écoute des anomalies reçues en temps réel (dispatch depuis WS)
  useEffect(() => {
    const handler = (e) => {
      try {
        const data = e.detail || {};
        const normalizedStatus = String(data.statut || data.type || 'SUSPECT').toUpperCase();
        const title = normalizedStatus === 'TRES_SUSPECT'
          ? 'Checklist très suspecte détectée'
          : 'Checklist suspecte détectée';
        const newNotif = {
          id: `anom-${Date.now()}`,
          titre: title,
          message: [
            `Checklist #${data.checklistId || '—'}`,
            ...(data.facteurs || []).slice(0, 3),
          ].join(' • '),
          type: normalizedStatus,
          checklistId: data.checklistId,
          creeLe: data.timestamp || new Date().toISOString(),
          lue: false,
        };
        setNotifications(prev => [newNotif, ...(prev || [])]);
        setUnreadCount(prev => (prev || 0) + 1);
      } catch (err) {
        console.error('Error handling anomaly event', err);
      }
    };

    window.addEventListener('anomaly:received', handler);
    return () => window.removeEventListener('anomaly:received', handler);
  }, []);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); }
  };

  const openNotification = (n) => {
    const link = getNotificationLink(n);
    setOpen(false);
    if (link) navigate(link);
  };

  return (
    <div className="nb-dd" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`nb-icon${open ? ' active' : ''}`}
        aria-label="Notifications"
      >
        <IconBell count={unreadCount} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: 400, maxWidth: '95vw',
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid #e8eaf2',
          overflow: 'hidden',
          zIndex: 9999,
          display: 'flex', flexDirection: 'column',
        }}>

          {/* Header — looks like a mail app header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #f0f2f8',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fafbff',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Mail icon */}
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'linear-gradient(135deg, #3B5BF6 0%, #6366F1 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>
                  {t('notifications.title') || 'Notifications'}
                </div>
                {unreadCount > 0 && (
                  <div style={{ fontSize: 11, color: '#3B5BF6', fontWeight: 600 }}>
                    {unreadCount} non lu{unreadCount > 1 ? 'e(s)' : ''}
                  </div>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                style={{
                  fontSize: 11, fontWeight: 600, color: '#3B5BF6',
                  background: '#EEF2FF', border: 'none', borderRadius: 8,
                  padding: '5px 10px', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#dde3ff'}
                onMouseLeave={e => e.currentTarget.style.background = '#EEF2FF'}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid #e8eaf2', borderTopColor: '#3B5BF6',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, color: '#aaa', fontWeight: 500 }}>Aucune notification</div>
              </div>
            ) : (
              notifications.map(n => (
                <MailItem key={n.id} n={n} onRead={markAsRead} onOpen={openNotification} locale={locale} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{
              padding: '10px 18px',
              borderTop: '1px solid #f0f2f8',
              background: '#fafbff',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: '#bbb' }}>
                Total : {notifications.length}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Full NotificationsPage (email inbox style) ─────────────────────────── */
export default function NotificationsPage() {
  const { t, lang } = useI18n();
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [filterLue, setFilterLue] = useState('all');
  const [selected, setSelected] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const markAsRead = async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
    } catch (e) { console.error(e); }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, lue: true })));
    } catch (e) { console.error(e); }
  };

  const filtered = notifications
    .filter(n => filterType === 'all' || (n.type || '').toUpperCase() === filterType.toUpperCase())
    .filter(n => filterLue === 'all' || (filterLue === 'non_lue' ? !n.lue : n.lue))
    .sort((a, b) => new Date(b.creeLe) - new Date(a.creeLe));

  const unread = notifications.filter(n => !n.lue).length;
  const types = [...new Set(notifications.map(n => n.type).filter(Boolean))];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const openNotif = (n) => {
    setSelected(n);
    if (!n.lue) markAsRead(n.id);
  };

  const selectedCfg = selected ? getConfig(selected.type) : null;
  const selectedLink = selected ? getNotificationLink(selected) : null;

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="topbar-title">
            <span style={{ marginRight: 8 }}>📬</span>
            {t('notifications.title') || 'Notifications'}
          </div>
          <div className="topbar-sub">
            {unread > 0
              ? `${unread} message(s) non lu(s)`
              : 'Tout est à jour'}
          </div>
        </div>
        {unread > 0 && (
          <div className="topbar-actions">
            <button type="button" onClick={markAllAsRead} className="btn btn-primary btn-sm">
              Tout marquer comme lu
            </button>
          </div>
        )}
      </div>

      <div className="pbody">
        {/* Two-column mail layout */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* LEFT — list */}
          <div style={{
            flex: selected ? '0 0 380px' : '1',
            minWidth: 0,
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #e8eaf2',
            overflow: 'hidden',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            transition: 'flex 0.2s',
          }}>
            {/* Toolbar */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f0f2f8',
              display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
              background: '#fafbff',
            }}>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="sel"
                style={{ flex: '1 1 160px', minWidth: 120, fontSize: 13 }}
              >
                <option value="all">Tous les types</option>
                {types.map(tp => {
                  const cfg = getConfig(tp);
                  return <option key={tp} value={tp}>{cfg.icon} {cfg.label}</option>;
                })}
              </select>
              <select
                value={filterLue}
                onChange={e => setFilterLue(e.target.value)}
                className="sel"
                style={{ flex: '1 1 140px', minWidth: 110, fontSize: 13 }}
              >
                <option value="all">Tous</option>
                <option value="non_lue">Non lus</option>
                <option value="lue">Lus</option>
              </select>
              <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                {filtered.length} message{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Messages */}
            <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: '3px solid #e8eaf2', borderTopColor: '#3B5BF6',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
                  <div style={{ fontSize: 14, color: '#bbb', fontWeight: 500 }}>Aucun message</div>
                </div>
              ) : (
                filtered.map(n => {
                  const cfg = getConfig(n.type);
                  const isSelected = selected?.id === n.id;
                  const formatTime = (dateStr) => {
                    if (!dateStr) return '';
                    const d = new Date(dateStr);
                    const now = new Date();
                    const diff = now - d;
                    if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
                    if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)} h`;
                    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
                  };
                  return (
                    <div
                      key={n.id}
                      onClick={() => openNotif(n)}
                      style={{
                        display: 'flex', gap: 0,
                        borderBottom: '1px solid #f0f2f8',
                        cursor: 'pointer',
                        background: isSelected ? '#EEF2FF' : (n.lue ? '#fff' : '#f8f9ff'),
                        transition: 'background 0.12s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f4f6ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#EEF2FF' : (n.lue ? '#fff' : '#f8f9ff'); }}
                    >
                      {/* Unread strip */}
                      <div style={{
                        width: 3, flexShrink: 0,
                        background: n.lue ? 'transparent' : cfg.color,
                        borderRadius: '0 2px 2px 0',
                      }} />

                      {/* Avatar */}
                      <div style={{ padding: '12px 10px 12px 12px' }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: 10,
                          background: cfg.bg, fontSize: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `1px solid ${cfg.color}22`,
                        }}>
                          {cfg.icon}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, padding: '12px 14px 12px 0', minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                            {cfg.from}
                          </span>
                          <span style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {formatTime(n.creeLe)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13, fontWeight: n.lue ? 500 : 700,
                          color: n.lue ? '#666' : '#1a1a2e',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          marginBottom: 3,
                        }}>
                          {n.titre}
                        </div>
                        <div style={{
                          fontSize: 11, color: '#999',
                          display: '-webkit-box', WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {n.message}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT — detail pane (email reading pane) */}
          {selected && (
            <div style={{
              flex: 1, minWidth: 0,
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #e8eaf2',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}>
              {/* Email header */}
              <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid #f0f2f8',
                background: '#fafbff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 18, fontWeight: 800, color: '#1a1a2e',
                      lineHeight: 1.3, marginBottom: 12,
                    }}>
                      {selected.titre}
                    </div>
                    {/* From / To / Date meta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[
                        { label: 'De', value: selectedCfg.from },
                        { label: 'À', value: 'Moi' },
                        { label: 'Date', value: formatDate(selected.creeLe) },
                      ].map(row => (
                        <div key={row.label} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                          <span style={{ color: '#aaa', minWidth: 36, fontWeight: 600 }}>{row.label}</span>
                          <span style={{ color: '#555' }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    style={{
                      background: '#f0f2f8', border: 'none', borderRadius: 8,
                      width: 30, height: 30, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#999', fontSize: 16, marginLeft: 12, flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
                {selectedLink && (
                  <button
                    type="button"
                    onClick={() => navigate(selectedLink)}
                    style={{
                      marginTop: 10,
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: '1px solid #e8eaf2',
                      background: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Ouvrir la notification →
                  </button>
                )}
              </div>

              {/* Email body */}
              <div style={{ padding: '28px 28px 24px' }}>
                {/* Type badge */}
                <div style={{ marginBottom: 20 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 20,
                    background: selectedCfg.bg, color: selectedCfg.color,
                    fontSize: 12, fontWeight: 700,
                    border: `1px solid ${selectedCfg.color}33`,
                  }}>
                    {selectedCfg.icon} {selectedCfg.label}
                  </span>
                </div>

                {/* Message */}
                <p style={{
                  fontSize: 15, color: '#333', lineHeight: 1.7,
                  margin: '0 0 24px', whiteSpace: 'pre-wrap',
                }}>
                  {selected.message}
                </p>

                {/* Checklist link badge */}
                {selected.checklistId && (
                  <div style={{
                    padding: '14px 18px',
                    background: selectedCfg.bg,
                    borderRadius: 10,
                    border: `1px solid ${selectedCfg.color}22`,
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 20 }}>📎</span>
                    <div>
                      <div style={{ fontSize: 11, color: '#aaa', fontWeight: 600, textTransform: 'uppercase' }}>Checklist référencée</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: selectedCfg.color }}>
                        #{selected.checklistId}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}