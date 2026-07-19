import { useState, useEffect } from "react";
import {
  getAllUtilisateurs, createUtilisateur, updateUtilisateur,
  deleteUtilisateur, getAllRoles, reactiverUtilisateur, hardDeleteUtilisateur,
  getAllProcessus, getAllSites, getPlantsBySite, getSegmentsByPlant,
} from "../../api";
import Modal from "../../components/Modal";
import Pagination from "../../components/Pagination";
import { useI18n } from "../../context/I18nContext";
import { useAuth } from "../../context/AuthContext";

const PAGE_SIZE = 10;

const ROLE_COLORS = {
  ADMIN:"#6366f1", ADMIN_PLANT:"#4f46e5", OPERATEUR:"#10b981", CHEF_LIGNE:"#818cf8",
  AGENT_QUALITE:"#8b5cf6", TECHNICIEN:"#14b8a6", PPO:"#f59e0b",
};

function Avatar({ nom }) {
  const initials = (nom || "?")
    .split(" ")
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 800,
        flexShrink: 0,
        boxShadow: "0 4px 10px rgba(99,102,241,0.25)",
        border: "2px solid rgba(255,255,255,0.9)",
      }}
    >
      {initials}
    </div>
  );
}

const EMPTY_FORM = { nom:"", matricule:"", password:"", roleId:"", processusId:"", siteId:"", plantId:"", segmentId:"" };

function toErrorText(err, fallback = "Erreur serveur.") {
  const data = err?.response?.data;
  const looksTechnical = (text) =>
    typeof text === "string" &&
    /could not execute statement|SQLException|ConstraintViolationException|StackTrace|at com\.example|nested exception/i.test(text);
  if (typeof data === "string") {
    return looksTechnical(data) ? "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer." : data;
  }
  if (data && typeof data === "object") {
    const m = data.message || data.error;
    if (looksTechnical(m)) return "Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.";
    return m || `${fallback} (code ${data.status || "inconnu"})`;
  }
  return err?.message || fallback;
}

