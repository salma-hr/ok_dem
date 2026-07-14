import { useState, useEffect } from "react";
import {
  getAllMachines, getMachinesByProcessus, getAllProcessus,
  getAllSites, getPlantsBySite, getSegmentsByPlant,
  createMachine, updateMachine, deleteMachine
} from "../../api";
import Modal from "../../components/Modal";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import Pagination, { usePagination } from "../../components/Pagination";
import { useI18n } from "../../context/I18nContext";

/* ─── Icons ─────────────────────────────────────────────────── */
const IcoSearch  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcoPlus    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoEdit    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
const IcoTrash   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const IcoChevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>;
const IcoPin     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IcoWrench  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>;
const IcoGear    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;

/* ─── Colour palette by processus ───────────────────────────── */
const PROC_COLORS = [
  { bg:"#eef6fd", accent:"#0057a8", border:"#b8d8f8", pill:"#dceefb" },
  { bg:"#f0fdfa", accent:"#0d9488", border:"#99f6e4", pill:"#ccfbf1" },
  { bg:"#faf5ff", accent:"#7c3aed", border:"#d8b4fe", pill:"#f3e8ff" },
  { bg:"#fff7ed", accent:"#c2410c", border:"#fdba74", pill:"#ffedd5" },
  { bg:"#f0fdf4", accent:"#15803d", border:"#86efac", pill:"#dcfce7" },
  { bg:"#fffbeb", accent:"#b45309", border:"#fde68a", pill:"#fef9c3" },
  { bg:"#fdf2f8", accent:"#9d174d", border:"#f9a8d4", pill:"#fce7f3" },
  { bg:"#f0f9ff", accent:"#0369a1", border:"#7dd3fc", pill:"#e0f2fe" },
];

const PAGE_SIZE = 12;

