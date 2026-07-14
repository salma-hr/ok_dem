import { useState, useEffect } from "react";
import { getAllSegments, getAllPlants, createSegment, updateSegment, deleteSegment } from "../../api";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "../../context/I18nContext";
import Pagination, { usePagination } from "../../components/Pagination";

const IcoSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoPlus    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
const IcoTrash   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IcoArrow   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoChevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoFactory = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 20h20M4 20V10l6-4v4l6-4v14"/><path d="M10 20v-5h4v5"/></svg>;
const IcoPin     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>;
const IcoGear    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IcoSeg     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a10 10 0 0 1 10 10H12V2"/><path d="M12 12L2 12a10 10 0 0 0 10 10V12"/></svg>;

const PLANT_COLORS = [
  { bg:"#eef6fd", accent:"#0057a8", border:"#b8d8f8", pill:"#dceefb", light:"#f5f9fd" },
  { bg:"#f0fdfa", accent:"#0d9488", border:"#99f6e4", pill:"#ccfbf1", light:"#f5fffe" },
  { bg:"#faf5ff", accent:"#7c3aed", border:"#d8b4fe", pill:"#f3e8ff", light:"#fdf8ff" },
  { bg:"#fff7ed", accent:"#c2410c", border:"#fdba74", pill:"#ffedd5", light:"#fffaf5" },
  { bg:"#f0fdf4", accent:"#15803d", border:"#86efac", pill:"#dcfce7", light:"#f5fef7" },
  { bg:"#fffbeb", accent:"#b45309", border:"#fde68a", pill:"#fef9c3", light:"#fefdf5" },
];

const PAGE_SIZE = 15;

