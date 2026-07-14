import { useState, useEffect } from "react";
import { getAllSites, createSite, updateSite, deleteSite } from "../../api";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../context/I18nContext";

const IcoSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoPlus    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
const IcoTrash   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IcoArrow   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoPin     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IcoUser    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>;
const IcoHome    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>;
const IcoFactory = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20h20M4 20V10l6-4v4l6-4v14"/><path d="M10 20v-5h4v5"/></svg>;

const PALETTE = [
  { bg: "#eef6fd", light: "#eef6fd", border: "#b8d8f8", accent: "#0057a8", pill: "#dceefb" },
];

export default function SitesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = ["ADMIN", "PPO"].includes(user?.role);
  const navigate = useNavigate();
  const translate = (v) => v;

  const [sites,    setSites]    = useState([]);
  const [search,   setSearch]   = useState("");
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form,     setForm]     = useState({ nom: "", adresse: "", responsable: "" });
  const [msg,      setMsg]      = useState("");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const res = await getAllSites();
    setSites(Array.isArray(res.data) ? res.data : []);
  };

  const filtered = !search.trim() ? sites : sites.filter(s =>
    s.nom?.toLowerCase().includes(search.toLowerCase()) ||
    s.adresse?.toLowerCase().includes(search.toLowerCase()) ||
    s.responsable?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setForm({ nom: "", adresse: "", responsable: "" }); setModal("create"); };
  const openEdit   = (s) => { setSelected(s); setForm({ nom: s.nom, adresse: s.adresse||"", responsable: s.responsable||"" }); setModal("edit"); };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === "create") await createSite(form);
      else await updateSite(selected.id, form);
      await load(); closeModal();
    } catch (err) { setMsg(err.response?.data || t("common.error")); }
  };

  const handleDelete = async () => {
    await deleteSite(deleteId);
    setDeleteId(null); load();
  };

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .site-card{transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s}
        .site-card:hover{transform:translateY(-4px) !important;box-shadow:0 16px 40px rgba(0,40,80,.13) !important}
        .pag-btn:hover:not(.pag-active){background:var(--l1) !important;border-color:var(--l3) !important;color:var(--l7) !important}
        .nav-btn-admin:hover{opacity:.85;transform:translateY(-1px)}
      `}</style>

      {/* HEADER */}
      <div style={s.topBar}>
        <div style={s.titleBlock}>
          <div style={s.breadcrumb}><IcoPin /><span style={s.bcCurrent}>{t("admin.sites.title")}</span></div>
          <h1 style={s.title}><span style={s.titleIcon}><IcoPin /></span>{t("admin.sites.title")}</h1>
          <p style={s.sub}>
            <span style={s.badge}>{filtered.length}</span>
            {t("admin.sites.subtitle", { count: filtered.length })}
          </p>
        </div>
        <div style={s.actions}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IcoSearch /></span>
            <input style={s.searchInp} placeholder={t("admin.sites.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
          </div>
          {canEdit && (
            <button style={s.btnPrimary} onClick={openCreate}>
              <IcoPlus /> {t("admin.sites.new")}
            </button>
          )}
        </div>
      </div>

      {/* GRILLE */}
      {filtered.length > 0 ? (
        <div style={s.grid}>
          {filtered.map((st, i) => (
            <SiteCard
              key={st.id} site={st} idx={i} canEdit={canEdit}
              t={t} translate={translate}
              onEdit={() => openEdit(st)}
              onDelete={() => setDeleteId(st.id)}
              onNavigate={() => navigate(`/plants?siteId=${st.id}`)}
              animDelay={i * 0.04}
            />
          ))}
          {/* Carte "Ajouter" si admin */}
          {canEdit && (
            <button className="site-card" onClick={openCreate} style={s.addCard}>
              <div style={s.addIcon}><IcoPlus /></div>
              <span style={s.addLabel}>{t("admin.sites.new")}</span>
            </button>
          )}
        </div>
      ) : (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}><IcoPin /></div>
          <p style={s.emptyLabel}>{t("admin.sites.emptyTitle")}</p>
          {search && <p style={s.emptySub}>{t("admin.sites.emptySearch", { term: search })}</p>}
          {search && <button style={s.btnGhost} onClick={() => setSearch("")}>{t("admin.sites.emptyAction")}</button>}
          {!search && canEdit && <button style={s.btnPrimary} onClick={openCreate}><IcoPlus /> {t("admin.sites.new")}</button>}
        </div>
      )}

      {/* MODAL CRÉATION / ÉDITION */}
      {modal && (
        <Modal title={modal === "create" ? t("admin.sites.modal.createTitle") : t("admin.sites.modal.editTitle")} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <Field label={t("admin.sites.modal.name")}>
              <input style={s.input} value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t("admin.sites.placeholders.name")} required />
            </Field>
            <Field label={t("admin.sites.modal.address")}>
              <textarea style={{...s.input, minHeight: 80, resize: "vertical"}} value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={t("admin.sites.placeholders.address")} />
            </Field>
            <Field label={t("admin.sites.modal.manager")}>
              <input style={s.input} value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} placeholder={t("admin.sites.placeholders.manager")} />
            </Field>
            {msg && <div style={s.errMsg}>{msg}</div>}
            <div style={s.modalFooter}>
              <button type="button" style={s.btnCancel} onClick={closeModal}>{t("admin.common.cancel")}</button>
              <button type="submit" style={s.btnPrimary}>{t("admin.common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL SUPPRESSION */}
      {deleteId && (
        <Modal title={t("admin.sites.deleteModal.title")} onClose={() => setDeleteId(null)}>
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <p style={s.deleteText}>
              {t("admin.sites.deleteModal.question")}<br/>
              <span style={s.deleteWarn}>{t("admin.sites.deleteModal.warning")}</span>
            </p>
          </div>
          <div style={s.modalFooter}>
            <button style={s.btnCancel} onClick={() => setDeleteId(null)}>{t("admin.common.cancel")}</button>
            <button style={s.btnDanger} onClick={handleDelete}>{t("admin.common.delete")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SiteCard({ site, idx, canEdit, onEdit, onDelete, onNavigate, t, translate, animDelay }) {
  const pal = PALETTE[idx % PALETTE.length];
  const siteName = translate ? translate(site.nom) : site.nom;
  return (
    <div className="site-card" style={{
      borderRadius: 14,
      border: `1px solid ${pal.border}`,
      background: "#fff",
      display: "flex", flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 2px 10px rgba(0,20,60,.05)",
      animation: `fadeUp .35s ease ${animDelay}s both`,
      borderTop: `3px solid ${pal.accent}`,
    }}>
      {/* Top coloré */}
      <div style={{ padding: "14px 16px 12px", background: pal.bg, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: pal.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <IcoPin />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1a2332", lineHeight: 1.3, fontFamily: "var(--fd)" }}>{siteName}</div>
            <div style={{ fontSize: 10, color: pal.accent, fontWeight: 700 }}>#{site.id}</div>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 5 }}>
            <button style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${pal.border}`, background: "var(--bg-1)", color: pal.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onEdit} title={t("admin.common.edit")}><IcoEdit /></button>
            <button style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onDelete} title={t("admin.common.delete")}><IcoTrash /></button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={sc.infos}>
          {site.adresse ? (
            <div style={sc.infoRow}>
              <span style={{ ...sc.infoIcon, background: pal.bg, color: pal.accent }}><IcoHome /></span>
              <span style={sc.infoText}>{site.adresse}</span>
            </div>
          ) : null}
          {site.responsable ? (
            <div style={sc.infoRow}>
              <span style={{ ...sc.infoIcon, background: pal.bg, color: pal.accent }}><IcoUser /></span>
              <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: pal.bg, color: pal.accent }}>{site.responsable}</span>
            </div>
          ) : null}
          {!site.adresse && !site.responsable && (
            <span style={sc.noInfo}>{t("admin.sites.card.noInfo")}</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${pal.border}`, background: pal.bg, display: "flex", justifyContent: "flex-end" }}>
        <button className="nav-btn-admin" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: pal.accent, color: "#fff", border: "none", borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontSize: 12.5, fontWeight: 700, fontFamily: "var(--fb)", boxShadow: `0 3px 12px ${pal.accent}30`, transition: "all .15s" }} onClick={onNavigate}>
          <IcoFactory /> {t("admin.sites.card.viewPlants")} <IcoArrow />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#3a4a5c", textTransform: "uppercase", letterSpacing: "0.7px" }}>{label}</label>
      {children}
    </div>
  );
}

const sc = {
  card:     { borderRadius: 16, border: "1px solid var(--bd-1)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,20,60,.06)" },
  infos:    { display: "flex", flexDirection: "column", gap: 8, flex: 1 },
  infoRow:  { display: "flex", alignItems: "center", gap: 8 },
  infoIcon: { width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoText: { fontSize: 12.5, color: "#5a6e84", lineHeight: 1.4 },
  noInfo:   { color: "#9aacbe", fontSize: 12, fontStyle: "italic" },
};

const s = {
  page:       { minHeight: "100%" },
  topBar:     { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28, gap: 16, flexWrap: "wrap" },
  titleBlock: {},
  breadcrumb: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--tx-4)", marginBottom: 8 },
  bcCurrent:  { color: "var(--tx-3)", fontWeight: 600 },
  title:      { fontSize: 26, fontWeight: 800, color: "var(--tx-1)", fontFamily: "var(--fd)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 },
  titleIcon:  { width: 34, height: 34, borderRadius: 10, background: "var(--grd-h)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  sub:        { color: "var(--tx-3)", fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8 },
  badge:      { background: "var(--grd-h)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, boxShadow: "var(--sh-blue)" },
  actions:    { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  searchWrap: { display: "flex", alignItems: "center", gap: 8, background: "var(--bg-1)", border: "1.5px solid var(--bd-1)", borderRadius: 10, padding: "0 12px", height: 42, minWidth: 220 },
  searchIcon: { color: "var(--tx-4)", flexShrink: 0, display: "flex" },
  searchInp:  { flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--tx-1)", outline: "none", fontFamily: "var(--fb)" },
  clearBtn:   { border: "none", background: "none", color: "var(--tx-4)", cursor: "pointer", fontSize: 12, padding: 0 },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--grd-h)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13.5, fontFamily: "var(--fb)", boxShadow: "var(--sh-blue)", whiteSpace: "nowrap", transition: "all .15s" },
  btnGhost:   { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", color: "var(--tx-2)", border: "1.5px solid var(--bd-1)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  btnCancel:  { background: "var(--bg-3)", color: "var(--tx-2)", border: "1.5px solid var(--bd-1)", borderRadius: 9, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  btnDanger:  { background: "#dc2626", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  grid:       { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 },
  addCard:    { borderRadius: 16, border: "2px dashed var(--bd-1)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, cursor: "pointer", background: "var(--bg-2)", color: "var(--tx-4)", fontFamily: "var(--fb)", transition: "all .2s" },
  addIcon:    { width: 48, height: 48, borderRadius: 14, border: "2px dashed var(--bd-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx-4)" },
  addLabel:   { fontSize: 13, fontWeight: 600 },
  empty:      { padding: "72px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  emptyIconWrap:{ width: 72, height: 72, borderRadius: "50%", background: "var(--bg-2)", border: "1.5px solid var(--bd-1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx-4)", fontSize: 28 },
  emptyLabel: { fontWeight: 700, color: "var(--tx-2)", fontSize: 16, margin: 0 },
  emptySub:   { fontSize: 13, color: "var(--tx-4)", margin: 0 },
  input:      { width: "100%", padding: "10px 14px", border: "1.5px solid var(--bd-1)", borderRadius: 9, fontSize: 14, boxSizing: "border-box", fontFamily: "var(--fb)", background: "var(--bg-2)", color: "var(--tx-1)", outline: "none" },
  errMsg:     { background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 9, fontSize: 13, marginBottom: 12, border: "1px solid #fecaca" },
  modalFooter:{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  deleteText: { color: "var(--tx-2)", lineHeight: 1.7, marginBottom: 4 },
  deleteWarn: { fontSize: 12, color: "var(--tx-4)", display: "block", marginTop: 4 },
};