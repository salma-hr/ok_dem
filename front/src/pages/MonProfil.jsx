import { useState, useEffect } from "react";
import { getAllUtilisateurs, getMonProfil, updateMonProfil } from "../api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

export default function ProfilePage() {
  const { user, login } = useAuth();
  const { t, lang } = useI18n();

  const [userData, setUserData]       = useState(null);
  const [stats, setStats]             = useState({ total: 0, actifs: 0, inactifs: 0 });
  const [loading, setLoading]         = useState(true);
  const [editSection, setEditSection] = useState(null);
  const [formInfo, setFormInfo]       = useState({ nom: "", email: "" });
  const [formPwd, setFormPwd]         = useState({ newPwd: "", confirm: "" });
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState({ type: "", text: "" });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const res = await getMonProfil();
        const data = res.data;
        setUserData(data);
        setFormInfo({ nom: data.nom || "", email: data.email || "" });
        if (user.role === "ADMIN") {
          const all = await getAllUtilisateurs();
          const list = Array.isArray(all.data) ? all.data : [];
          setStats({
            total:    list.length,
            actifs:   list.filter(u => u.actif).length,
            inactifs: list.filter(u => !u.actif).length,
          });
        }
      } catch {
        setUserData({
          id:        user.id,
          nom:       user.nom,
          matricule: user.matricule,
          role:      { nom: user.role, id: null },
          email:     user.email || "",
          site:      user.site || (user.siteId ? { id: user.siteId, nom: user.siteNom || "" } : null),
          plant:     user.plant || (user.plantId ? { id: user.plantId, nom: user.plantNom || "" } : null),
          segment:   user.segment || (user.segmentId ? { id: user.segmentId, nom: user.segmentNom || "" } : null),
          actif:     true,
          createdAt: null,
        });
        setFormInfo({ nom: user.nom || "", email: user.email || "" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: "", text: "" }), 4000);
  };

  const saveInfo = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await updateMonProfil({ nom: formInfo.nom, email: formInfo.email });
      const updated = res.data;
      setUserData(prev => ({ ...prev, nom: updated.nom, email: updated.email, role: updated.role ?? prev.role }));
      login({
        token:     localStorage.getItem("token"),
        id:        user.id,
        nom:       updated.nom,
        matricule: user.matricule,
        role:      user.role,
        email:     updated.email,
        siteId:    userData?.site?.id ?? user.siteId,
        siteNom:   userData?.site?.nom ?? user.siteNom,
        plantId:   userData?.plant?.id ?? user.plantId,
        plantNom:  userData?.plant?.nom ?? user.plantNom,
        segmentId: userData?.segment?.id ?? user.segmentId,
        segmentNom:userData?.segment?.nom ?? user.segmentNom,
      });
      setEditSection(null);
      showMsg("success", t('profile.personalInfo.successMsg'));
    } catch (err) {
      const errMsg = err.response?.data || err.message || t('profile.personalInfo.errorFallback');
      showMsg("error", errMsg);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (formPwd.newPwd !== formPwd.confirm) {
      showMsg("error", t('profile.security.errorMismatch'));
      return;
    }
    if (formPwd.newPwd.length < 6) {
      showMsg("error", t('profile.security.errorTooShort'));
      return;
    }
    setSaving(true);
    try {
      await updateMonProfil({ nom: userData.nom, email: userData.email, password: formPwd.newPwd });
      setFormPwd({ newPwd: "", confirm: "" });
      setEditSection(null);
      showMsg("success", t('profile.security.successMsg'));
    } catch (err) {
      showMsg("error", err.response?.data || t('profile.security.errorFallback'));
    } finally {
      setSaving(false);
    }
  };

  const initials = (nom) => (nom || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const formatDate = (dt) => {
    if (!dt) return "—";
    const localeByLang = { fr: "fr-FR", en: "en-US", de: "de-DE", ar: "ar-EG" };
    return new Date(dt).toLocaleDateString(localeByLang[lang] || "fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  };

  if (loading) return (
    <div style={s.loadWrap}>
      <div style={s.spinner} />
      <span style={{ color: "#6b7280", marginLeft: 12 }}>{t('profile.loading')}</span>
    </div>
  );

  const d = userData || {};
  const roleNom = d.role?.nom || user.role || t('common.userFallback');
  const isAdmin = (user.role || "").toUpperCase() === "ADMIN";
  const siteNom = d.site?.nom || user.siteNom || "—";
  const plantNom = d.plant?.nom || user.plantNom || "—";
  const segmentNom = d.segment?.nom || user.segmentNom || "—";

  return (
    <div style={s.page}>

      {msg.text && (
        <div style={{ ...s.toast,
          background:  msg.type === "success" ? "#f0fdf4" : "#fef2f2",
          borderColor: msg.type === "success" ? "#bbf7d0" : "#fecaca",
          color:       msg.type === "success" ? "#15803d" : "#dc2626",
        }}>
          {msg.type === "success" ? "✅" : "❌"} {msg.text}
        </div>
      )}

      <div style={s.header}>
        <h1 style={s.pageTitle}>{t('profile.title')}</h1>
        <p style={s.pageSub}>{t('profile.subtitle')}</p>
      </div>

      <div style={s.layout}>

        {/* ══ COLONNE GAUCHE ══ */}
        <div style={s.leftCol}>
          <div style={s.card}>
            <div style={s.avatarWrap}>
              <div style={s.avatar}>{initials(d.nom)}</div>
              <div style={s.avatarBadge}>{roleNom.toUpperCase()}</div>
            </div>
            <div style={s.idName}>{d.nom || "—"}</div>
            <div style={s.idMatricule}>{d.matricule}</div>
            <div style={{ ...s.rolePill, background: "#fef9c3", color: "#854d0e" }}>
              👑 {roleNom}
            </div>
            <div style={s.idDivider} />
            <div style={s.idRow}>
              <span style={s.idRowLabel}>{t('profile.personalInfo.fieldEmail')}</span>
              <span style={s.idRowVal}>{d.email || <em style={{ color: "#9ca3af" }}>{t('profile.emailEmpty')}</em>}</span>
            </div>
            <div style={s.idRow}>
              <span style={s.idRowLabel}>{t('profile.personalInfo.fieldPlant')}</span>
              <span style={s.idRowVal}>{plantNom}</span>
            </div>
            <div style={s.idRow}>
              <span style={s.idRowLabel}>{t('profile.personalInfo.fieldSegment')}</span>
              <span style={s.idRowVal}>{segmentNom}</span>
            </div>
            {isAdmin && (
              <div style={s.idRow}>
                <span style={s.idRowLabel}>{t('profile.personalInfo.fieldSite')}</span>
                <span style={s.idRowVal}>{siteNom}</span>
              </div>
            )}
            <div style={s.idRow}>
              <span style={s.idRowLabel}>{t('profile.system.accountStatus')}</span>
              <span style={{ ...s.statusBadge, background: "#dcfce7", color: "#15803d" }}>{t('profile.statusActive')}</span>
            </div>
            <div style={s.idRow}>
              <span style={s.idRowLabel}>{t('profile.memberSince')}</span>
              <span style={s.idRowVal}>{formatDate(d.createdAt)}</span>
            </div>
          </div>

          {user.role === "ADMIN" && (
            <div style={s.card}>
              <div style={s.cardTitle}>{t('profile.overviewTitle')}</div>
              <div style={s.statsGrid}>
                <div style={{ ...s.statBox, background: "#f0f9ff", borderColor: "#bae6fd" }}>
                  <div style={{ ...s.statNum, color: "#0369a1" }}>{stats.total}</div>
                  <div style={s.statLabel}>{t('profile.stats.users')}</div>
                </div>
                <div style={{ ...s.statBox, background: "#f0fdf4", borderColor: "#bbf7d0" }}>
                  <div style={{ ...s.statNum, color: "#15803d" }}>{stats.actifs}</div>
                  <div style={s.statLabel}>{t('profile.stats.active')}</div>
                </div>
                <div style={{ ...s.statBox, background: "#fef2f2", borderColor: "#fecaca" }}>
                  <div style={{ ...s.statNum, color: "#dc2626" }}>{stats.inactifs}</div>
                  <div style={s.statLabel}>{t('profile.stats.inactive')}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══ COLONNE DROITE ══ */}
        <div style={s.rightCol}>

          {/* Informations personnelles */}
          <div style={s.card}>
            <div style={s.sectionHeader}>
              <div>
                <div style={s.cardTitle}>{t('profile.personalInfo.title')}</div>
                <div style={s.cardSub}>{t('profile.personalInfo.subtitle')}</div>
              </div>
              {editSection !== "info" && (
                <button style={s.editBtn} onClick={() => setEditSection("info")}>{t('profile.personalInfo.editBtn')}</button>
              )}
            </div>

            {editSection === "info" ? (
              <form onSubmit={saveInfo}>
                <div style={s.formGrid}>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.personalInfo.fullNameLabel')}</label>
                    <input style={s.input} value={formInfo.nom}
                      onChange={e => setFormInfo({ ...formInfo, nom: e.target.value })}
                      placeholder={t('profile.personalInfo.fullNamePlaceholder')} required />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>{t('profile.personalInfo.emailLabel')}</label>
                    <input style={s.input} type="email" value={formInfo.email}
                      onChange={e => setFormInfo({ ...formInfo, email: e.target.value })}
                      placeholder={t('profile.personalInfo.emailPlaceholder')} />
                  </div>
                </div>
                <div style={s.formActions}>
                  <button type="button" style={s.cancelBtn}
                    onClick={() => { setEditSection(null); setFormInfo({ nom: d.nom, email: d.email || "" }); }}>
                    {t('profile.personalInfo.cancelBtn')}
                  </button>
                  <button type="submit" style={s.saveBtn} disabled={saving}>
                    {saving ? t('profile.personalInfo.savingBtn') : t('profile.personalInfo.saveBtn')}
                  </button>
                </div>
              </form>
            ) : (
              <div style={s.infoGrid}>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldFullName')}</div>
                  <div style={s.infoVal}>{d.nom || "—"}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldMatricule')}</div>
                  <div style={{ ...s.infoVal, fontFamily: "monospace", color: "#0f1923", fontWeight: 700 }}>
                    {d.matricule}
                  </div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldEmail')}</div>
                  <div style={s.infoVal}>{d.email || <em style={{ color: "#9ca3af" }}>{t('profile.emailEmpty')}</em>}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldRole')}</div>
                  <div style={s.infoVal}>{roleNom}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldPlant')}</div>
                  <div style={s.infoVal}>{plantNom}</div>
                </div>
                <div style={s.infoItem}>
                  <div style={s.infoLabel}>{t('profile.personalInfo.fieldSegment')}</div>
                  <div style={s.infoVal}>{segmentNom}</div>
                </div>
                {isAdmin && (
                  <div style={s.infoItem}>
                    <div style={s.infoLabel}>{t('profile.personalInfo.fieldSite')}</div>
                    <div style={s.infoVal}>{siteNom}</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sécurité */}
          <div style={s.card}>
            <div style={s.sectionHeader}>
              <div>
                <div style={s.cardTitle}>{t('profile.security.title')}</div>
                <div style={s.cardSub}>{t('profile.security.subtitle')}</div>
              </div>
              {editSection !== "password" && (
                <button style={s.editBtn} onClick={() => setEditSection("password")}>{t('profile.security.editBtn')}</button>
              )}
            </div>

            {editSection === "password" ? (
              <form onSubmit={savePassword}>
                <div style={s.field}>
                  <label style={s.label}>{t('profile.security.newPwdLabel')}</label>
                  <input style={s.input} type="password" value={formPwd.newPwd}
                    onChange={e => setFormPwd({ ...formPwd, newPwd: e.target.value })}
                    placeholder={t('profile.security.newPwdPlaceholder')} required />
                  {formPwd.newPwd && (
                    <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2,
                          background: formPwd.newPwd.length >= i * 3
                            ? (formPwd.newPwd.length >= 10 ? "#22c55e" : formPwd.newPwd.length >= 6 ? "#f59e0b" : "#ef4444")
                            : "#e5e7eb" }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={s.field}>
                  <label style={s.label}>{t('profile.security.confirmPwdLabel')}</label>
                  <input style={{ ...s.input,
                    borderColor: formPwd.confirm && formPwd.confirm !== formPwd.newPwd ? "#ef4444" : "#e5e7eb" }}
                    type="password" value={formPwd.confirm}
                    onChange={e => setFormPwd({ ...formPwd, confirm: e.target.value })}
                    placeholder={t('profile.security.confirmPwdPlaceholder')} required />
                  {formPwd.confirm && formPwd.confirm !== formPwd.newPwd && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#ef4444" }}>
                      {t('profile.security.pwdMismatch')}
                    </div>
                  )}
                </div>
                <div style={s.formActions}>
                  <button type="button" style={s.cancelBtn}
                    onClick={() => { setEditSection(null); setFormPwd({ newPwd: "", confirm: "" }); }}>
                    {t('profile.security.cancelBtn')}
                  </button>
                  <button type="submit" style={s.saveBtn} disabled={saving}>
                    {saving ? t('profile.security.savingBtn') : t('profile.security.saveBtn')}
                  </button>
                </div>
              </form>
            ) : (
              <div style={s.pwdInfo}>
                <div style={s.pwdIcon}>🛡️</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#0f1923" }}>{t('profile.security.pwdDefined')}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {t('profile.security.pwdHidden')}
                  </div>
                </div>
              </div>
            )}
          </div>

          

        </div>
      </div>
    </div>
  );
}

const s = {
  page:          { padding: "32px 36px", fontFamily: "'DM Sans', sans-serif", maxWidth: 1100, margin: "0 auto" },
  loadWrap:      { display: "flex", alignItems: "center", justifyContent: "center", height: 300 },
  spinner:       { width: 24, height: 24, border: "3px solid #e5e7eb", borderTopColor: "#0f1923", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  toast:         { position: "fixed", top: 24, right: 24, padding: "12px 20px", borderRadius: 10, border: "1.5px solid", fontSize: 14, fontWeight: 600, zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,0.1)" },
  header:        { marginBottom: 28 },
  pageTitle:     { fontSize: 26, fontWeight: 800, color: "#0f1923", margin: 0 },
  pageSub:       { fontSize: 14, color: "#6b7280", marginTop: 4 },
  layout:        { display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" },
  leftCol:       { display: "flex", flexDirection: "column", gap: 20 },
  rightCol:      { display: "flex", flexDirection: "column", gap: 20 },
  card:          { background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #f0f0f0" },
  avatarWrap:    { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 16, position: "relative" },
  avatar:        { width: 80, height: 80, borderRadius: "50%", background: "#1e6dbb", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, marginBottom: 8 },
  avatarBadge:   { position: "absolute", top: 56, right: "calc(50% - 48px)", background: "#ffffff", color: "#0f1923", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, letterSpacing: 1 , borderColor: "#1e6dbb", borderWidth: 1, borderStyle: "solid" },
  idName:        { textAlign: "center", fontWeight: 800, fontSize: 18, color: "#0f1923", marginBottom: 4 },
  idMatricule:   { textAlign: "center", fontSize: 13, color: "#6b7280", fontFamily: "monospace", marginBottom: 10 },
  rolePill:      { display: "inline-flex", alignSelf: "center", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, margin: "0 auto 16px" },
  idDivider:     { height: 1, background: "#f0f0f0", margin: "0 0 16px" },
  idRow:         { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 13 },
  idRowLabel:    { color: "#9ca3af", fontWeight: 600 },
  idRowVal:      { color: "#374151", fontWeight: 600, textAlign: "right", maxWidth: 160, wordBreak: "break-all" },
  statusBadge:   { padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 },
  cardTitle:     { fontSize: 15, fontWeight: 700, color: "#0f1923", marginBottom: 4 },
  cardSub:       { fontSize: 13, color: "#9ca3af", marginBottom: 16 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  editBtn:       { padding: "7px 16px", background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151", whiteSpace: "nowrap" },
  infoGrid:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  infoItem:      { padding: "12px 14px", background: "#f8fafc", borderRadius: 8 },
  infoLabel:     { fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoVal:       { fontSize: 14, fontWeight: 600, color: "#374151" },
  formGrid:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  field:         { marginBottom: 16 },
  label:         { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input:         { width: "100%", padding: "10px 13px", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  formActions:   { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn:     { padding: "9px 18px", background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#374151" },
  saveBtn:       { padding: "9px 18px", background: "#0f1923", color: "#e8b84b", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
  pwdInfo:       { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e7eb" },
  pwdIcon:       { fontSize: 28 },
  statsGrid:     { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 },
  statBox:       { padding: "12px", borderRadius: 8, border: "1.5px solid", textAlign: "center" },
  statNum:       { fontSize: 24, fontWeight: 800 },
  statLabel:     { fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 2 },
};