export default function SegmentsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = ["ADMIN", "PPO"].includes(user?.role);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plantIdParam = searchParams.get("plantId");
  const translate = (v) => v;

  const [allSegments, setAllSegments] = useState([]);
  const [plants,      setPlants]      = useState([]);
  const [filter,      setFilter]      = useState(plantIdParam || "");
  const [search,      setSearch]      = useState("");
  const [modal,       setModal]       = useState(null);
  const [selected,    setSelected]    = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);
  const [form,        setForm]        = useState({ nom:"", description:"", plantId:"" });
  const [msg,         setMsg]         = useState("");

  useEffect(() => { load(); }, []); // eslint-disable-line

  const load = async () => {
    const [segs, pls] = await Promise.all([getAllSegments(), getAllPlants()]);
    setAllSegments(Array.isArray(segs.data) ? segs.data : []);
    setPlants(Array.isArray(pls.data) ? pls.data : []);
  };

  const filtered = allSegments
    .filter(seg => !filter || String(seg.plantId) === filter)
    .filter(seg => !search.trim() || seg.nom?.toLowerCase().includes(search.toLowerCase()) || seg.description?.toLowerCase().includes(search.toLowerCase()));

  const clearFilters = () => { setFilter(""); setSearch(""); };
  const { page, setPage, pageItems, totalPages, total } = usePagination(filtered, PAGE_SIZE);

  // Grouper les pageItems par plant
  const grouped = plants
    .map(pl => ({ plant: pl, segs: pageItems.filter(seg => String(seg.plantId) === String(pl.id)) }))
    .filter(g => g.segs.length > 0);
  const ungrouped = pageItems.filter(seg => !seg.plantId);

  const openCreate = () => { setForm({ nom:"", description:"", plantId: filter || "" }); setModal("create"); };
  const openEdit   = (seg) => { setSelected(seg); setForm({ nom:seg.nom, description:seg.description||"", plantId:seg.plantId||"" }); setModal("edit"); };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === "create") await createSegment(form);
      else await updateSegment(selected.id, form);
      await load(); closeModal();
    } catch(err) { setMsg(err.response?.data || t("common.error")); }
  };

  const handleDelete = async () => {
    await deleteSegment(deleteId);
    setDeleteId(null); load();
  };

  const currentPlant = plants.find(p => String(p.id) === filter);
  const plantColorMap = {};
  plants.forEach((pl, i) => { plantColorMap[String(pl.id)] = PLANT_COLORS[i % PLANT_COLORS.length]; });

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .seg-card{transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s}
        .seg-card:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,40,80,.12) !important}
        .pag-btn:hover:not(.pag-active){background:var(--l1) !important;border-color:var(--l3) !important;color:var(--l7) !important}
        .nav-btn-admin:hover{opacity:.85;transform:translateY(-1px)}
      `}</style>

      {/* HEADER */}
      <div style={s.topBar}>
        <div style={s.titleBlock}>
          <div style={s.breadcrumb}>
            <button style={s.bcBtn} onClick={() => navigate("/sites")}><IcoPin /> {t("admin.segments.breadcrumbSites")}</button>
            <IcoChevron />
            <button style={s.bcBtn} onClick={() => navigate("/plants")}><IcoFactory /> {t("admin.segments.breadcrumbPlants")}</button>
            <IcoChevron />
            <span style={s.bcCurrent}>{t("admin.segments.title")}</span>
            {currentPlant && (<><IcoChevron /><span style={{...s.bcCurrent, color:"var(--l5)"}}>{translate(currentPlant.nom)}</span></>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {plantIdParam && (
              <button style={s.btnBack} onClick={() => navigate("/plants")}><IcoBack /> {t("admin.segments.backToPlants")}</button>
            )}
            <h1 style={s.title}><span style={s.titleIcon}><IcoSeg /></span>{t("admin.segments.title")}</h1>
          </div>
          <p style={s.sub}>
            <span style={s.badge}>{filtered.length}</span>
            {t("admin.segments.subtitle", { count: filtered.length })}
            {currentPlant && <span style={s.filterLabel}> · {translate(currentPlant.nom)}</span>}
          </p>
        </div>
        <div style={s.actions}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IcoSearch /></span>
            <input style={s.searchInp} placeholder={t("admin.segments.searchPlaceholder")} value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
          </div>
          <select style={s.select} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{t("admin.segments.filterAllPlants")}</option>
            {plants.map(p => (
              <option key={p.id} value={String(p.id)}>
                {translate(p.nom)}{p.siteNom ? ` (${translate(p.siteNom)})` : ""}
              </option>
            ))}
          </select>
          {canEdit && <button style={s.btnPrimary} onClick={openCreate}><IcoPlus /> {t("admin.segments.new")}</button>}
        </div>
      </div>

      {/* CHIPS PLANTS */}
      {plants.filter(pl => allSegments.some(seg => String(seg.plantId) === String(pl.id))).length > 0 && (
        <div style={s.chipsRow}>
          {plants.filter(pl => allSegments.some(seg => String(seg.plantId) === String(pl.id))).slice(0,6).map(pl => {
            const count = allSegments.filter(seg => String(seg.plantId) === String(pl.id)).length;
            const isActive = filter === String(pl.id);
            const col = plantColorMap[String(pl.id)] || PLANT_COLORS[0];
            return (
              <button key={pl.id} style={{
                ...s.chip,
                background: isActive ? col.accent : col.bg,
                color: isActive ? "#fff" : col.accent,
                borderColor: isActive ? col.accent : col.border,
                boxShadow: isActive ? `0 3px 12px ${col.accent}30` : "none",
              }} onClick={() => setFilter(isActive ? "" : String(pl.id))}>
                <IcoFactory />
                <span>{pl.nom}</span>
                {pl.siteNom && <span style={{ fontSize:10, opacity:.75 }}>({translate(pl.siteNom)})</span>}                <span style={{ background: isActive ? "rgba(255,255,255,.25)" : col.pill, color: isActive ? "#fff" : col.accent, padding:"1px 7px", borderRadius:20, fontSize:11, fontWeight:700 }}>{count}</span>
              </button>
            );
          })}
          {filter && <button style={s.chipClear} onClick={clearFilters}>✕ Tout afficher</button>}
        </div>
      )}

      {/* CONTENU */}
      {filtered.length > 0 ? (
        <>
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {grouped.map(({ plant, segs }) => {
              const col = plantColorMap[String(plant.id)] || PLANT_COLORS[0];
              return (
                <div key={plant.id} style={{ ...s.group, borderColor: col.border }}>
                  <div style={{ ...s.groupHeader, background: col.bg, borderColor: col.border }}>
                    <div style={s.groupTitle}>
                      <span style={{ ...s.groupIconWrap, background: col.accent, color: "#fff" }}><IcoFactory /></span>
                      <span style={{ fontWeight:700, fontSize:14, color: col.accent }}>{translate(plant.nom)}</span>
                      <span style={{ ...s.groupCount, background: col.pill, color: col.accent, border:`1px solid ${col.border}` }}>{t("admin.segments.groupCount", { count: segs.length })}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {plant.siteNom && (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, color:"var(--tx-3)", background:"var(--bg-3)", border:"1px solid var(--bd-1)", padding:"3px 9px", borderRadius:20 }}>
                          <IcoPin /> {translate(plant.siteNom)}
                        </span>
                      )}
                      <button style={{ background:"none", border:`1.5px solid ${col.border}`, borderRadius:7, padding:"4px 10px", cursor:"pointer", fontSize:11, color:col.accent, fontWeight:600, fontFamily:"var(--fb)" }}
                        onClick={() => setFilter(filter === String(plant.id) ? "" : String(plant.id))}>
                        {filter === String(plant.id) ? t("admin.segments.chipsClear") : t("admin.segments.filterPlant")}
                      </button>
                    </div>
                  </div>
                  <div style={s.grid}>
                    {segs.map((seg, i) => (
                      <SegmentCard
                        key={seg.id} seg={seg} canEdit={canEdit} col={col}
                        translate={translate} t={t}
                        onEdit={() => openEdit(seg)}
                        onDelete={() => setDeleteId(seg.id)}
                        onNavigate={() => navigate(`/processus?segmentId=${seg.id}`)}
                        animDelay={i * 0.03}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {ungrouped.length > 0 && (
              <div style={{ ...s.group, borderColor:"rgba(245,158,11,.35)" }}>
                <div style={{ ...s.groupHeader, background:"#fffbeb", borderColor:"rgba(245,158,11,.25)" }}>
                  <div style={s.groupTitle}>
                    <span style={{ ...s.groupIconWrap, background:"rgba(245,158,11,.15)", color:"#d97706" }}>⚠</span>
                    <span style={{ fontWeight:700, fontSize:14, color:"#d97706" }}>{t("admin.segments.ungrouped")}</span>
                    <span style={{ ...s.groupCount, background:"rgba(245,158,11,.1)", color:"#d97706", border:"1px solid rgba(245,158,11,.3)" }}>{ungrouped.length}</span>
                  </div>
                </div>
                <div style={s.grid}>
                  {ungrouped.map((seg, i) => (
                    <SegmentCard key={seg.id} seg={seg} canEdit={canEdit} orphan
                      col={{ bg:"#fffbeb", accent:"#d97706", border:"rgba(245,158,11,.35)", light:"#fef9c3" }}
                      translate={translate} t={t}
                      onEdit={() => openEdit(seg)}
                      onDelete={() => setDeleteId(seg.id)}
                      onNavigate={() => navigate(`/processus?segmentId=${seg.id}`)}
                      animDelay={i * 0.03}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}><IcoSeg /></div>
          <p style={s.emptyLabel}>{t("admin.segments.emptyTitle")}</p>
          {(filter || search) && <button style={s.btnGhost} onClick={clearFilters}>{t("admin.common.clearFilters")}</button>}
        </div>
      )}

      {/* MODALS */}
      {modal && (
        <Modal title={modal === "create" ? t("admin.segments.modal.createTitle") : t("admin.segments.modal.editTitle")} onClose={closeModal}>
          <form onSubmit={handleSubmit}>
            <Field label={t("admin.segments.modal.name")}>
              <input style={s.input} value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} placeholder={t("admin.segments.placeholders.name")} required />
            </Field>
            <Field label={t("admin.segments.modal.description")}>
              <textarea style={{...s.input, minHeight:72, resize:"vertical"}} value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder={t("admin.segments.placeholders.description")} />
            </Field>
            <Field label={t("admin.segments.modal.plant")}>
              <select style={s.input} value={form.plantId} onChange={e => setForm({...form, plantId:e.target.value})} required>
                <option value="">{t("admin.segments.placeholders.plant")}</option>
                {plants.map(p => <option key={p.id} value={p.id}>{translate(p.nom)}{p.siteNom ? ` (${translate(p.siteNom)})` : ""}</option>)}
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
        <Modal title={t("admin.segments.deleteModal.title")} onClose={() => setDeleteId(null)}>
          <div style={{ textAlign:"center", padding:"12px 0 20px" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
            <p style={s.deleteText}>{t("admin.segments.deleteModal.question")}<br/>
              <span style={s.deleteWarn}>{t("admin.segments.deleteModal.warning")}</span></p>
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

function SegmentCard({ seg, canEdit, orphan, col, onEdit, onDelete, onNavigate, translate, t, animDelay }) {
  const segName = translate ? translate(seg.nom) : seg.nom;
  const segDesc = translate ? translate(seg.description) : seg.description;
  return (
    <div className="seg-card" style={{
      ...sc.card,
      borderTop: `3px solid ${col.accent}`,
      background: orphan ? "#fffbeb" : "#fff",
      animation: `fadeUp .3s ease ${animDelay}s both`,
    }}>
      <div style={sc.top}>
        <div style={{ ...sc.iconWrap, background: col.bg, color: col.accent }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a10 10 0 0 1 10 10H12V2"/><path d="M12 12L2 12a10 10 0 0 0 10 10V12"/>
          </svg>
        </div>
        {canEdit && (
          <div style={sc.actions}>
            <button style={{ ...sc.btnEdit, background: col.bg, color: col.accent, borderColor: col.border }} onClick={onEdit} title={t("admin.common.edit")}><IcoEdit /> {t("admin.common.edit")}</button>
            <button style={sc.btnDel} onClick={onDelete} title={t("admin.common.delete")}><IcoTrash /></button>
          </div>
        )}
      </div>

      <div style={sc.nom}>{segName}</div>
      <div style={sc.desc}>
        {segDesc || <span style={{ color:"var(--tx-4)", fontStyle:"italic" }}>{t("admin.common.noDescription")}</span>}
      </div>

      <div style={sc.footer}>
        <button className="nav-btn-admin" style={{ ...sc.btnNav, background: col.accent, color:"#fff", border:"none", boxShadow:`0 3px 12px ${col.accent}35`, transition:"all .15s" }} onClick={onNavigate}>
          <IcoGear /> {t("admin.segments.card.processes")} <IcoArrow />
        </button>
        <span style={{ fontSize:10, color:"var(--tx-4)", fontWeight:600 }}>#{seg.id}</span>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", marginBottom:6, fontSize:11, fontWeight:700, color:"#3a4a5c", textTransform:"uppercase", letterSpacing:"0.7px" }}>{label}</label>
      {children}
    </div>
  );
}

const sc = {
  card:     { borderRadius:14, border:"1px solid var(--bd-1)", padding:"14px 16px", display:"flex", flexDirection:"column", gap:8, boxShadow:"0 1px 6px rgba(0,20,60,.05)", overflow:"hidden" },
  top:      { display:"flex", alignItems:"center", justifyContent:"space-between" },
  iconWrap: { width:36, height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  actions:  { display:"flex", gap:5, alignItems:"center" },
  btnEdit:  { display:"inline-flex", alignItems:"center", gap:4, border:"1px solid", borderRadius:7, padding:"4px 9px", cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"var(--fb)" },
  btnDel:   { display:"inline-flex", alignItems:"center", justifyContent:"center", width:27, height:27, background:"#fef2f2", color:"#dc2626", border:"1px solid #fecaca", borderRadius:7, cursor:"pointer" },
  nom:      { fontSize:14, fontWeight:700, color:"var(--tx-1)", lineHeight:1.4 },
  desc:     { fontSize:12.5, color:"var(--tx-3)", lineHeight:1.5, flex:1 },
  footer:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:4, paddingTop:10, borderTop:"1px solid var(--bd-1)" },
  btnNav:   { display:"inline-flex", alignItems:"center", gap:5, borderRadius:8, padding:"6px 12px", cursor:"pointer", fontSize:12, fontWeight:700, fontFamily:"var(--fb)" },
};

const s = {
  page:       { minHeight:"100%" },
  topBar:     { display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:16, gap:16, flexWrap:"wrap" },
  titleBlock: {},
  breadcrumb: { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--tx-4)", marginBottom:8 },
  bcBtn:      { display:"inline-flex", alignItems:"center", gap:4, background:"none", border:"none", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:0, fontFamily:"var(--fb)" },
  bcCurrent:  { color:"var(--tx-3)", fontWeight:600 },
  filterLabel:{ color:"var(--l5)", fontWeight:600 },
  btnBack:    { display:"inline-flex", alignItems:"center", gap:5, background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:"5px 11px", borderRadius:8, fontFamily:"var(--fb)", fontWeight:600 },
  title:      { fontSize:26, fontWeight:800, color:"var(--tx-1)", fontFamily:"var(--fd)", margin:"0 0 6px", display:"flex", alignItems:"center", gap:10 },
  titleIcon:  { width:34, height:34, borderRadius:10, background:"var(--grd-h)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center" },
  sub:        { color:"var(--tx-3)", fontSize:14, margin:0, display:"flex", alignItems:"center", gap:8 },
  badge:      { background:"var(--grd-h)", color:"#fff", fontSize:12, fontWeight:700, padding:"2px 10px", borderRadius:20, boxShadow:"var(--sh-blue)" },
  actions:    { display:"flex", gap:10, alignItems:"center", flexWrap:"nowrap" },
  searchWrap: { display:"flex", alignItems:"center", gap:8, background:"var(--bg-1)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"0 12px", height:42, minWidth:180 },
  searchIcon: { color:"var(--tx-4)", flexShrink:0, display:"flex" },
  searchInp:  { flex:1, border:"none", background:"transparent", fontSize:10, color:"var(--tx-1)", outline:"none", fontFamily:"var(--fb)" },
  clearBtn:   { border:"none", background:"none", color:"var(--tx-4)", cursor:"pointer", fontSize:12, padding:0 },
  select:     { padding:"9px 12px", border:"1.5px solid var(--bd-1)", borderRadius:10, fontSize:13, fontFamily:"var(--fb)", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", height:42, minWidth:180, maxWidth:220 },
  btnPrimary: { display:"inline-flex", alignItems:"center", gap:7, background:"var(--grd-h)", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:13.5, fontFamily:"var(--fb)", boxShadow:"var(--sh-blue)", whiteSpace:"nowrap", transition:"all .15s" },
  btnGhost:   { display:"inline-flex", alignItems:"center", gap:6, background:"var(--bg-1)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"9px 16px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnCancel:  { background:"var(--bg-3)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:9, padding:"9px 18px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnDanger:  { background:"#dc2626", color:"#fff", border:"none", borderRadius:9, padding:"9px 18px", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  chipsRow:   { display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" },
  chip:       { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:20, border:"1.5px solid", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)", transition:"all .15s" },
  chipClear:  { display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)" },
  group:      { background:"var(--bg-1)", border:"1px solid var(--bd-1)", borderRadius:14, overflow:"hidden", boxShadow:"0 2px 10px rgba(0,20,60,.05)" },
  groupHeader:{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 18px", borderBottom:"1px solid var(--bd-1)" },
  groupTitle: { display:"flex", alignItems:"center", gap:10 },
  groupIconWrap:{ width:28, height:28, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" },
  groupCount: { fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20 },
  grid:       { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:14, padding:14 },
  empty:      { padding:"60px 20px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:14 },
  emptyIconWrap:{ width:64, height:64, borderRadius:"50%", background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--tx-4)" },
  emptyLabel: { fontWeight:700, color:"var(--tx-2)", fontSize:15, margin:0 },
  input:      { width:"100%", padding:"10px 14px", border:"1.5px solid var(--bd-1)", borderRadius:9, fontSize:14, boxSizing:"border-box", fontFamily:"var(--fb)", background:"var(--bg-2)", color:"var(--tx-1)", outline:"none" },
  errMsg:     { background:"#fef2f2", color:"#dc2626", padding:"10px 14px", borderRadius:9, fontSize:13, marginBottom:12, border:"1px solid #fecaca" },
  modalFooter:{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 },
  deleteText: { color:"var(--tx-2)", lineHeight:1.7, marginBottom:4 },
  deleteWarn: { fontSize:12, color:"var(--tx-4)", display:"block", marginTop:4 },
};