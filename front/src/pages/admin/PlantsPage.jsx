import { useState, useEffect } from "react";
import { getAllPlants, getAllSites, createPlant, updatePlant, deletePlant } from "../../api";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../context/I18nContext";
import Pagination, { usePagination } from "../../components/Pagination";

const IcoSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoPlus    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
const IcoTrash   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IcoArrow   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoChevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoFactory = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20h20M4 20V10l6-4v4l6-4v14"/><path d="M10 20v-5h4v5"/></svg>;
const IcoGrid    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoPin     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>;
const IcoProcess = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v3a6 6 0 006 6h3"/><polyline points="15,15 18,15 18,12"/></svg>;

const SITE_COLORS = [
  { bg:"#eef6fd", accent:"#0057a8", border:"#b8d8f8", pill:"#dceefb" },
  { bg:"#f0fdfa", accent:"#0d9488", border:"#99f6e4", pill:"#ccfbf1" },
  { bg:"#faf5ff", accent:"#7c3aed", border:"#d8b4fe", pill:"#f3e8ff" },
  { bg:"#fff7ed", accent:"#c2410c", border:"#fdba74", pill:"#ffedd5" },
  { bg:"#f0fdf4", accent:"#15803d", border:"#86efac", pill:"#dcfce7" },
  { bg:"#fffbeb", accent:"#b45309", border:"#fde68a", pill:"#fef9c3" },
];

const PAGE_SIZE = 12;