export default function UtilisateursPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  // Un créateur "scopé" (ADMIN_PLANT, CHEF_LIGNE, ...) ne gère que son propre plant :
  // le site/plant/segment sont donc verrouillés et assignés automatiquement côté backend.
  const isSystemAdmin = user?.role === "ADMIN";
  const [users,        setUsers]        = useState([]);
  const [roles,        setRoles]        = useState([]);
  const [processList,  setProcessList]  = useState([]);
  const [sites,        setSites]        = useState([]);
  const [plants,       setPlants]       = useState([]);
  const [segments,     setSegments]     = useState([]);
  const [modal,        setModal]        = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [deleteId,     setDeleteId]     = useState(null);
  const [hardDeleteId, setHardDeleteId] = useState(null);
  const [reactivateId, setReactivateId] = useState(null);
  const [hardDeleteMsg,setHardDeleteMsg]= useState("");
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [msg,          setMsg]          = useState("");
  const [saving,       setSaving]       = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterRole,   setFilterRole]   = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterSite,   setFilterSite]   = useState("");
  const [filterPlant,  setFilterPlant]  = useState("");
  const [page,         setPage]         = useState(0);
  const [loadError,    setLoadError]    = useState("");
  const [expandedIds,  setExpandedIds]  = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(0); }, [search, filterRole, filterStatut, filterSite, filterPlant]);

  const load = async () => {
    try {
      setLoadError("");
      const [u, r, p, s] = await Promise.all([
        getAllUtilisateurs(), getAllRoles(), getAllProcessus(), getAllSites(),
      ]);
      setUsers(Array.isArray(u.data) ? u.data : []);
      setRoles(Array.isArray(r.data) ? r.data : []);
      setProcessList(Array.isArray(p.data) ? p.data : []);
      setSites(Array.isArray(s.data) ? s.data : []);
    } catch (err) {
      setLoadError(toErrorText(err, "Erreur serveur lors du chargement des utilisateurs."));
      setUsers([]); setRoles([]); setProcessList([]); setSites([]);
    }
  };

  const selectedRoleName = (roles.find(r => String(r.id) === String(form.roleId))?.nom || "").trim().toUpperCase();
  const isOperateurRole  = selectedRoleName === "OPERATEUR";

  const openCreate = () => {
    setForm(isSystemAdmin ? EMPTY_FORM : {
      ...EMPTY_FORM,
      siteId: user?.siteId ? String(user.siteId) : "",
      plantId: user?.plantId ? String(user.plantId) : "",
    });
    setMsg(""); setModal("create");
  };
  const openEdit   = (u) => {
    setSelected(u);
    setForm({
      nom: u.nom, matricule: u.matricule, password: "",
      roleId:      u.role?.id      || "",
      processusId: u.processus?.id || u.processusId || "",
      siteId:      u.site?.id      || u.siteId      || "",
      plantId:     u.plant?.id     || u.plantId     || "",
      segmentId:   u.segment?.id   || u.segmentId   || "",
    });
    setMsg(""); setModal("edit");
  };
  const closeModal = () => { setModal(null); setSelected(null); setMsg(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return; // Empêche le double-clic / double-soumission
    const parsedRoleId = Number(form.roleId);
    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) { setMsg("Veuillez sélectionner un rôle valide."); return; }
    if (isOperateurRole && !form.processusId) { setMsg("Veuillez sélectionner un processus pour l'opérateur."); return; }
    const parsedProcessusId = isOperateurRole ? Number(form.processusId) : null;
    if (isOperateurRole && (!Number.isInteger(parsedProcessusId) || parsedProcessusId <= 0)) { setMsg("Processus invalide pour l'opérateur."); return; }
    const parsedSiteId    = form.siteId    ? Number(form.siteId)    : null;
    const parsedPlantId   = form.plantId   ? Number(form.plantId)   : null;
    const parsedSegmentId = form.segmentId ? Number(form.segmentId) : null;
    if (selectedRoleName !== "ADMIN" && (!parsedSiteId || !parsedPlantId)) {
      setMsg("Veuillez sélectionner un site et un plant pour cet utilisateur.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nom: form.nom, matricule: form.matricule, roleId: parsedRoleId,
        ...(form.password   ? { password:    form.password     } : {}),
        ...(isOperateurRole ? { processusId: parsedProcessusId } : {}),
        ...(parsedSiteId    ? { siteId:      parsedSiteId      } : {}),
        ...(parsedPlantId   ? { plantId:     parsedPlantId     } : {}),
        ...(parsedSegmentId ? { segmentId:   parsedSegmentId   } : {}),
      };
      const response = modal === "create"
        ? await createUtilisateur(payload)
        : await updateUtilisateur(selected.id, payload);

      const savedUser = response?.data || response;
      if (savedUser?.id) {
        setUsers(prev => {
          if (modal === "create") {
            return [savedUser, ...prev];
          }
          return prev.map(u => String(u.id) === String(savedUser.id) ? savedUser : u);
        });
      }

      closeModal();
      load().catch(err => {
        setLoadError(toErrorText(err, "Utilisateur enregistré, mais le rafraîchissement a échoué."));
      });
    }  catch (err) {
      // Le backend renvoie un message texte brut (body(e.getMessage())), pas du JSON {message}.
      // err.response.data est donc directement la string d'erreur -> toErrorText() la gère déjà.
      setMsg(toErrorText(err, t("common.error")));
    } finally {
      setSaving(false);
    }
  };

  const handleDesactiver = async () => { await deleteUtilisateur(deleteId); setDeleteId(null); load(); };
  const handleReactiver  = async () => {
    try { await reactiverUtilisateur(reactivateId); } catch (err) { console.error(err); }
    finally { setReactivateId(null); load(); }
  };
  const handleHardDelete = async () => {
    try { await hardDeleteUtilisateur(hardDeleteId); setHardDeleteMsg(""); setHardDeleteId(null); await load(); }
    catch (e) { setHardDeleteMsg(toErrorText(e, "Suppression définitive échouée.")); }
  };

  const filtered = users.filter(u => {
    if (search       && !(u.nom||"").toLowerCase().includes(search.toLowerCase())
                     && !(u.matricule||"").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRole   && u.role?.nom !== filterRole)    return false;
    if (filterStatut === "actif"   && !u.actif)        return false;
    if (filterStatut === "inactif" &&  u.actif)        return false;
    if (filterSite   && String(u.site?.id || u.siteId || "") !== String(filterSite))  return false;
    if (filterPlant  && String(u.plant?.id || u.plantId || "") !== String(filterPlant)) return false;
    return true;
  });

  const stats      = { total: users.length, actifs: users.filter(u=>u.actif).length, inactifs: users.filter(u=>!u.actif).length };
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getProcessusLabel = (u) => (u.role?.nom !== "OPERATEUR" ? null : u.processus?.nom || u.processusNom || null);
  const getPlantLabel     = (u) => u.plant?.nom   || u.plantNom   || null;
  const getSegmentLabel   = (u) => u.segment?.nom || u.segmentNom || null;
  const getSiteLabel      = (u) => u.site?.nom    || u.siteNom    || null;

  const loadPlantsForSite = async (siteId) => {
    if (!siteId) { setPlants([]); return; }
    try { const res = await getPlantsBySite(siteId); setPlants(Array.isArray(res.data) ? res.data : []); }
    catch { setPlants([]); }
  };
  const loadSegmentsForPlant = async (plantId) => {
    if (!plantId) { setSegments([]); return; }
    try { const res = await getSegmentsByPlant(plantId); setSegments(Array.isArray(res.data) ? res.data : []); }
    catch { setSegments([]); }
  };

  useEffect(() => { if (!modal) return; loadPlantsForSite(form.siteId); },    [modal, form.siteId]);
  useEffect(() => { if (!modal) return; loadSegmentsForPlant(form.plantId); }, [modal, form.plantId]);

  return (
    <div>
      {/* TOP BAR */}
      <div style={s.topBar}>
        <div>
          <h1 style={s.title}>{t("admin.users.title")}</h1>
          <p style={s.sub}>{t("admin.users.summary", { active: stats.actifs, inactive: stats.inactifs })}</p>
        </div>
        <button style={s.btnPrimary} onClick={openCreate}>{t("admin.users.new")}</button>
      </div>

      {loadError && (
        <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:13, fontWeight:600 }}>
          {loadError}
        </div>
      )}

      {/* KPIs */}
      <div style={s.kpiRow}>
        {[
          { key:"total",    value:stats.total,    color:"#3b82f6", icon:"👥" },
          { key:"active",   value:stats.actifs,   color:"#10b981", icon:"✅" },
          { key:"inactive", value:stats.inactifs, color:"#ef4444", icon:"🚫" },
          { key:"roles",    value:roles.length,   color:"#8b5cf6", icon:"🎭" },
        ].map(k => (
          <div key={k.key} style={{...s.kpiCard, borderTop:`3px solid ${k.color}`}}>
            <div style={{fontSize:20, marginBottom:4}}>{k.icon}</div>
            <div style={{fontSize:24, fontWeight:800, color:k.color}}>{k.value}</div>
            <div style={{fontSize:12, color:"#6b7280", fontWeight:600}}>{t(`admin.users.kpi.${k.key}`)}</div>
          </div>
        ))}
      </div>

      {/* ── FILTRES : une seule ligne plate ── */}
      <div style={s.filterBar} className="filters-responsive">
        {/* Recherche */}
        <div style={s.searchBox}>
          <span style={s.searchIcon}>🔍</span>
          <input
            style={s.searchInput}
            placeholder={t("admin.users.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filtre rôle */}
        <select style={s.filterSelect} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="">{t("admin.users.allRoles")}</option>
          {roles.map(r => <option key={r.id} value={r.nom}>{r.nom}</option>)}
        </select>

        {/* Filtre site */}
        <select style={s.filterSelect} value={filterSite} onChange={async e => { const v = e.target.value; setFilterSite(v); setFilterPlant(""); await loadPlantsForSite(v); }}>
          <option value="">{t("admin.users.allSites") || "Tous les sites"}</option>
          {sites.map(sit => <option key={sit.id} value={sit.id}>{sit.nom}</option>)}
        </select>

        {/* Filtre plant */}
        <select style={s.filterSelect} value={filterPlant} disabled={!filterSite} onChange={e => setFilterPlant(e.target.value)}>
          <option value="">{t("admin.users.allPlants") || "Tous les plants"}</option>
          {plants.map(pl => <option key={pl.id} value={pl.id}>{pl.nom}</option>)}
        </select>

        {/* Filtre statut */}
        <select style={s.filterSelect} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
          <option value="">{t("admin.users.allStatuses")}</option>
          <option value="actif">{t("admin.users.statusActivePlural")}</option>
          <option value="inactif">{t("admin.users.statusInactivePlural")}</option>
        </select>
      </div>

      {/* CARDS */}
      {filtered.length === 0 ? (
        <div style={s.emptyTable}>
          <div style={{fontSize:36, marginBottom:10}}>👤</div>
          <div style={{fontWeight:600, color:"#374151"}}>{t("admin.users.empty")}</div>
        </div>
      ) : (
        <div style={s.tableWrap}>
  <table style={s.table}>
    <thead>
      <tr>
        {["Utilisateur", "Rôle", "Site · Plant", "Processus", "Statut", "Actions"].map(h => (
          <th key={h} style={s.th}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {paginated.map(u => (
        <tr key={u.id} style={s.tr}>
          <td style={s.td}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <Avatar nom={u.nom} />
              <div>
                <div style={{ fontWeight:500, fontSize:13 }}>{u.nom}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{u.matricule}</div>
              </div>
            </div>
          </td>
          <td style={s.td}><span style={s.badgeRole}>{u.role?.nom || "—"}</span></td>
          <td style={{ ...s.td, color:"#6b7280", fontSize:12 }}>
            {getSiteLabel(u) ? `${getSiteLabel(u)} · ${getPlantLabel(u) || "?"}` : "—"}
          </td>
          <td style={{ ...s.td, color:"#6b7280", fontSize:12 }}>
            {getProcessusLabel(u) || "—"}
          </td>
          <td style={s.td}>
            <span style={u.actif ? s.badgeActif : s.badgeInactif}>
              {u.actif ? t("admin.users.status.active") : t("admin.users.status.inactive")}
            </span>
          </td>
          <td style={s.td}>
            <div style={{ display:"flex", gap:6 }}>
              <button style={s.btnSm} onClick={() => openEdit(u)}>✏️ {t("admin.common.edit")}</button>
              {u.actif
                ? <button style={{...s.btnSm, color:"#c2410c"}} onClick={() => setDeleteId(u.id)}>🚫</button>
                : <button style={{...s.btnSm, color:"#15803d"}} onClick={() => setReactivateId(u.id)}>✅</button>
              }
              <button style={{...s.btnSm, color:"#b91c1c"}} onClick={() => { setHardDeleteMsg(""); setHardDeleteId(u.id); }}>🗑️</button>
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />

      {/* MODAL CRÉATION / ÉDITION */}
      {modal && (
        <Modal
          title={modal === "create" ? t("admin.users.modal.createTitle") : t("admin.users.modal.editTitle", { name: selected?.nom || "" })}
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid2}>
              <div style={s.field}>
                <label style={s.label}>{t("admin.users.modal.fullName")}</label>
                <input style={s.input} placeholder={t("admin.users.placeholders.fullName")}
                  value={form.nom} onChange={e => setForm({...form, nom:e.target.value})} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>{t("admin.users.modal.matricule")}</label>
                <input style={s.input} placeholder={t("admin.users.placeholders.matricule")}
                  value={form.matricule} onChange={e => setForm({...form, matricule:e.target.value})} required />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>
                {t("admin.users.modal.password")}{" "}
                {modal==="edit" && <span style={{color:"#9ca3af", fontWeight:400}}>{t("admin.users.modal.passwordHint")}</span>}
              </label>
              <input style={s.input} type="password" placeholder={t("admin.users.placeholders.password")}
                value={form.password} onChange={e => setForm({...form, password:e.target.value})}
                required={modal==="create"} />
            </div>

            <div style={s.field}>
              <label style={s.label}>{t("admin.users.modal.role")}</label>
              <select style={s.input} value={form.roleId}
                onChange={e => {
                  setForm(isSystemAdmin
                    ? {...form, roleId:e.target.value, processusId:"", siteId:"", plantId:"", segmentId:""}
                    : {...form, roleId:e.target.value, processusId:"", segmentId:""});
                  if (isSystemAdmin) { setPlants([]); setSegments([]); }
                }} required>
                <option value="">{t("admin.users.modal.rolePlaceholder")}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
              </select>
            </div>

            {isSystemAdmin ? (
              <div style={s.formGrid2}>
                <div style={s.field}>
                  <label style={s.label}>Site</label>
                  <select style={s.input} value={form.siteId}
                    onChange={async e => { const v=e.target.value; setForm(p=>({...p,siteId:v,plantId:"",segmentId:""})); await loadPlantsForSite(v); setSegments([]); }}>
                    <option value="">{t("admin.users.modal.sitePlaceholder")}</option>
                    {sites.map(site => <option key={site.id} value={site.id}>{site.nom}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Plant</label>
                  <select style={s.input} value={form.plantId} disabled={!form.siteId}
                    onChange={async e => { const v=e.target.value; setForm(p=>({...p,plantId:v,segmentId:""})); await loadSegmentsForPlant(v); }}>
                    <option value="">{t("admin.users.modal.plantPlaceholder")}</option>
                    {plants.map(plant => <option key={plant.id} value={plant.id}>{plant.nom}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8, marginBottom:16, fontSize:12.5, color:"#1d4ed8", fontWeight:600 }}>
                🏭 Cet utilisateur sera automatiquement rattaché à votre plant : {user?.plantNom || user?.siteNom || "—"}
              </div>
            )}

            <div style={s.field}>
              <label style={s.label}>Segment</label>
              <select style={s.input} value={form.segmentId} disabled={!form.plantId}
                onChange={e => setForm({...form, segmentId:e.target.value})}>
                <option value="">{t("admin.users.modal.segmentPlaceholder")}</option>
                {segments.map(seg => <option key={seg.id} value={seg.id}>{seg.nom}</option>)}
              </select>
            </div>

            {isOperateurRole && (
              <div style={s.field}>
                <label style={s.label}>
                  <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                    ⚙️ Processus assigné
                    <span style={{ fontSize:11, fontWeight:400, color:"#ef4444" }}>* obligatoire</span>
                  </span>
                </label>
                {processList.length === 0 ? (
                  <div style={{ padding:"10px 12px", background:"#fef9c3", borderRadius:8, fontSize:13, color:"#a16207", border:"1px solid #fde68a" }}>
                    {t("admin.users.modal.noProcesses")}
                  </div>
                ) : (
                  <select style={{ ...s.input, borderColor: !form.processusId ? "#fca5a5" : "#e5e7eb" }}
                    value={form.processusId} onChange={e => setForm({...form, processusId:e.target.value})} required>
                    <option value="">— {t("admin.users.modal.processPlaceholder")} —</option>
                    {processList.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                  </select>
                )}
                {!form.processusId && (
                  <p style={{ fontSize:11, color:"#ef4444", margin:"4px 0 0", fontWeight:500 }}>
                    L'opérateur doit être associé à un processus pour accéder à sa checklist.
                  </p>
                )}
                {form.processusId && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, padding:"6px 10px", background:"#eff6ff", borderRadius:6, border:"1px solid #bfdbfe" }}>
                    <span>⚙️</span>
                    <span style={{ fontSize:12, fontWeight:600, color:"#1d4ed8" }}>
                      {processList.find(p=>String(p.id)===String(form.processusId))?.nom}
                    </span>
                    <span style={{ fontSize:11, color:"#3b82f6", marginLeft:"auto" }}>✓ sélectionné</span>
                  </div>
                )}
              </div>
            )}

            {msg && <div style={s.errMsg}>{msg}</div>}
            <div style={{display:"flex", gap:10, justifyContent:"flex-end", marginTop:8}}>
              <button type="button" style={s.btnCancel} onClick={closeModal} disabled={saving}>{t("admin.common.cancel")}</button>
              <button type="submit" style={{ ...s.btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }} disabled={saving}>
                {saving
                  ? "⏳ Enregistrement..."
                  : (modal === "create" ? `✅ ${t("admin.users.modal.createSubmit")}` : `💾 ${t("admin.common.save")}`)}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Désactivation */}
      {deleteId && (
        <Modal title={t("admin.users.disableModal.title")} onClose={() => setDeleteId(null)}>
          <div style={{textAlign:"center", padding:"8px 0 20px"}}>
            <div style={{fontSize:40, marginBottom:12}}>🚫</div>
            <p style={{color:"#374151", marginBottom:8, fontWeight:600}}>{t("admin.users.disableModal.question")}</p>
            <p style={{color:"#6b7280", fontSize:13, marginBottom:24}}>{t("admin.users.disableModal.message")}</p>
            <div style={{display:"flex", gap:10, justifyContent:"center"}}>
              <button style={s.btnCancel} onClick={() => setDeleteId(null)}>{t("admin.common.cancel")}</button>
              <button style={{...s.btnPrimary, background:"#f59e0b", color:"#fff"}} onClick={handleDesactiver}>
                🚫 {t("admin.users.actions.deactivate")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Réactivation */}
      {reactivateId && (
        <Modal title={t("admin.users.reactivateModal.title")} onClose={() => setReactivateId(null)}>
          <div style={{textAlign:"center", padding:"8px 0 20px"}}>
            <div style={{fontSize:40, marginBottom:12}}>✅</div>
            <p style={{color:"#374151", marginBottom:8, fontWeight:600}}>{t("admin.users.reactivateModal.question")}</p>
            <p style={{color:"#6b7280", fontSize:13, marginBottom:24}}>{t("admin.users.reactivateModal.message")}</p>
            <div style={{display:"flex", gap:10, justifyContent:"center"}}>
              <button style={s.btnCancel} onClick={() => setReactivateId(null)}>{t("admin.common.cancel")}</button>
              <button style={{...s.btnPrimary, background:"#10b981"}} onClick={handleReactiver}>
                ✅ {t("admin.users.actions.reactivate")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Suppression définitive */}
      {hardDeleteId && (
        <Modal title={t("admin.users.hardDeleteModal.title")} onClose={() => { setHardDeleteId(null); setHardDeleteMsg(""); }}>
          <div style={{textAlign:"center", padding:"8px 0 20px"}}>
            <div style={{fontSize:40, marginBottom:12}}>⚠️</div>
            <p style={{color:"#374151", marginBottom:8, fontWeight:600}}>{t("admin.users.hardDeleteModal.question")}</p>
            <div style={{background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 16px", marginBottom:20}}>
              <p style={{color:"#dc2626", fontSize:13, margin:0, fontWeight:600}}>{t("admin.users.hardDeleteModal.warning")}</p>
            </div>
            {hardDeleteMsg && (
              <div style={{background:"#fff7ed", border:"1px solid #fdba74", borderRadius:8, padding:"10px 12px", marginBottom:14}}>
                <p style={{color:"#9a3412", fontSize:13, margin:0, fontWeight:600}}>{hardDeleteMsg}</p>
              </div>
            )}
            <div style={{display:"flex", gap:10, justifyContent:"center"}}>
              <button style={s.btnCancel} onClick={() => { setHardDeleteId(null); setHardDeleteMsg(""); }}>{t("admin.common.cancel")}</button>
              <button style={{...s.btnPrimary, background:"#dc2626"}} onClick={handleHardDelete}>
                🗑️ {t("admin.users.actions.hardDelete")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
const responsiveStyle = `
@media (max-width: 900px) {
  .filters-responsive {
    grid-template-columns: 1fr !important;
  }
}
`;
const s = {
  topBar:       { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 },
  title:        { fontSize:24, fontWeight:800, color:"#0f1923", margin:"0 0 4px" },
  sub:          { color:"#6b7280", fontSize:14, margin:0 },
  btnPrimary:   { background:"#477bec", color:"#fff", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:700, cursor:"pointer", fontSize:14 },
  btnCancel:    { background:"#f3f4f6", color:"#374151", border:"none", borderRadius:8, padding:"10px 20px", fontWeight:600, cursor:"pointer", fontSize:14 },
  kpiRow:       { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:20 },
  kpiCard:      { background:"#fff", borderRadius:10, padding:"10px 15px", boxShadow:"0 1px 6px rgba(0,0,0,0.06)", textAlign:"center" },

  /* ── Barre de filtres : une seule ligne, jamais de wrap ── */
  /* ───────── FILTRES ───────── */
filterBar: {
  display: "grid",
  gridTemplateColumns: "2fr 180px 180px auto auto",
  gap: 12,
  alignItems: "center",
  marginBottom: 20,
},

searchBox: {
  position: "relative",
  width: "100%",
},

searchIcon: {
  position: "absolute",
  top: "50%",
  left: 12,
  transform: "translateY(-50%)",
  fontSize: 14,
  color: "#94a3b8",
  pointerEvents: "none",
},

searchInput: {
  width: "100%",
  height: 42,
  padding: "0 14px 0 38px",
  border: "1px solid #dbe2ea",
  borderRadius: 12,
  fontSize: 14,
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
},

filterSelect: {
  height: 42,
  padding: "0 12px",
  border: "1px solid #dbe2ea",
  borderRadius: 12,
  fontSize: 13,
  background: "#fff",
  cursor: "pointer",
  outline: "none",
  minWidth: 0,
},

btnReset: {
  height: 42,
  padding: "0 16px",
  background: "#f1f5f9",
  color: "#475569",
  border: "none",
  borderRadius: 12,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: "nowrap",
},

resultsCount: {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 600,
  whiteSpace: "nowrap",
},
tableWrap:  { border:"0.5px solid #e5e7eb", borderRadius:12, overflow:"hidden", background:"#fff" },
table:      { width:"100%", borderCollapse:"collapse", fontSize:13 },
th:         { background:"#f9fafb", fontSize:11, fontWeight:500, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px", padding:"9px 14px", textAlign:"left", borderBottom:"0.5px solid #e5e7eb" },
tr:         { borderBottom:"0.5px solid #f1f5f9" },
td:         { padding:"10px 14px", verticalAlign:"middle" },
badgeRole:  { background:"#f3f4f6", color:"#374151", padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:500 },
badgeActif: { background:"#dcfce7", color:"#166534", padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:500 },
badgeInactif:{ background:"#fee2e2", color:"#991b1b", padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:500 },
btnSm:      { padding:"4px 10px", fontSize:12, borderRadius:6, border:"0.5px solid #e5e7eb", background:"transparent", cursor:"pointer", color:"#6b7280" },

  /* ── Cards ── */
  cardGrid:     { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 },
  userCard:     { background:"#fff", borderRadius:14, border:"1px solid #eef2f7", boxShadow:"0 2px 10px rgba(15,25,35,0.05)", padding:"14px 14px 12px", display:"flex", flexDirection:"column", gap:10 },
  userCardTop:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 },
  tagRow:       { display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" },
  matriculePill:{ fontFamily:"monospace", background:"#f3f4f6", color:"#374151", padding:"3px 9px", borderRadius:999, fontSize:12, fontWeight:700 },
  btnDetails:   { background:"none", border:"1px solid #e5e7eb", borderRadius:6, padding:"5px 10px", cursor:"pointer", fontSize:12, fontWeight:600, color:"#4b5563", textAlign:"left", width:"100%", transition:"background .15s" },
  detailsPanel: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, padding:"10px 0 2px", borderTop:"1px dashed #e5e7eb" },
  infoChip:     { borderRadius:10, border:"1px solid #e5e7eb", background:"#f8fafc", padding:"8px 10px", display:"flex", flexDirection:"column", gap:3 },
  infoChipWide: { gridColumn:"1 / -1" },
  infoChipHead: { display:"flex", alignItems:"center", gap:5, fontSize:10, fontWeight:800, letterSpacing:0.5, color:"#6b7280", textTransform:"uppercase" },
  infoChipVal:  { fontSize:12.5, fontWeight:700, color:"#0f1923", lineHeight:1.3, wordBreak:"break-word" },
  emptyTable:   { padding:"40px 20px", textAlign:"center", background:"#fff", borderRadius:12, boxShadow:"0 1px 8px rgba(0,0,0,0.06)" },
btnAction: {
  flex: "1",
  background: "#eff6ff",
  color: "#2563eb",
  border: "none",
  borderRadius: "8px",
  padding: "7px 12px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  minWidth: "90px",
  textAlign: "center",
},  btnWarn:      { background:"#fff7ed", color:"#c2410c" },
  btnGreen:     { background:"#f0fdf4", color:"#15803d" },
  btnRed:       { background:"#fef2f2", color:"#b91c1c" },
  formGrid2:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:0 },
  field:        { marginBottom:16 },
  label:        { display:"block", marginBottom:6, fontSize:13, fontWeight:600, color:"#374151" },
  input:        { width:"100%", padding:"10px 12px", border:"1.5px solid #e5e7eb", borderRadius:8, fontSize:14, boxSizing:"border-box", fontFamily:"inherit" },
  errMsg:       { background:"#fef2f2", color:"#dc2626", padding:"10px", borderRadius:8, fontSize:13, marginBottom:12 },
  actionsRow:   { display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"auto", paddingTop:"8px", borderTop: "1px solid #f1f5f9", },
};

function InfoChip({ label, value, icon, empty = "—", wide = false }) {
  return (
    <div style={{ ...s.infoChip, ...(wide ? s.infoChipWide : {}) }}>
      <div style={s.infoChipHead}><span>{icon}</span><span>{label}</span></div>
      <div style={s.infoChipVal}>{value || empty}</div>
    </div>
  );
}