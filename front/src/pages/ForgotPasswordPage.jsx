import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordApi } from '../api';
import { useI18n } from '../context/I18nContext';

function AuthShell({ children }) {
  const { t } = useI18n();
  return (
    <div style={{ display:'flex', minHeight:'100vh', fontFamily:'var(--fb)' }}>
      <div style={{ flex:1, background:'linear-gradient(135deg,#001428 0%,#002952 55%,#0057a8 100%)', display:'flex', alignItems:'center', justifyContent:'center', padding:'48px 56px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at 70% 30%,rgba(26,111,196,0.3) 0%,transparent 60%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', right:-80, top:-80, width:320, height:320, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.04)' }} />
        <div style={{ maxWidth:400, position:'relative', zIndex:1, color:'white' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:40 }}>
            <div style={{ width:52, height:52, borderRadius:14, background:'linear-gradient(135deg,#1a6fc4,#3d8fd8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, fontWeight:900, fontFamily:'var(--fd)' }}>L</div>
            <div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:22, letterSpacing:3 }}>{t('brand.name')}</div>
              <div style={{ fontSize:10, opacity:.45, letterSpacing:2, textTransform:'uppercase' }}>{t('brand.tagline')}</div>
            </div>
          </div>
          <div style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:38, lineHeight:1.15, marginBottom:14 }}>
            {t('login.hero.titleLine1')}<br />
            <span style={{ background:'linear-gradient(90deg,#fbbf24,#f59e0b)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {t('login.hero.titleLine2')}
            </span>
          </div>
          <p style={{ fontSize:14, opacity:.6, lineHeight:1.7, maxWidth:340 }}>
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

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [matricule, setMatricule] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPasswordApi(matricule);
      setSent(true);
    } catch (err) {
      if (err.response) {
        setSent(true);
      } else {
        setError(t('forgotPassword.errorServer'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {sent ? (
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:52, marginBottom:16 }}>📧</div>
          <h2 style={{ fontFamily:'var(--fd)', fontWeight:900, fontSize:22, marginBottom:12 }}>{t('forgotPassword.sentTitle')}</h2>
          <p className="t-sm t-muted" style={{ lineHeight:1.7, marginBottom:24 }}>
            {t('forgotPassword.sentMessage')} <strong>{t('forgotPassword.sentHours')}</strong>.
          </p>
          <p className="t-xs t-muted" style={{ marginBottom:24 }}>{t('forgotPassword.sentSpam')}</p>
          <Link to="/login" className="btn btn-success">{t('forgotPassword.backToLogin')}</Link>
        </div>
      ) : (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:26 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:'var(--l0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🔑</div>
            <div>
              <div style={{ fontFamily:'var(--fd)', fontWeight:800, fontSize:17 }}>{t('forgotPassword.title')}</div>
              <div className="t-sm t-muted">{t('forgotPassword.subtitle')}</div>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="lbl">{t('forgotPassword.matriculeLabel')}</label>
              <input className="inp" value={matricule} onChange={e => setMatricule(e.target.value)}
                placeholder={t('forgotPassword.matriculePlaceholder')} required />
            </div>
            {error && <div className="alert alert-danger" style={{ marginBottom:16 }}>⚠ {error}</div>}
            <button type="submit" className="btn btn-primary btn-fw btn-lg"
              disabled={loading} style={{ opacity:loading ? 0.75 : 1 }}>
              {loading ? t('forgotPassword.submitLoading') : t('forgotPassword.submitBtn')}
            </button>
          </form>
          <div style={{ marginTop:22, textAlign:'center' }}>
            <Link to="/login" className="t-sm fw6" style={{ color:'var(--tx-2)' }}>{t('forgotPassword.backToLogin')}</Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