export default function MachinesPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = ["PPO", "ADMIN", "ADMIN_PLANT"].includes(user?.role);
  const translate = (value) => value;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processusId = searchParams.get("processusId");

  const [machines,  setMachines]  = useState([]);
  const [processus, setProcessus] = useState([]);
  const [sites,     setSites]     = useState([]);
  const [plants,    setPlants]    = useState([]);
  const [segments,  setSegments]  = useState([]);

  const [fProcessus, setFProcessus] = useState(processusId || "");
  const [fSite,      setFSite]      = useState("");
  const [fPlant,     setFPlant]     = useState("");
  const [fSegment,   setFSegment]   = useState("");
  const [search,     setSearch]     = useState("");

  const [modal,        setModal]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [deleteId,     setDeleteId]     = useState(null);
  const [deleteMsg,    setDeleteMsg]    = useState("");
  const [deleteLoading,setDeleteLoading]= useState(false);
  const [form,         setForm]         = useState({ nom:"", description:"", processusId:"", siteId:"", plantId:"", segmentId:"" });
  const [formPlants,   setFormPlants]   = useState([]);
  const [formSegments, setFormSegments] = useState([]);
  const [msg,          setMsg]          = useState("");

  /* colour map by processusId */
  const procColorMap = {};
  processus.forEach((p, i) => { procColorMap[String(p.id)] = PROC_COLORS[i % PROC_COLORS.length]; });

  const getApiErrorMessage = (err, fallbackKey = "common.error") => {
    const data = err?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    return t(fallbackKey);
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    const [m, p, st] = await Promise.all([
      processusId ? getMachinesByProcessus(processusId) : getAllMachines(),
      getAllProcessus(),
      getAllSites(),
    ]);
    setMachines(Array.isArray(m.data)  ? m.data  : []);
    setProcessus(Array.isArray(p.data) ? p.data  : []);
    setSites(Array.isArray(st.data)    ? st.data : []);
  };

  const handleFSite = async (id) => {
    setFSite(id); setFPlant(""); setFSegment(""); setPlants([]); setSegments([]);
    if (id) { try { const r = await getPlantsBySite(id); setPlants(Array.isArray(r.data)?r.data:[]); } catch(e){} }
  };
  const handleFPlant = async (id) => {
    setFPlant(id); setFSegment(""); setSegments([]);
    if (id) { try { const r = await getSegmentsByPlant(id); setSegments(Array.isArray(r.data)?r.data:[]); } catch(e){} }
  };
  const handleFormSite = async (id) => {
    setForm(f=>({...f, siteId:id, plantId:"", segmentId:""}));
    setFormPlants([]); setFormSegments([]);
    if (id) { try { const r = await getPlantsBySite(id); setFormPlants(Array.isArray(r.data)?r.data:[]); } catch(e){} }
  };
  const handleFormPlant = async (id) => {
    setForm(f=>({...f, plantId:id, segmentId:""}));
    setFormSegments([]);
    if (id) { try { const r = await getSegmentsByPlant(id); setFormSegments(Array.isArray(r.data)?r.data:[]); } catch(e){} }
  };

  const filtered = machines.filter(m => {
    if (search     && !(m.nom||"").toLowerCase().includes(search.toLowerCase())) return false;
    if (fProcessus && String(m.processusId) !== fProcessus) return false;
    if (fSite      && String(m.siteId)      !== fSite)      return false;
    if (fPlant     && String(m.plantId)     !== fPlant)     return false;
    if (fSegment   && String(m.segmentId)   !== fSegment)   return false;
    return true;
  });

  const { page, setPage, pageItems, totalPages, total } = usePagination(filtered, PAGE_SIZE);

  useEffect(() => { setPage(0); }, [search, fProcessus, fSite, fPlant, fSegment, setPage]);
  useEffect(() => { window.scrollTo({ top:0, behavior:"smooth" }); }, [page]);

  const openCreate = () => {
    setForm({ nom:"", description:"", processusId: processusId || "", siteId:"", plantId:"", segmentId:"" });
    setFormPlants([]); setFormSegments([]); setModal("create");
  };
  const openEdit   = (m) => {
    setSelected(m);
    setForm({ nom:m.nom, description:m.description||"", processusId:m.processusId||"", siteId:m.siteId||"", plantId:m.plantId||"", segmentId:m.segmentId||"" });
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal==="create") await createMachine(form);
      else await updateMachine(selected.id, form);
      await load(); closeModal();
    } catch(err) { setMsg(getApiErrorMessage(err)); }
  };

  const handleDelete = async () => {
    const targetId = typeof deleteId === "object" ? deleteId?.id : deleteId;
    if (!targetId) { setDeleteMsg(t("sprint2.machines.errors.delete")); return; }
    setDeleteLoading(true);
    try {
      await deleteMachine(targetId);
      setDeleteMsg(""); setDeleteId(null); await load();
    } catch(err) {
      setDeleteMsg(getApiErrorMessage(err, "sprint2.machines.errors.delete"));
    } finally { setDeleteLoading(false); }
  };

  const clearFilters = () => {
    setSearch(""); setFProcessus(""); setFSite(""); setFPlant(""); setFSegment("");
    setPlants([]); setSegments([]);
  };
  const hasFilter = search || fProcessus || fSite || fPlant || fSegment;

  const currentProcessus = processus.find(p => String(p.id) === String(processusId));

  /* processus chips — only those that have machines */
  const activeProcessus = processus.filter(p =>
    machines.some(m => String(m.processusId) === String(p.id))
  );

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .mach-card{transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s}
        .mach-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,40,80,.12) !important}
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={s.topBar}>
        <div style={s.titleBlock}>
          <div style={s.breadcrumb}>
            {processusId && (
              <button style={s.bcBtn} onClick={() => navigate("/processus")}>
                <IcoPin /> {t("sprint2.machines.backToProcesses")}
              </button>
            )}
            {processusId && <IcoChevron />}
            <span style={s.bcCurrent}>{t("sprint2.machines.title")}</span>
            {currentProcessus && (
              <><IcoChevron /><span style={{ ...s.bcCurrent, color:"var(--l5)" }}>{translate(currentProcessus.nom)}</span></>
            )}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            {processusId && (
              <button style={s.btnBack} onClick={() => navigate("/processus")}><IcoBack /> {t("sprint2.machines.backToProcesses")}</button>
            )}
            <h1 style={s.title}>
              <span style={s.titleIcon}><IcoWrench /></span>
              {t("sprint2.machines.title")}
            </h1>
          </div>

          <p style={s.sub}>
            <span style={s.badge}>{filtered.length}</span>
            {t(hasFilter ? "sprint2.machines.subtitleFiltered" : "sprint2.machines.subtitleTotal", { count: filtered.length })}
            {currentProcessus && <span style={s.filterLabel}> · {translate(currentProcessus.nom)}</span>}
          </p>
        </div>

        <div style={s.actions}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}><IcoSearch /></span>
            <input
              style={s.searchInp}
              placeholder={t("sprint2.machines.searchPlaceholder")}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
          </div>
          {canEdit && (
            <button style={s.btnPrimary} onClick={openCreate}>
              <IcoPlus /> {t("sprint2.machines.new")}
            </button>
          )}
        </div>
      </div>

      
      {/* ── PROCESSUS CHIPS ───────────────────────────────── */}
      {activeProcessus.length > 0 && (
        <div style={s.chipsRow}>
          {activeProcessus.slice(0, 8).map(p => {
            const count    = machines.filter(m => String(m.processusId) === String(p.id)).length;
            const isActive = fProcessus === String(p.id);
            const col      = procColorMap[String(p.id)] || PROC_COLORS[0];
            return (
              <button key={p.id} style={{
                ...s.chip,
                background:  isActive ? col.accent : col.bg,
                color:       isActive ? "#fff" : col.accent,
                borderColor: isActive ? col.accent : col.border,
                boxShadow:   isActive ? `0 3px 12px ${col.accent}30` : "none",
              }} onClick={() => setFProcessus(isActive ? "" : String(p.id))}>
                <IcoGear />
                <span>{translate(p.nom)}</span>
                <span style={{ background: isActive ? "rgba(255,255,255,.25)" : col.pill, color: isActive ? "#fff" : col.accent, padding:"1px 7px", borderRadius:20, fontSize:11, fontWeight:700 }}>{count}</span>
              </button>
            );
          })}
          {hasFilter && (
            <button style={s.chipClear} onClick={clearFilters}>✕ {t("common.reset") || "Tout afficher"}</button>
          )}
        </div>
      )}

      {/* ── GRID ──────────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <>
          <div style={s.grid}>
            {pageItems.map((m, i) => {
              const col = procColorMap[String(m.processusId)] || PROC_COLORS[0];
              return (
                <MachineCard
                  key={m.id} machine={m} col={col} canEdit={canEdit}
                  t={t} translate={translate}
                  onEdit={() => openEdit(m)}
                  onDelete={() => { setDeleteMsg(""); setDeleteId({ id: m.id, nom: m.nom, processus: m.processusNom }); }}
                  onProcFilter={() => setFProcessus(String(m.processusId))}
                  animDelay={i * 0.035}
                />
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}><IcoWrench /></div>
          <p style={s.emptyLabel}>{t("sprint2.machines.empty")}</p>
          {hasFilter && (
            <button style={s.btnGhost} onClick={clearFilters}>{t("admin.common.clearFilters") || "Réinitialiser les filtres"}</button>
          )}
        </div>
      )}

      {/* ── MODAL CREATE / EDIT ────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === "create" ? t("sprint2.machines.modal.createTitle") : t("sprint2.machines.modal.editTitle", { name: selected?.nom })}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid2}>
              <Field label={`${t("sprint2.machines.fields.name")} *`}>
                <input style={s.input} placeholder={t("sprint2.machines.fields.namePlaceholder")} value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} required />
              </Field>
              <Field label={`${t("sprint2.machines.fields.process")} *`}>
                <select style={s.input} value={form.processusId} onChange={e => setForm({...form, processusId:e.target.value})} required>
                  <option value="">{t("common.select")}</option>
                  {processus.map(p => <option key={p.id} value={p.id}>{translate(p.nom)}</option>)}
                </select>
              </Field>
            </div>
            <Field label={t("sprint2.machines.fields.description")}>
              <input style={s.input} placeholder={t("sprint2.machines.fields.descriptionPlaceholder")} value={form.description} onChange={e => setForm({...form, description:e.target.value})} />
            </Field>
            <div style={s.locSection}>
              <div style={s.locTitle}>📍 {t("sprint2.machines.fields.locationOptional")}</div>
              <div style={s.formGrid3}>
                <Field label={t("sprint2.machines.fields.site")}>
                  <select style={s.input} value={form.siteId} onChange={e => handleFormSite(e.target.value)}>
                    <option value="">{t("common.select")}</option>
                    {sites.map(st => <option key={st.id} value={st.id}>{translate(st.nom)}</option>)}
                  </select>
                </Field>
                <Field label={t("sprint2.machines.fields.plant")}>
                  <select style={s.input} value={form.plantId} onChange={e => handleFormPlant(e.target.value)} disabled={!form.siteId}>
                    <option value="">{t("common.select")}</option>
                    {formPlants.map(pl => <option key={pl.id} value={pl.id}>{translate(pl.nom)}</option>)}
                  </select>
                </Field>
                <Field label={t("sprint2.machines.fields.segment")}>
                  <select style={s.input} value={form.segmentId} onChange={e => setForm(f=>({...f, segmentId:e.target.value}))} disabled={!form.plantId}>
                    <option value="">{t("common.select")}</option>
                    {formSegments.map(sg => <option key={sg.id} value={sg.id}>{translate(sg.nom)}</option>)}
                  </select>
                </Field>
              </div>
            </div>
            {msg && <div style={s.errMsg}>{msg}</div>}
            <div style={s.modalFooter}>
              <button type="button" style={s.btnCancel} onClick={closeModal}>{t("common.cancel")}</button>
              <button type="submit" style={s.btnPrimary}>{modal === "create" ? t("sprint2.machines.actions.create") : t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL DELETE ──────────────────────────────────── */}
      {deleteId && (
        <Modal title={t("sprint2.machines.delete.title")} onClose={() => { setDeleteId(null); setDeleteMsg(""); }}>
          <div style={{ textAlign:"center", padding:"12px 0 20px" }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🗑️</div>
            <p style={s.deleteText}>
              {t("sprint2.machines.delete.confirm", { name: translate(deleteId.nom) })}
            </p>
            {deleteId.processus && (
              <p style={{ color:"#f59e0b", fontSize:13, margin:"0 0 12px", padding:"8px 12px", background:"#fffbeb", borderRadius:8, border:"1px solid #fcd34d" }}>
                ⚠️ {t("sprint2.machines.delete.linkedProcess", { process: translate(deleteId.processus) })}
              </p>
            )}
            <p style={s.deleteWarn}>{t("sprint2.machines.delete.warning")}</p>
          </div>
          {deleteMsg && <div style={{ ...s.errMsg, marginBottom:16 }}>{deleteMsg}</div>}
          <div style={s.modalFooter}>
            <button style={s.btnCancel} onClick={() => { setDeleteId(null); setDeleteMsg(""); }} disabled={deleteLoading}>{t("common.cancel")}</button>
            <button style={s.btnDanger} onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "…" : t("sprint2.machines.delete.confirmAction")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── MachineCard ────────────────────────────────────────────── */
function MachineCard({ machine, col, canEdit, onEdit, onDelete, onProcFilter, t, translate, animDelay }) {
  const nom = translate ? translate(machine.nom) : machine.nom;
  return (
    <div className="mach-card" style={{
      borderRadius: 14,
      border: `1px solid ${col.border}`,
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      boxShadow: "0 2px 10px rgba(0,20,60,.05)",
      animation: `fadeUp .32s ease ${animDelay}s both`,
      borderTop: `3px solid ${col.accent}`,
    }}>
      {/* Top */}
      <div style={{ padding:"14px 16px 12px", background: col.bg, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:11, background: col.accent, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:18 }}>
            🔧
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:14.5, color:"#1a2332", lineHeight:1.3, fontFamily:"var(--fd)" }}>{nom}</div>
            <div style={{ fontSize:10, color: col.accent, fontWeight:700 }}>#{machine.id}</div>
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
        {machine.description ? (
          <p style={{ fontSize:12.5, color:"#6b7e94", lineHeight:1.5, margin:0 }}>{translate(machine.description)}</p>
        ) : (
          <p style={{ fontSize:12, color:"#9aacbe", fontStyle:"italic", margin:0 }}>—</p>
        )}

        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
          {/* processus chip */}
          {machine.processusNom && (
            <button style={{ display:"inline-flex", alignItems:"center", gap:5, background: col.bg, color: col.accent, border:`1px solid ${col.border}`, padding:"3px 10px", borderRadius:20, fontSize:11.5, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)" }} onClick={onProcFilter}>
              <IcoGear /> {translate(machine.processusNom)}
            </button>
          )}

          {/* localisation */}
          {machine.siteNom && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"var(--bg-2)", color:"var(--tx-3)", border:"1px solid var(--bd-1)", padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:600 }}>
              <IcoPin /> {translate(machine.siteNom)}
            </span>
          )}
          {machine.plantNom && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"var(--bg-2)", color:"var(--tx-3)", border:"1px solid var(--bd-1)", padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:600 }}>
              🏭 {translate(machine.plantNom)}
            </span>
          )}
          {machine.segmentNom && (
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"var(--bg-2)", color:"var(--tx-3)", border:"1px solid var(--bd-1)", padding:"3px 9px", borderRadius:20, fontSize:11.5, fontWeight:600 }}>
              🗂️ {translate(machine.segmentNom)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Field helper ───────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", marginBottom:6, fontSize:11, fontWeight:700, color:"#3a4a5c", textTransform:"uppercase", letterSpacing:"0.7px" }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = {
  page:         { minHeight:"100%" },
  topBar:       { display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:16, gap:16, flexWrap:"wrap" },
  titleBlock:   {},
  breadcrumb:   { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"var(--tx-4)", marginBottom:8 },
  bcBtn:        { display:"inline-flex", alignItems:"center", gap:4, background:"none", border:"none", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:0, fontFamily:"var(--fb)" },
  bcCurrent:    { color:"var(--tx-3)", fontWeight:600 },
  filterLabel:  { color:"var(--l5)", fontWeight:600 },
  btnBack:      { display:"inline-flex", alignItems:"center", gap:5, background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", color:"var(--tx-3)", fontSize:12, cursor:"pointer", padding:"5px 11px", borderRadius:8, fontFamily:"var(--fb)", fontWeight:600 },
  title:        { fontSize:26, fontWeight:800, color:"var(--tx-1)", fontFamily:"var(--fd)", margin:"0 0 6px", display:"flex", alignItems:"center", gap:10 },
  titleIcon:    { width:34, height:34, borderRadius:10, background:"var(--grd-h)", color:"#fff", display:"inline-flex", alignItems:"center", justifyContent:"center" },
  sub:          { color:"var(--tx-3)", fontSize:14, margin:0, display:"flex", alignItems:"center", gap:8 },
  badge:        { background:"var(--grd-h)", color:"#fff", fontSize:12, fontWeight:700, padding:"2px 10px", borderRadius:20, boxShadow:"var(--sh-blue)" },
  actions:      { display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" },
  filtersBar:   { display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:14, paddingBottom:14, borderBottom:"1px solid var(--bd-1)" },
  searchWrap:   { display:"flex", alignItems:"center", gap:8, background:"var(--bg-1)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"0 12px", height:42, minWidth:200 },
  searchIcon:   { color:"var(--tx-4)", flexShrink:0, display:"flex" },
  searchInp:    { flex:1, border:"none", background:"transparent", fontSize:13, color:"var(--tx-1)", outline:"none", fontFamily:"var(--fb)" },
  clearBtn:     { border:"none", background:"none", color:"var(--tx-4)", cursor:"pointer", fontSize:12, padding:0 },
  select:       { padding:"9px 12px", border:"1.5px solid var(--bd-1)", borderRadius:10, fontSize:13, fontFamily:"var(--fb)", background:"var(--bg-1)", color:"var(--tx-1)", outline:"none", height:42 },
  btnPrimary:   { display:"inline-flex", alignItems:"center", gap:7, background:"var(--grd-h)", color:"#fff", border:"none", borderRadius:10, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:13.5, fontFamily:"var(--fb)", boxShadow:"var(--sh-blue)", whiteSpace:"nowrap", transition:"all .15s" },
  btnGhost:     { display:"inline-flex", alignItems:"center", gap:6, background:"var(--bg-1)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:10, padding:"9px 16px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnCancel:    { background:"var(--bg-3)", color:"var(--tx-2)", border:"1.5px solid var(--bd-1)", borderRadius:9, padding:"9px 18px", fontWeight:600, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  btnDanger:    { background:"#dc2626", color:"#fff", border:"none", borderRadius:9, padding:"9px 18px", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"var(--fb)" },
  chipsRow:     { display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center" },
  chip:         { display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:20, border:"1.5px solid", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)", transition:"all .15s" },
  chipClear:    { display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:20, border:"1.5px solid #fecaca", background:"#fef2f2", color:"#dc2626", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"var(--fb)" },
  grid:         { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:18 },
  empty:        { padding:"60px 20px", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:14 },
  emptyIconWrap:{ width:64, height:64, borderRadius:"50%", background:"var(--bg-2)", border:"1.5px solid var(--bd-1)", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--tx-4)", fontSize:24 },
  emptyLabel:   { fontWeight:700, color:"var(--tx-2)", fontSize:15, margin:0 },
  input:        { width:"100%", padding:"10px 14px", border:"1.5px solid var(--bd-1)", borderRadius:9, fontSize:14, boxSizing:"border-box", fontFamily:"var(--fb)", background:"var(--bg-2)", color:"var(--tx-1)", outline:"none" },
  errMsg:       { background:"#fef2f2", color:"#dc2626", padding:"10px 14px", borderRadius:9, fontSize:13, marginBottom:12, border:"1px solid #fecaca" },
  modalFooter:  { display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 },
  deleteText:   { color:"var(--tx-2)", lineHeight:1.7, marginBottom:8, fontWeight:600 },
  deleteWarn:   { fontSize:12, color:"var(--tx-4)", marginBottom:0 },
  locSection:   { background:"var(--bg-2)", borderRadius:9, padding:"14px 16px", marginBottom:16, border:"1px solid var(--bd-1)" },
  locTitle:     { fontSize:13, fontWeight:700, color:"var(--tx-2)", marginBottom:12 },
  formGrid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  formGrid3:    { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 },
};