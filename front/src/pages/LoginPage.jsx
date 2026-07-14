import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi } from '../api';
import { useI18n } from '../context/I18nContext';

const REDIRECT = {
  ADMIN:                  '/dashboard-advanced',
  ADMIN_PLANT:            '/dashboard-advanced',
  PPO:                    '/dashboard-advanced',
  OPERATEUR:              '/checklist/operateur',
  CHEF_LIGNE:             '/checklist',
  AGENT_QUALITE:          '/checklist',
  RESPONSABLE_PRODUCTION: '/checklist',
  TECHNICIEN:             '/checklist',
};

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const [matricule, setMatricule] = useState('');
  const [password,  setPassword]  = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const titleLine1 = t('login.hero.titleLine1')?.trim();
  const titleLine2 = t('login.hero.titleLine2')?.trim();

  // Redirect si déjà connecté
  useEffect(() => {
    if (user) {
      navigate(REDIRECT[user.role] || '/dashboard-advanced', { replace: true });
    }
  }, [user, navigate]);

  const getLoginErrorMessage = (err) => {
    const data = err?.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      for (const key of ['message', 'erreur', 'error', 'detail', 'title']) {
        if (typeof data[key] === 'string' && data[key].trim()) return data[key];
      }
    }
    return t('login.errors.invalid') || "Identifiants incorrects";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await loginApi(matricule, password);
      flushSync(() => login(res.data));
      const destination = REDIRECT[res.data.role] || '/dashboard-advanced';
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--fb)' }}>

      {/* Partie gauche - Visuel */}
      <div style={{
        flex: '0 0 40%',
        minWidth: 500,
        maxWidth: 1500,
        background: 'linear-gradient(135deg,#001428 0%,#002952 55%,#0057a8 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Décorations */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%,rgba(26,111,196,0.3) 0%,transparent 60%),radial-gradient(ellipse at 20% 80%,rgba(245,158,11,0.08) 0%,transparent 50%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 360, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#1a6fc4,#3d8fd8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,87,168,0.5)', fontSize: 22, fontWeight: 900, color: 'white' }}>
              L
            </div>
            <div>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: 3 }}>LEONI</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase' }}>WIRING SYSTEMS</div>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 34, lineHeight: 1.15, color: '#fff', marginBottom: 14 }}>
            {titleLine1 && <>{titleLine1}<br /></>}
            {titleLine2}
          </div>

          {/* LTPM Palette Card - Left Side */}
          <div style={{ marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            {/* JAUNE - left, smaller */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#ca8a04',
              boxShadow: '0 3px 12px rgba(202, 138, 4, 0.4)',
            }} />
            
            {/* Central VERT card with label */}
            <div style={{
              width: 80,
              height: 80,
              borderRadius: 14,
              background: '#16a34a',
              boxShadow: '0 6px 20px rgba(22, 163, 74, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--fd)',
              fontWeight: 900,
              fontSize: 14,
              color: '#fff',
              letterSpacing: 1.5,
            }}>
              LTPM
            </div>
            
            {/* ROUGE - right, smaller */}
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#dc2626',
              boxShadow: '0 3px 12px rgba(220, 38, 38, 0.4)',
            }} />
          </div>
        </div>
      </div>

      {/* Partie droite - Formulaire */}
      <div style={{ flex: '1 1 60%', minWidth: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '56px 48px', background: 'var(--bg-app)' }}>
        <div style={{ background: 'var(--bg-1)', borderRadius: 24, padding: 48, width: 'min(560px, 100%)', boxShadow: '0 24px 60px rgba(15,23,42,0.14)', border: '1px solid rgba(15,23,42,0.08)' }}>

          <div style={{ height: 5, background: 'linear-gradient(90deg,#001428,#1a6fc4,#3d8fd8)', borderRadius: 3, marginBottom: 28 }} />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <div className="nb-lang" role="group">
              <button className={`nb-lang-btn ${lang === 'fr' ? 'active' : ''}`} onClick={() => setLang('fr')}>FR</button>
              <button className={`nb-lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
              <button className={`nb-lang-btn ${lang === 'ar' ? 'active' : ''}`} onClick={() => setLang('ar')}>AR</button>
              <button className={`nb-lang-btn ${lang === 'de' ? 'active' : ''}`} onClick={() => setLang('de')}>DE</button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--l0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>👤</div>
            <div>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 18 }}>{t('login.form.title')}</div>
              <div className="t-sm t-muted">{t('login.form.subtitle')}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="lbl">{t('login.form.matriculeLabel')}</label>
              <input className="inp" value={matricule} onChange={e => setMatricule(e.target.value)}
                placeholder={t('login.form.matriculePlaceholder')} required />
            </div>

            <div className="field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <label className="lbl" style={{ margin: 0 }}>{t('login.form.passwordLabel')}</label>
                <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--l6)', fontWeight: 600 }}>
                  {t('login.form.passwordForgot')}
                </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input className="inp" type={showPwd ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ paddingRight: 40 }} placeholder={t('login.form.passwordPlaceholder')} required />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tx-4)', fontSize: 16 }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠ {error}</div>}

            <button type="submit" className="btn btn-primary btn-fw btn-lg" disabled={loading}>
              {loading ? t('login.form.loading') : t('login.form.submit')}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--bd-1)' }} />
            <span className="t-sm t-muted">{t('login.form.divider') || "OU"}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--bd-1)' }} />
          </div>

          {/* Bouton S'inscrire */}
          <Link to="/register" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost btn-fw" style={{ fontWeight: 600, padding: '14px 0' }}>
              {t('login.form.register')}
            </button>
          </Link>

          <p className="t-xs t-muted" style={{ textAlign: 'center', marginTop: 24 }}>
            {t('login.form.footerSecure')}
          </p>
        </div>
      </div>
    </div>
  );
}