export default function PlantsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = ["ADMIN", "PPO"].includes(user?.role);
  const isAdmin = user?.role === "ADMIN";
  const isPPO   = user?.role === "PPO";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteIdParam = searchParams.get("siteId");
  const translate = (v) => v;

  const [allPlants, setAllPlants] = useState([]);
  const [sites,     setSites]     = useState([]);
  const [filter,    setFilter]    = useState(siteIdParam || "");
  const [search,    setSearch]    = useState("");
  const [modal,     setModal]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [deleteId,  setDeleteId]  = useState(null);
  const [form,      setForm]      = useState({ nom: "", description: "", siteId: "" });
  const [msg,       setMsg]       = useState("");

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    const [p, st] = await Promise.all([getAllPlants(), getAllSites()]);
    setAllPlants(Array.isArray(p.data) ? p.data : []);
    setSites(Array.isArray(st.data) ? st.data : []);
  };

  const filtered = allPlants
    .filter(p => !filter || String(p.siteId) === filter)
    .filter(p => !search.trim() || p.nom?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()));

  const clearFilters = () => { setFilter(""); setSearch(""); };
  const { page, setPage, pageItems, totalPages, total } = usePagination(filtered, PAGE_SIZE);

  const openCreate = () => { setForm({ nom: "", description: "", siteId: filter || "" }); setModal("create"); };
  const openEdit   = (p) => { setSelected(p); setForm({ nom: p.nom, description: p.description||"", siteId: p.siteId||"" }); setModal("edit"); };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === "create") await createPlant(form);
      else await updatePlant(selected.id, form);
      await load(); closeModal();
    } catch (err) { setMsg(err.response?.data || t("common.error")); }
  };

  const handleDelete = async () => {
    await deletePlant(deleteId);
    setDeleteId(null); load();
  };

  const currentSite = sites.find(s => String(s.id) === filter);
  const siteColorMap = {};
  sites.forEach((st, i) => { siteColorMap[String(st.id)] = SITE_COLORS[i % SITE_COLORS.length]; });

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .plant-card{transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s}
        .plant-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,40,80,.12) !important}
        .pag-btn:hover:not(.pag-active){background:var(--l1) !important;border-color:var(--l3) !important;color:var(--l7) !important}
        .nav-btn-admin:hover{opacity:.85;transform:translateY(-1px)}
      `}</style>

      {/* HEADER */}
      <div style={s.topBar}>
        <div style={s.titleBlock}>
          <div style={s.breadcrumb}>
            <button style={s.bcBtn} onClick={() => navigate("/sites")}><IcoPin /> {t("admin.plants.breadcrumbSites")}</button>
            <IcoChevron />
            <span style={s.bcCurrent}>{t("admin.plants.title")}</span>
            {currentSite && (<><IcoChevron /><span style={{...s.bcCurrent, color:"var(--l5)"}}>{translate(currentSite.nom)}</span></>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {siteIdParam && (
              <button style={s.btnBack} onClick={() => navigate("/sites")}><IcoBack /> {t("admin.plants.backToSites")}</button>
            )}
            <h1 style={s.title}><span style={s.titleIcon}><IcoFactory /></span>{t("admin.plants.title")}</h1>
          </div>
          <p style={s.sub}>
            <span style={s.badge}>{filtered.length}</span>
            {t("admin.plants.subtitle", { count: filtered.length })}
            {currentSite && <span style={s.filterLabel}> · {translate(currentSite.nom)}</span>}
          </p>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"}}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IcoSearch /></span>
            <input style={s.searchInp} placeholder={t("admin.plants.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
          </div>
          <select style={s.select} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{t("admin.plants.filterAllSites")}</option>
            {sites.map(st => <option key={st.id} value={String(st.id)}>{translate(st.nom)}</option>)}
          </select>
          {canEdit && <button style={s.btnPrimary} onClick={openCreate}><IcoPlus /> {t("admin.plants.new")}</button>}
        </div>
      </div>

      {/* CHIPS SITES */}
      {sites.filter(st => allPlants.some(p => String(p.siteId) === String(st.id))).length > 0 && (
        <div style={s.chipsRow}>
          {sites.filter(st => allPlants.some(p => String(p.siteId) === String(st.id))).slice(0,6).map(st => {
            const count = allPlants.filter(p => String(p.siteId) === String(st.id)).length;
            const isActive = filter === String(st.id);
            const col = siteColorMap[String(st.id)] || SITE_COLORS[0];
            return (
              <button key={st.id} style={{
                ...s.chip,
                background: isActive ? col.accent : col.bg,
                color: isActive ? "#fff" : col.accent,
                borderColor: isActive ? col.accent : col.border,
                boxShadow: isActive ? `0 3px 12px ${col.accent}30` : "none",
              }} onClick={() => setFilter(isActive ? "" : String(st.id))}>
                <IcoPin />
                <span>{translate(st.nom)}</span>
                <span style={{ background: isActive ? "rgba(255,255,255,.25)" : col.pill, color: isActive ? "#fff" : col.accent, padding: "1px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{count}</span>
              </button>
            );
          })}
          {filter && <button style={s.chipClear} onClick={clearFilters}>✕ Tout afficher</button>}
        </div>
      )}

      {/* GRILLE DE CARTES */}
      {filtered.length > 0 ? (
        <>
          <div style={s.grid}>
            {pageItems.map((p, i) => {
              const col = siteColorMap[String(p.siteId)] || SITE_COLORS[0];
              return (
                <PlantCard
                  key={p.id} plant={p} col={col} canEdit={canEdit}
                  isAdmin={isAdmin}
                  isPPO={isPPO}
                  t={t} translate={translate}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeleteId(p.id)}
                  onNavigate={() => navigate(`/processus?plantId=${p.id}`)}
                  onNavigateSegments={() => navigate(`/segments?plantId=${p.id}`)}
                  onSiteFilter={() => setFilter(String(p.siteId))}
                  animDelay={i * 0.035}
                />
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}><IcoFactory /></div>
          <p style={s.emptyLabel}>{t("admin.plants.emptyTitle")}</p>
          {(filter || search) && <button style={s.btnGhost} onClick={clearFilters}>{t("admin.common.clearFilters")}</button>}
        </div>
      )}

      {/* MODALS */}
      {modal && (
        <Modal title={modal === "create" ? t("admin.plants.modal.createTitle") : t("admin.plants.modal.editTitle")} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <Field label={t("admin.plants.modal.name")}>
              <input style={s.input} value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} placeholder={t("admin.plants.placeholders.name")} required />
            </Field>
            <Field label={t("admin.plants.modal.description")}>
              <textarea style={{...s.input, minHeight:72, resize:"vertical"}} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder={t("admin.plants.placeholders.description")} />
            </Field>
            <Field label={t("admin.plants.modal.site")}>
              <select style={s.input} value={form.siteId} onChange={e => setForm({...form, siteId:e.target.value})} required>
                <option value="">{t("admin.plants.placeholders.site")}</option>
                {sites.map(st => <option key={st.id} value={st.id}>{translate(st.nom)}</option>)}
              </select>
            </Field>
            {msg && <div style={s.errMsg}>{msg}</div>}
            <div style={s.modalFooter}>
              <button type="button" style={s.btnCancel} onClick={closeModal}>{t("admin.common.cancel")}</button>
              <button type="submit" style={s.btnPrimary}>{t("admin.common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId && (
        <Modal title={t("admin.plants.deleteModal.title")} onClose={() => setDeleteId(null)}>
          <div style={{ textAlign:"center", padding:"12px 0 20px" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
            <p style={s.deleteText}>{t("admin.plants.deleteModal.question")}<br/>
              <span style={s.deleteWarn}>{t("admin.plants.deleteModal.warning")}</span></p>
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

function PlantCard({ plant, col, canEdit, isAdmin, isPPO, onEdit, onDelete, onNavigate, onNavigateSegments, onSiteFilter, t, translate, animDelay }) {
  const plantName = translate ? translate(plant.nom) : plant.nom;
  const showFooter = isAdmin || isPPO;

  return (
    <div className="plant-card" style={{
      borderRadius: 14, border: `1px solid ${col.border}`,
      background: "#fff", display: "flex", flexDirection: "column",
      overflow: "hidden", boxShadow: "0 2px 10px rgba(0,20,60,.05)",
      animation: `fadeUp .32s ease ${animDelay}s both`,
      borderTop: `3px solid ${col.accent}`,
    }}>
      {/* Top */}
      <div style={{ padding: "14px 16px 12px", background: col.bg, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:11, background: col.accent, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}>
            <IcoFactory />
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14.5, color:"#1a2332", lineHeight:1.3, fontFamily:"var(--fd)" }}>{plantName}</div>
            <div style={{ fontSize:10, color: col.accent, fontWeight:700 }}>#{plant.id}</div>
          </div>
        </div>
        {canEdit && (
          <div style={{ display:"flex", gap:5 }}>
            <button style={{ width:28, height:28, borderRadius:7, border:`1px solid ${col.border}`, background:"var(--bg-1)", color:col.accent, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} onClick={onEdit}><IcoEdit /></button>
            <button style={{ width:28, height:28, borderRadius:7, border:"1px solid #fecaca", background:"#fef2f2", color:"#dc2626", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }} onClick={onDelete}><IcoTrash /></button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"12px 16px", flex:1, display:"flex", flexDirection:"column", gap:8 }}>
        {plant.description ? (
          <p style={{ fontSize:12.5, color:"#6b7e94", lineHeight:1.5, margin:0 }}>{translate(plant.description)}</p>
        ) : (
          <p style={{ fontSize:12, color:"#9aacbe", fontStyle:"italic", margin:0 }}>{t("admin.common.noDescription")}</p>
        )}
        {plant.siteNom && (
          <button style={{ display:"inline-flex", alignItems:"center", gap:5, background:col.bg, color:col.accent, border:`1px solid ${col.border}`, padding:"3px 10px", borderRadius:20, fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)", alignSelf:"flex-start" }} onClick={onSiteFilter}>
            <IcoPin /> {translate(plant.siteNom)}
          </button>
        )}
      </div>

      {/* Footer — PPO : Processus | ADMIN : Processus + Segments */}
      {showFooter && (
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${col.border}`, background:col.bg, display:"flex", justifyContent:"flex-end", gap:8 }}>

          {/* Bouton Processus — PPO & ADMIN */}
          <button
            className="nav-btn-admin"
            style={{ display:"inline-flex", alignItems:"center", gap:6, background:col.accent, color:"#fff", border:"none", borderRadius:9, padding:"7px 13px", cursor:"pointer", fontSize:12.5, fontWeight:700, fontFamily:"var(--fb)", boxShadow:`0 3px 12px ${col.accent}30`, transition:"all .15s" }}
            onClick={onNavigate}
          >
            <IcoProcess /> {t("admin.plants.row.processus")} <IcoArrow />
          </button>

          {/* Bouton Segments — ADMIN uniquement */}
          {isAdmin && (
            <button
              className="nav-btn-admin"
              style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#fff", color:col.accent, border:`1.5px solid ${col.accent}`, borderRadius:9, padding:"7px 13px", cursor:"pointer", fontSize:12.5, fontWeight:700, fontFamily:"var(--fb)", boxShadow:`0 3px 12px ${col.accent}18`, transition:"all .15s" }}
              onClick={onNavigateSegments}
            >
              <IcoGrid /> {t("admin.plants.row.segments")} <IcoArrow />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", marginBottom:6, fontSize:11, fontWeight:700, color:"#3a4a5c", textTransform:"uppercase", letterSpacing:"0.7px" }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  page:        { minHeight: "100%" },
  topBar:      { display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:16, gap:16, flexWrap:"wrap" },
  titleBlock:  {},
  breadcrumb:  { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--tx-4)", marginBottom:8 },
  bcBtn:       { display:"inline-flex", alignItems:"center", gap:4, background:"none", border:"none", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:0, fontFamily:"var(--fb)" },
  bcCurrent:   { color:"var(--tx-3)", fontWeight:600 },
  filterLabel: { color:"var(--l5)", fontWeight:600 },
  btnBack:     { display:"inline-flex", alignItems:"center", gap:5, background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:"5px 11px", borderRadius:8, fontFamily:"var(--fb)", fontWeight:600 },
  title:       { fontSize:26, fontWeight:800, color:"var(--tx-1)", fontFamily:"var(--fd)", margin:"0 0 6px", display:"flex", alignItems:"center", gap:10 },
  titleIcon:   { width:34, height:34, borderRadius:10, background:"var(--grd-h)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center" },
  sub:         { color:"var(--tx-3)", fontSize:14, margin:0, display:"flex", alignItems:"center", gap:8 },
  badge:       { background:"var(--grd-h)", color:"#fff", fontSize:12, fontWeight:700, padding:"2px 10px", borderRadius:20, boxShadow:"var(--sh-blue)" },
  searchWrap:  { display:"flex", alignItems:"center", gap:8, background:"var(--bg-1)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"0 12px", height:42, minWidth:180 },
  searchIcon:  { color:"var(--tx-4)", flexShrink:0, display:"flex" },
  searchInp:   { flex:1, border:"none", background:"transparent", fontSize:10, color:"var(--tx-1)", outline:"none", fontFamily:"var(--fb)" },
  clearBtn:    { border:"none", background:"none", color:"var(--tx-4)", cursor:"pointer", fontSize:12, padding:0 },
  select:      { padding:"9px 12px", border:"1.5px solid var(--bd-1)", borderRadius:10, fontSize:13, fontFamily:"var(--fb)", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", height:42, minWidth:180, maxWidth:220 },
  btnPrimary:  { display:"inline-flex", alignItems:"center", gap:7, background:"var(--grd-h)", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:13.5, fontFamily:"var(--fb)", boxShadow:"var(--sh-blue)", whiteSpace:"nowrap", transition:"all .15s" },
  btnGhost:    { display:"inline-flex", alignItems:"center", gap:6, background:"var(--bg-1)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"9px 16px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnCancel:   { background:"var(--bg-3)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:9, padding:"9px 18px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnDanger:   { background:"#dc2626", color:"#fff", border:"none", borderRadius:9, padding:"9px 18px", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  chipsRow:    { display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" },
  chip:        { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:20, border:"1.5px solid", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)", transition:"all .15s" },
  chipClear:   { display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)" },
  grid:        { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:18 },
  empty:       { padding:"60px 20px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:14 },
  emptyIconWrap:{ width:64, height:64, borderRadius:"50%", background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--tx-4)", fontSize:24 },
  emptyLabel:  { fontWeight:700, color:"var(--tx-2)", fontSize:15, margin:0 },
  input:       { width:"100%", padding:"10px 14px", border:"1.5px solid var(--bd-1)", borderRadius:9, fontSize:14, boxSizing:"border-box", fontFamily:"var(--fb)", background:"var(--bg-2)", color:"var(--tx-1)", outline:"none" },
  errMsg:      { background:"#fef2f2", color:"#dc2626", padding:"10px 14px", borderRadius:9, fontSize:13, marginBottom:12, border:"1px solid #fecaca" },
  modalFooter: { display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 },
  deleteText:  { color:"var(--tx-2)", lineHeight:1.7, marginBottom:4 },
  deleteWarn:  { fontSize:12, color:"var(--tx-4)", display:"block", marginTop:4 },
};