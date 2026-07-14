import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPasswordApi } from '../api';
import { useI18n } from '../context/I18nContext';

function AuthShell({ children }) {
  const { t } = useI18n();
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--fb)' }}>
      <div style={{ flex:1, background:'linear-gradient(135deg,#001428 0%,#002952 55%,#0057a8 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 56px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 70% 30%,rgba(26,111,196,0.3) 0%,transparent 60%)', pointerEvents:'none' }} />
        <div style={{ maxWidth:400, position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:40 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#1a6fc4,#3d8fd8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, fontFamily:'var(--fd)', color:'white' }}>L</div>
            <div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:22, color:'#fff', letterSpacing:3 }}>{t('brand.name')}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', letterSpacing:2, textTransform:'uppercase' }}>{t('brand.tagline')}</div>
            </div>
          </div>
          <div style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:38, lineHeight:1.15, color:'#fff', marginBottom:14 }}>
            {t('login.hero.titleLine1')}<br />
            <span style={{ background:'linear-gradient(90deg,#fbbf24,#f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{t('login.hero.titleLine2')}</span>
          </div>
          <p style={{ fontSize:14, color:'rgba(255,255,255,0.6)', lineHeight:1.7 }}>
            {t('login.hero.subtitle')}
          </p>
        </div>
      </div>
      <div style={{ width:480, display:'flex', alignItems:'center', justifyContent:'center', padding:40, background:'var(--bg-app)' }}>
        <div style={{ background:'var(--bg-1)', borderRadius:20, padding:40, width:'100%', boxShadow:'var(--sh-lg)', border:'1px solid var(--bd-1)' }}>
          <div style={{ height:4, background:'linear-gradient(90deg,#001428,#1a6fc4,#3d8fd8)', borderRadius:2, marginBottom:30 }} />
          {children}
        </div>
      </div>
    </div>
  );
}

const strengthColor = (len) => len >= 10 ? '#22c55e' : len >= 6 ? '#f59e0b' : '#ef4444';

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const navigate = useNavigate();

  if (!token) return (
    <AuthShell>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:52, marginBottom:16 }}>⚠️</div>
        <h2 style={{ fontFamily:'var(--fd)', fontWeight:900, color:'var(--r6)', marginBottom:8 }}>{t('resetPassword.invalidTitle')}</h2>
        <p className="t-sm t-muted" style={{ marginBottom:24 }}>{t('resetPassword.invalidMessage')}</p>
        <Link to="/forgot-password" className="btn btn-primary">{t('resetPassword.newRequestBtn')}</Link>
      </div>
    </AuthShell>
  );

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError(t('resetPassword.errorMismatch')); return; }
    if (password.length < 6)  { setError(t('resetPassword.errorTooShort')); return; }
    setLoading(true);
    try {
      await resetPasswordApi(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) { setError(err.response?.data || t('resetPassword.errorInvalidLink')); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell>
      {success ? (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
          <h2 style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:22, marginBottom:8 }}>{t('resetPassword.successTitle')}</h2>
          <p className="t-sm t-muted" style={{ lineHeight:1.7, marginBottom:24 }}>
            {t('resetPassword.successMessage')}<br />{t('resetPassword.redirecting')}
          </p>
          <div className="alert alert-success">{t('resetPassword.redirectingAlert')}</div>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:26 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'var(--l0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔒</div>
            <div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:17 }}>{t('resetPassword.formTitle')}</div>
              <div className="t-sm t-muted">{t('resetPassword.formSubtitle')}</div>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="lbl">{t('resetPassword.newPasswordLabel')}</label>
              <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={t('resetPassword.newPasswordPlaceholder')} required />
              {password && (
                <div style={{ display:'flex', gap:4, marginTop:6 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, background: password.length >= i*3 ? strengthColor(password.length) : 'var(--gr2)' }} />
                  ))}
                </div>
              )}
            </div>
            <div className="field">
              <label className="lbl">{t('resetPassword.confirmPasswordLabel')}</label>
              <input className="inp" type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ borderColor: confirm && confirm !== password ? 'var(--r5)' : '' }}
                placeholder="••••••••" required />
              {confirm && confirm !== password && <div className="t-xs" style={{ marginTop:5, color:'var(--r6)' }}>{t('resetPassword.errorMismatch')}</div>}
            </div>
            {error && <div className="alert alert-danger" style={{ marginBottom:16 }}>⚠ {error}</div>}
            <button type="submit" className="btn btn-primary btn-fw btn-lg"
              disabled={loading} style={{ opacity:loading ? 0.75 : 1 }}>
              {loading ? t('resetPassword.submitLoading') : t('resetPassword.submitBtn')}
            </button>
          </form>
          <div style={{ marginTop:22, textAlign:'center' }}>
            <Link to="/login" className="t-sm fw6" style={{ color:'var(--tx-2)' }}>{t('resetPassword.backToLogin')}</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
