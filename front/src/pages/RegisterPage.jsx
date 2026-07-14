import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerApi, getRolesPublic, getAllSites, getPlantsBySite } from '../api';
import { useI18n } from '../context/I18nContext';

export default function RegisterPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    nom: '', matricule: '', email: '', password: '', confirmPassword: '', roleId: '',
    siteId: '', plantId: '',
  });
  const [roles,   setRoles]   = useState([]);
  const [sites,   setSites]   = useState([]);
  const [plants,  setPlants]  = useState([]);
  const [loadingSites,  setLoadingSites]  = useState(false);
  const [loadingPlants, setLoadingPlants] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Fetch roles
  useEffect(() => {
    getRolesPublic()
      .then(r => setRoles(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRoles([]));
  }, []);

  // Fetch sites (public endpoint – see SecurityConfig note)
  useEffect(() => {
    setLoadingSites(true);
    getAllSites()
      .then(r => setSites(Array.isArray(r.data) ? r.data : []))
      .catch(() => setSites([]))
      .finally(() => setLoadingSites(false));
  }, []);

  // Fetch plants when site changes
  useEffect(() => {
    if (!form.siteId) { setPlants([]); return; }
    setLoadingPlants(true);
    getPlantsBySite(form.siteId)
      .then(r => setPlants(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPlants([]))
      .finally(() => setLoadingPlants(false));
  }, [form.siteId]);

  const set = (e) => {
    const { name, value } = e.target;
    // Reset plantId when site changes
    if (name === 'siteId') {
      setForm(prev => ({ ...prev, siteId: value, plantId: '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) { setError(t('register.errorMismatch')); return; }
    if (form.password.length < 6) { setError(t('register.errorTooShort')); return; }
    setLoading(true);
    try {
      await registerApi({
        nom: form.nom,
        matricule: form.matricule,
        email: form.email,
        password: form.password,
        roleId: Number(form.roleId),
        siteId: form.siteId ? Number(form.siteId) : null,
        plantId: form.plantId ? Number(form.plantId) : null,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data || t('register.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  /* ─── styles ─────────────────────────────────────── */
  const dividerStyle = {
    display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 6px',
  };
  const dividerLineStyle = {
    flex: 1, height: 1, background: 'var(--bd-1)',
  };
  const dividerLabelStyle = {
    fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
    textTransform: 'uppercase', color: 'var(--tx-3)',
    padding: '0 6px',
  };
  const rowStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--fb)' }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg,#001428 0%,#002952 55%,#0057a8 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%,rgba(26,111,196,0.3) 0%,transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 400, position: 'relative', zIndex: 1 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 40 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#1a6fc4,#3d8fd8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, fontFamily: 'var(--fd)', color: 'white' }}>L</div>
            <div>
              <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: 3 }}>{t('brand.name')}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase' }}>{t('brand.tagline')}</div>
            </div>
          </div>
          {/* Hero title */}
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 38, lineHeight: 1.15, color: '#fff', marginBottom: 14 }}>
            {t('register.heroTitle1')}<br />
            <span style={{ background: 'linear-gradient(90deg,#fbbf24,#f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('register.heroTitle2')}</span>
          </div>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 36 }}>
            {t('register.heroSubtitle')}
          </p>
          
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{ width: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg-app)', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-1)', borderRadius: 20, padding: 40, width: '100%', boxShadow: 'var(--sh-lg)', border: '1px solid var(--bd-1)' }}>
          <div style={{ height: 4, background: 'linear-gradient(90deg,#001428,#1a6fc4,#3d8fd8)', borderRadius: 2, marginBottom: 28 }} />

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <h2 style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>{t('register.successTitle')}</h2>
              <p className="t-sm t-muted" style={{ marginBottom: 24, lineHeight: 1.6 }}>
                {t('register.successMessage')}
              </p>
              <div className="alert alert-success">{t('register.successRedirect')}</div>
            </div>
          ) : (
            <>
              {/* Form header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--l0)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>➕</div>
                <div>
                  <div style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 17 }}>{t('register.formTitle')}</div>
                  <div className="t-sm t-muted">{t('register.formSubtitle')}</div>
                </div>
              </div>

              <form onSubmit={handleSubmit}>

                {/* ── Section : Informations personnelles ── */}
                <div style={dividerStyle}>
                  <div style={dividerLineStyle} />
                  <span style={dividerLabelStyle}>Informations personnelles</span>
                  <div style={dividerLineStyle} />
                </div>

                <div className="field">
                  <label className="lbl">{t('register.fullNameLabel')}</label>
                  <input className="inp" name="nom" value={form.nom} onChange={set} placeholder={t('register.fullNamePlaceholder')} required />
                </div>

                <div style={rowStyle}>
                  <div className="field">
                    <label className="lbl">{t('register.matriculeLabel')}</label>
                    <input className="inp" name="matricule" value={form.matricule} onChange={set} placeholder={t('register.matriculePlaceholder')} required />
                  </div>
                  <div className="field">
                    <label className="lbl">{t('register.emailLabel')}</label>
                    <input className="inp" name="email" type="email" value={form.email} onChange={set} placeholder={t('register.emailPlaceholder')} required />
                  </div>
                </div>

                <div className="field">
                  <label className="lbl">{t('register.roleLabel')}</label>
                  {roles.length > 0 ? (
                    <select className="sel" name="roleId" value={form.roleId} onChange={set} required>
                      <option value="">{t('register.rolePlaceholder')}</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                    </select>
                  ) : (
                    <input className="inp" name="roleId" value={form.roleId} onChange={set} placeholder={t('register.roleInputPlaceholder')} required />
                  )}
                </div>

                {/* ── Section : Affectation Site / Plant ── */}
                <div style={dividerStyle}>
                  <div style={dividerLineStyle} />
                  <span style={dividerLabelStyle}>Affectation site &amp; plant</span>
                  <div style={dividerLineStyle} />
                </div>

                <div style={rowStyle}>
                  {/* Site */}
                  <div className="field">
                    <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏢</span> Site
                    </label>
                    {loadingSites ? (
                      <div className="inp" style={{ display: 'flex', alignItems: 'center', color: 'var(--tx-3)', fontSize: 13, cursor: 'default' }}>
                        <span style={{ marginRight: 6 }}>⏳</span> Chargement…
                      </div>
                    ) : (
                      <select className="sel" name="siteId" value={form.siteId} onChange={set}>
                        <option value="">-- Choisir un site --</option>
                        {sites.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                      </select>
                    )}
                  </div>

                  {/* Plant */}
                  <div className="field">
                    <label className="lbl" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🏭</span> Plant
                    </label>
                    {loadingPlants ? (
                      <div className="inp" style={{ display: 'flex', alignItems: 'center', color: 'var(--tx-3)', fontSize: 13, cursor: 'default' }}>
                        <span style={{ marginRight: 6 }}>⏳</span> Chargement…
                      </div>
                    ) : (
                      <select
                        className="sel"
                        name="plantId"
                        value={form.plantId}
                        onChange={set}
                        disabled={!form.siteId || plants.length === 0}
                        style={{ opacity: !form.siteId ? 0.5 : 1 }}
                      >
                        <option value="">
                          {!form.siteId
                            ? '← Choisir un site d\'abord'
                            : plants.length === 0
                              ? 'Aucun plant disponible'
                              : '-- Choisir un plant --'}
                        </option>
                        {plants.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                      </select>
                    )}
                  </div>
                </div>

                

                {/* ── Section : Sécurité ── */}
                <div style={dividerStyle}>
                  <div style={dividerLineStyle} />
                  <span style={dividerLabelStyle}>Sécurité</span>
                  <div style={dividerLineStyle} />
                </div>

                <div style={rowStyle}>
                  <div className="field">
                    <label className="lbl">{t('register.passwordLabel')}</label>
                    <input className="inp" type="password" name="password" value={form.password} onChange={set} placeholder={t('register.passwordPlaceholder')} required />
                  </div>
                  <div className="field">
                    <label className="lbl">{t('register.confirmPasswordLabel')}</label>
                    <input className="inp" type="password" name="confirmPassword" value={form.confirmPassword} onChange={set}
                      style={{ borderColor: form.confirmPassword && form.confirmPassword !== form.password ? 'var(--r5)' : '' }}
                      placeholder="••••••••" required />
                    {form.confirmPassword && form.confirmPassword !== form.password && (
                      <div className="t-xs" style={{ marginTop: 5, color: 'var(--r6)' }}>{t('register.passwordMismatch')}</div>
                    )}
                  </div>
                </div>

                {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>⚠ {error}</div>}

                <button type="submit" className="btn btn-primary btn-fw btn-lg"
                  disabled={loading} style={{ opacity: loading ? 0.75 : 1, marginTop: 8 }}>
                  {loading ? t('register.submitLoading') : t('register.submitBtn')}
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center' }} className="t-sm t-muted">
                {t('register.alreadyAccount')}{' '}
                <Link to="/login" style={{ color: 'var(--l6)', fontWeight: 700 }}>{t('register.loginLink')}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}