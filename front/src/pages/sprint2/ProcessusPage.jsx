import { useState, useEffect } from "react";
import { getAllProcessus, createProcessus, updateProcessus, deleteProcessus, getAllSegments, getAllPlants, getAllSites } from "../../api";
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
const IcoArrow   = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoChevron = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>;
const IcoGear    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
const IcoGrid    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoWrench  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>;
const IcoPin     = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>;
const IcoBack    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>;

/* ─── Segment color palette ──────────────────────────────────── */
const SEG_COLORS = [
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

/* ─── Main component ─────────────────────────────────────────── */
export default function ProcessusPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const canEdit = ["PPO", "ADMIN", "ADMIN_PLANT"].includes(user?.role);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const segmentId = searchParams.get("segmentId");
  const translate = (value) => value;

  const [list,            setList]            = useState([]);
  const [sites,           setSites]           = useState([]);
  const [plants,          setPlants]          = useState([]);
  const [segments,        setSegments]        = useState([]);
  const [selectedSite,    setSelectedSite]    = useState("");
  const [selectedPlant,   setSelectedPlant]   = useState("");
  const [search,          setSearch]          = useState("");
  const [modal,           setModal]           = useState(null);
  const [selected,        setSelected]        = useState(null);
  const [deleteId,        setDeleteId]        = useState(null);
  const [deleteMsg,       setDeleteMsg]       = useState("");
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [form,            setForm]            = useState({ nom: "", description: "", siteId: "", plantId: "", segmentId: segmentId || "" });
  const [msg,             setMsg]             = useState("");

  /* colour maps */
  const segColorMap = {};
  segments.forEach((seg, i) => { segColorMap[String(seg.id)] = SEG_COLORS[i % SEG_COLORS.length]; });

  const segmentById = segments.reduce((acc, seg) => { acc[String(seg.id)] = seg; return acc; }, {});
  const plantById = plants.reduce((acc, pl) => { acc[String(pl.id)] = pl; return acc; }, {});
  const filteredPlants = selectedSite
    ? plants.filter(pl => String(pl.siteId) === String(selectedSite))
    : plants;

  const filteredList = list
    .filter(p => {
      if (selectedSite) {
        const seg = segmentById[String(p.segmentId)];
        if (!seg) return false;
        const pl = plantById[String(seg.plantId)];
        return pl && String(pl.siteId) === String(selectedSite);
      }
      if (selectedPlant) {
        const seg = segmentById[String(p.segmentId)];
        return seg && String(seg.plantId) === String(selectedPlant);
      }
      return true;
    })
    .filter(p => !search.trim() || p.nom?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase()));

  const { page, setPage, pageItems, totalPages, total } = usePagination(filteredList, PAGE_SIZE);
  const deleteTarget = list.find(p => String(p.id) === String(deleteId));

  const getApiErrorMessage = (err, fallbackKey = "common.error") => {
    const data = err?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    return t(fallbackKey);
  };

  useEffect(() => { load(); loadSegments(); loadPlants(); loadSites(); }, []); // eslint-disable-line
  useEffect(() => { window.scrollTo({ top: 0, behavior: "smooth" }); }, [page]);
  useEffect(() => { setPage(0); }, [selectedSite, selectedPlant, search, setPage]);

  const load          = async () => { const r = await getAllProcessus(); setList(Array.isArray(r.data) ? r.data : []); };
  const loadSites     = async () => { const r = await getAllSites();     setSites(Array.isArray(r.data) ? r.data : []); };
  const loadPlants    = async () => { const r = await getAllPlants();    setPlants(Array.isArray(r.data) ? r.data : []); };
  const loadSegments  = async () => { const r = await getAllSegments();  setSegments(Array.isArray(r.data) ? r.data : []); };

  const openCreate = () => {
    // Prefill site/plant when segmentId is present in query
    let initial = { nom: "", description: "", siteId: "", plantId: "", segmentId: segmentId || "" };
    if (segmentId) {
      const seg = segmentById[String(segmentId)];
      if (seg) {
        initial.segmentId = String(seg.id);
        initial.plantId = seg.plantId ? String(seg.plantId) : "";
        initial.siteId = initial.plantId && plantById[String(initial.plantId)] ? String(plantById[String(initial.plantId)].siteId) : "";
      }
    }
    setForm(initial);
    setModal("create");
  };
  const openEdit   = (p) => {
    const seg = segmentById[String(p.segmentId)];
    const plantIdVal = seg?.plantId ? String(seg.plantId) : "";
    const siteIdVal = plantIdVal && plantById[String(plantIdVal)] ? String(plantById[String(plantIdVal)].siteId) : "";
    setSelected(p);
    setForm({ nom: p.nom, description: p.description || "", siteId: siteIdVal, plantId: plantIdVal, segmentId: p.segmentId || "" });
    setModal("edit");
  };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.siteId) { setMsg(t("sprint2.processes.errors.siteRequired") || "Le site est requis."); return; }
    if (!form.plantId) { setMsg(t("sprint2.processes.errors.plantRequired") || "Le plant est requis."); return; }
    try {
      const payload = { nom: form.nom, description: form.description, siteId: Number(form.siteId), plantId: Number(form.plantId) };
      if (form.segmentId) payload.segmentId = Number(form.segmentId);
      if (modal === "create") await createProcessus(payload);
      else await updateProcessus(selected.id, payload);
      await load(); closeModal();
    } catch (err) { setMsg(getApiErrorMessage(err)); }
  };

  const handleDelete = async () => {
    const targetId = typeof deleteId === "object" ? deleteId?.id : deleteId;
    if (!targetId) return;
    setDeleteLoading(true);
    try {
      const res = await deleteProcessus(targetId);
      if (typeof res?.data === "string" && res.data.trim()) alert(res.data);
      setDeleteMsg(""); setDeleteId(null); await load();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) setDeleteMsg(t("sprint2.processes.errors.sessionExpired"));
      else if (status === 403) setDeleteMsg(t("sprint2.processes.errors.forbidden"));
      else setDeleteMsg(getApiErrorMessage(err, "sprint2.processes.errors.delete"));
    } finally { setDeleteLoading(false); }
  };

  const handleSiteFilterChange = (value) => {
    setSelectedSite(value);
    if (!value) { setSelectedPlant(""); return; }
    if (selectedPlant) {
      const pl = plants.find(p => String(p.id) === String(selectedPlant));
      if (!pl || String(pl.siteId) !== String(value)) setSelectedPlant("");
    }
  };

  const handlePlantFilterChange = (value) => {
    setSelectedPlant(value);
  };

  const clearFilters = () => { setSelectedSite(""); setSelectedPlant(""); setSearch(""); };
  const currentSite    = sites.find(s => String(s.id) === String(selectedSite));
  const currentPlant   = plants.find(p => String(p.id) === String(selectedPlant));

  return (
    <div style={s.page}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .proc-card{transition:transform .2s cubic-bezier(.4,0,.2,1),box-shadow .2s}
        .proc-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,40,80,.12) !important}
        .nav-btn-proc:hover{opacity:.85;transform:translateY(-1px)}
        @media (max-width: 768px) {
          .filters-mobile {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={s.topBar}>
        <div style={s.titleBlock}>
          <div style={s.breadcrumb}>
            {segmentId && (
              <button style={s.bcBtn} onClick={() => navigate("/segments")}>
                <IcoPin /> {t("sprint2.processes.backToSegments")}
              </button>
            )}
            {segmentId && <IcoChevron />}
            <span style={s.bcCurrent}>{t("sprint2.processes.title")}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {segmentId && (
              <button style={s.btnBack} onClick={() => navigate("/segments")}><IcoBack /> {t("sprint2.processes.backToSegments")}</button>
            )}
            <h1 style={s.title}>
              <span style={s.titleIcon}><IcoGear /></span>
              {t("sprint2.processes.title")}
            </h1>
          </div>

          <p style={s.sub}>
            <span style={s.badge}>{filteredList.length}</span>
            {t("sprint2.processes.subtitle", { count: filteredList.length })}
            {currentSite && <span style={s.filterLabel}> · {translate(currentSite.nom)}</span>}
            {currentPlant && !currentSite && <span style={s.filterLabel}> · {translate(currentPlant.nom)}</span>}
          </p>
        </div>

        {/* actions area (moved into filters row for compact layout) */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} aria-hidden>
          {/* placeholder to keep topBar balanced on small screens */}
        </div>
      </div>

      {/* ── BARRE FILTRES SITE / PLANT ─────────────────── */}
      {/* ── FILTER BAR MODERNE ─────────────────── */}
<div className="filters-mobile" style={s.filtersBarModern}>
  {/* SEARCH */}
  <div style={s.searchModern}>
    <span style={s.searchIcon}>
      <IcoSearch />
    </span>

    <input
      style={s.searchModernInput}
      placeholder="Rechercher..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

  {/* SITE */}
  <select
    style={s.selectModern}
    value={selectedSite}
    onChange={(e) => handleSiteFilterChange(e.target.value)}
  >
    <option value="">Site</option>

    {sites.map((s) => (
      <option key={s.id} value={String(s.id)}>
        {translate(s.nom)}
      </option>
    ))}
  </select>

  {/* PLANT */}
  <select
    style={s.selectModern}
    value={selectedPlant}
    onChange={(e) => handlePlantFilterChange(e.target.value)}
  >
    <option value="">Plant</option>

    {filteredPlants.map((p) => (
      <option key={p.id} value={String(p.id)}>
        {translate(p.nom)}
      </option>
    ))}
  </select>

  {/* RESET */}
  {(selectedSite || selectedPlant || search) && (
    <button style={s.resetBtnModern} onClick={clearFilters}>
      ✕
    </button>
  )}

  {/* ADD BUTTON */}
  {canEdit && (
    <button style={s.addBtnModern} onClick={openCreate}>
      <IcoPlus />
      Nouveau
    </button>
  )}
</div>


      {/* ── SEGMENT CHIPS ─────────────────────────────────── */}
      {/* Segment chips removed - filtering now by site and plant */}

      {/* ── GRID ──────────────────────────────────────────── */}
      {filteredList.length > 0 ? (
        <>
          <div style={s.grid}>
            {pageItems.map((p, i) => {
              const col = segColorMap[String(p.segmentId)] || SEG_COLORS[0];
              return (
                <ProcessCard
                  key={p.id} process={p} col={col} canEdit={canEdit}
                  t={t} translate={translate}
                  segmentName={segmentById[String(p.segmentId)]?.nom}
                  onEdit={() => openEdit(p)}
                  onDelete={() => { setDeleteId(p.id); setDeleteMsg(""); }}
                  onMachines={() => navigate(`/machines?processusId=${p.id}`)}
                  onCriteres={() => navigate(`/criteres?processusId=${p.id}`)}
                  animDelay={i * 0.035}
                />
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <div style={s.empty}>
          <div style={s.emptyIconWrap}><IcoGear /></div>
          <p style={s.emptyLabel}>{t("sprint2.processes.empty") || "Aucun processus trouvé"}</p>
          {(selectedSite || selectedPlant || search) && (
            <button style={s.btnGhost} onClick={clearFilters}>{t("admin.common.clearFilters") || "Réinitialiser les filtres"}</button>
          )}
        </div>
      )}

      {/* ── MODAL CREATE / EDIT ────────────────────────────── */}
      {modal && (
        <Modal
          title={modal === "create" ? t("sprint2.processes.modal.createTitle") : t("sprint2.processes.modal.editTitle")}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            <Field label={`${t("sprint2.processes.fields.name")} *`}>
              <input style={s.input} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required />
            </Field>
            <Field label={t("sprint2.processes.fields.description")}>
              <textarea style={{ ...s.input, minHeight: 72, resize: "vertical" }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label={t("common.site") || "Site *"}>
              <select style={s.input} value={form.siteId} onChange={e => { setForm({ ...form, siteId: e.target.value, plantId: "" }); }} required>
                <option value="">{t("common.select")}</option>
                {sites.map(s => <option key={s.id} value={s.id}>{translate(s.nom)}</option>)}
              </select>
            </Field>
            <Field label={t("sprint2.checklist.fields.plant") || "Plant *"}>
              <select style={s.input} value={form.plantId} onChange={e => setForm({ ...form, plantId: e.target.value })} required disabled={!form.siteId}>
                <option value="">{t("common.select")}</option>
                {(form.siteId ? plants.filter(p => String(p.siteId) === String(form.siteId)) : plants).map(pl => <option key={pl.id} value={pl.id}>{translate(pl.nom)}</option>)}
              </select>
            </Field>
            <Field label={t("sprint2.processes.fields.segment") || "Segment"}>
              <select style={s.input} value={form.segmentId} onChange={e => setForm({ ...form, segmentId: e.target.value })}>
                <option value="">{t("common.select") || "-- Sélectionner un segment --"}</option>
                {segments.map(seg => <option key={seg.id} value={seg.id}>{translate(seg.nom)}</option>)}
              </select>
            </Field>
            {msg && <div style={s.errMsg}>{msg}</div>}
            <div style={s.modalFooter}>
              <button type="button" style={s.btnCancel} onClick={closeModal}>{t("common.cancel")}</button>
              <button type="submit" style={s.btnPrimary}>{t("common.save")}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL DELETE ──────────────────────────────────── */}
      {deleteId && (
        <Modal title={t("sprint2.processes.delete.title")} onClose={() => { setDeleteId(null); setDeleteMsg(""); }}>
          <div style={{ textAlign: "center", padding: "12px 0 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <p style={s.deleteText}>
              {t("sprint2.processes.delete.confirm", { name: deleteTarget?.nom || "" })}
              <span style={s.deleteWarn}>{t("sprint2.processes.delete.warning") || "Cette action est irréversible."}</span>
            </p>
          </div>
          {deleteMsg && <div style={{ ...s.errMsg, marginBottom: 16 }}>{deleteMsg}</div>}
          <div style={s.modalFooter}>
            <button style={s.btnCancel} onClick={() => { setDeleteId(null); setDeleteMsg(""); }} disabled={deleteLoading}>{t("common.cancel")}</button>
            <button style={{ ...s.btnDanger, opacity: deleteLoading ? 0.7 : 1 }} onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "…" : t("common.delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── ProcessCard ────────────────────────────────────────────── */
function ProcessCard({ process, col, canEdit, onEdit, onDelete, onSegmentFilter, onMachines, onCriteres, t, translate, segmentName, animDelay }) {
  const nom = translate ? translate(process.nom) : process.nom;
  return (
    <div className="proc-card" style={{
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
      <div style={{ padding: "14px 16px 12px", background: col.bg, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: col.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <IcoGear />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "#1a2332", lineHeight: 1.3, fontFamily: "var(--fd)" }}>{nom}</div>
            <div style={{ fontSize: 10, color: col.accent, fontWeight: 700 }}>#{process.id}</div>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: 5 }}>
            <button style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${col.border}`, background: "var(--bg-1)", color: col.accent, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onEdit}><IcoEdit /></button>
            <button style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={onDelete}><IcoTrash /></button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {process.description ? (
          <p style={{ fontSize: 12.5, color: "#6b7e94", lineHeight: 1.5, margin: 0 }}>{translate(process.description)}</p>
        ) : (
          <p style={{ fontSize: 12, color: "#9aacbe", fontStyle: "italic", margin: 0 }}>—</p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* machine count badge */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: col.bg, color: col.accent, border: `1px solid ${col.border}`, padding: "3px 9px", borderRadius: 20, fontSize: 11.5, fontWeight: 600 }}>
            🔩 {t("sprint2.processes.machineCount", { count: process.machineCount ?? 0 })}
          </span>

          {/* segment chip */}
          {segmentName && (
            <button style={{ display: "inline-flex", alignItems: "center", gap: 5, background: col.bg, color: col.accent, border: `1px solid ${col.border}`, padding: "3px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--fb)", alignSelf: "flex-start" }} onClick={onSegmentFilter}>
              <IcoPin /> {translate(segmentName)}
            </button>
          )}
        </div>
      </div>

      {/* Footer – navigation buttons */}
      <div style={{ padding: "10px 16px", borderTop: `1px solid ${col.border}`, background: col.bg, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="nav-btn-proc" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", color: col.accent, border: `1.5px solid ${col.border}`, borderRadius: 9, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--fb)", transition: "all .15s" }} onClick={onMachines}>
          <IcoWrench /> {t("sprint2.processes.machines")} <IcoArrow />
        </button>
        <button className="nav-btn-proc" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: col.accent, color: "#fff", border: "none", borderRadius: 9, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--fb)", boxShadow: `0 3px 12px ${col.accent}30`, transition: "all .15s" }} onClick={onCriteres}>
          <IcoGrid /> {t("sprint2.processes.criteres")} <IcoArrow />
        </button>
      </div>
    </div>
  );
}

/* ─── Field helper ───────────────────────────────────────────── */
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#3a4a5c", textTransform: "uppercase", letterSpacing: "0.7px" }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────── */
const s = {
filtersBarModern: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
  overflowX: "auto",
  background: "#fff",
  borderRadius: 18,
  padding: "10px 12px",
  marginBottom: 10,
  border: "1px solid #e5e7eb",
  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
},

 searchModern: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#f3f4f6",
  borderRadius: 999,
  padding: "0 12px",
  height: 36,
  flex: 1,
  minWidth: 180,
},


searchModernInput: {
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 12.5,
  width: "100%",
  color: "#374151",
},

selectModern: {
  height: 36,
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  padding: "0 12px",
  background: "#f9fafb",
  fontSize: 12.5,
  color: "#374151",
  outline: "none",
  minWidth: 130,
  maxWidth: 150,
  cursor: "pointer",
},

resetBtnModern: {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "none",
  background: "#fee2e2",
  color: "#dc2626",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
  flexShrink: 0,
},

addBtnModern: {
  display: "flex",
  alignItems: "center",
  gap: 5,
  height: 36,
  padding: "0 14px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg,#4f46e5,#6366f1)",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 12,
  whiteSpace: "nowrap",
  flexShrink: 0,
},
  page:         { minHeight: "100%" },
  topBar:       { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 16, flexWrap: "wrap" },
  titleBlock:   {},
  breadcrumb:   { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--tx-4)", marginBottom: 8 },
  bcBtn:        { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--tx-3)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "var(--fb)" },
  bcCurrent:    { color: "var(--tx-3)", fontWeight: 600 },
  filterLabel:  { color: "var(--l5)", fontWeight: 600 },
  btnBack:      { display: "inline-flex", alignItems: "center", gap: 5, background: "var(--bg-2)", border: "1.5px solid var(--bd-1)", color: "var(--tx-3)", fontSize: 12, cursor: "pointer", padding: "5px 11px", borderRadius: 8, fontFamily: "var(--fb)", fontWeight: 600 },
  title:        { fontSize: 26, fontWeight: 800, color: "var(--tx-1)", fontFamily: "var(--fd)", margin: "0 0 6px", display: "flex", alignItems: "center", gap: 10 },
  titleIcon:    { width: 34, height: 34, borderRadius: 10, background: "var(--grd-h)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" },
  sub:          { color: "var(--tx-3)", fontSize: 14, margin: 0, display: "flex", alignItems: "center", gap: 8 },
  badge:        { background: "var(--grd-h)", color: "#fff", fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 20, boxShadow: "var(--sh-blue)" },
  actions:      { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  filtersLeft: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  flex: 1,
  minWidth: 0,
},

filtersRight: {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
},

compactSelect: {
  height: 36,
  minWidth: 110,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--bd-1)",
  background: "#fff",
  fontSize: 12,
  outline: "none",
  flex: "0 0 auto",
},

searchWrapCompact: {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#fff",
  border: "1px solid var(--bd-1)",
  borderRadius: 8,
  padding: "0 10px",
  height: 36,
  minWidth: 180,
  flex: 1,
},

btnPrimaryCompact: {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 36,
  padding: "0 12px",
  border: "none",
  borderRadius: 8,
  background: "var(--grd-h)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
},
  filtersBar:   { dispfiltersBar: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  background: "var(--surface-0)",
  border: "1px solid var(--surface-3)",
  borderRadius: 14,
  padding: "10px 12px",
  marginBottom: 12,
  boxShadow: "var(--shadow-sm)",
},lay: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", background: "var(--surface-0)", border: "1px solid var(--surface-3)", borderRadius: "var(--radius-lg)", padding: "8px 10px", marginBottom: 28, boxShadow: "var(--shadow-sm)" },
  searchWrap:   { display: "flex", alignItems: "center", gap: 8, background: "var(--bg-1)", border: "1.5px solid var(--bd-1)", borderRadius: 10, padding: "0 12px", height: 42, minWidth: 200 },
  searchIcon:   { color: "var(--tx-4)", flexShrink: 0, display: "flex" },
  searchInp:    { flex: 1, border: "none", background: "transparent", fontSize: 13, color: "var(--tx-1)", outline: "none", fontFamily: "var(--fb)" },
  clearBtn:     { border: "none", background: "none", color: "var(--tx-4)", cursor: "pointer", fontSize: 12, padding: 0 },
  select:       { padding: "9px 12px", border: "1.5px solid var(--bd-1)", borderRadius: 10, fontSize: 13, fontFamily: "var(--fb)", background: "var(--bg-1)", color: "var(--tx-1)", outline: "none", height: 42,  minWidth: 120, flex: '0 0 auto' },
  btnPrimary:   { display: "inline-flex", alignItems: "center", gap: 7, background: "var(--grd-h)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13.5, fontFamily: "var(--fb)", boxShadow: "var(--sh-blue)", whiteSpace: "nowrap", transition: "all .15s" },
  btnGhost:     { display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", color: "var(--tx-2)", border: "1.5px solid var(--bd-1)", borderRadius: 10, padding: "9px 16px", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  btnCancel:    { background: "var(--bg-3)", color: "var(--tx-2)", border: "1.5px solid var(--bd-1)", borderRadius: 9, padding: "9px 18px", fontWeight: 600, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  btnDanger:    { background: "#dc2626", color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--fb)" },
  chipsRow:     { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap", alignItems: "center" },
  chip:         { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--fb)", transition: "all .15s" },
  chipClear:    { display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 20, border: "1.5px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--fb)" },
  grid:         { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 18 },
  empty:        { padding: "60px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 },
  emptyIconWrap:{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg-2)", border: "1.5px solid var(--bd-1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx-4)", fontSize: 24 },
  emptyLabel:   { fontWeight: 700, color: "var(--tx-2)", fontSize: 15, margin: 0 },
  input:        { width: "100%", padding: "10px 14px", border: "1.5px solid var(--bd-1)", borderRadius: 9, fontSize: 14, boxSizing: "border-box", fontFamily: "var(--fb)", background: "var(--bg-2)", color: "var(--tx-1)", outline: "none" },
  errMsg:       { background: "#fef2f2", color: "#dc2626", padding: "10px 14px", borderRadius: 9, fontSize: 13, marginBottom: 12, border: "1px solid #fecaca" },
  modalFooter:  { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 },
  deleteText:   { color: "var(--tx-2)", lineHeight: 1.7, marginBottom: 4 },
  deleteWarn:   { fontSize: 12, color: "var(--tx-4)", display: "block", marginTop: 4 },
};