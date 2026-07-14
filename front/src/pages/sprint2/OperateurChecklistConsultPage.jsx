import { useSearchParams, useNavigate } from "react-router-dom";
import { getAllChecklists, planActionAPI } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useI18n } from "../../context/I18nContext";
import React, { useState, useEffect, useMemo, useRef } from "react";

const buildSessions = (t) => [
  { value: "M", label: t("layout.session.morning"), icon: "🌅", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  { value: "S", label: t("layout.session.evening"), icon: "🌆", color: "#4f46e5", bg: "#eef2ff", border: "#a5b4fc" },
  { value: "N", label: t("layout.session.night"),   icon: "🌙", color: "#1e293b", bg: "#f1f5f9", border: "#94a3b8" },
];

const buildStatusMeta = (t) => ({
  EN_COURS:     { color: "#f59e0b", bg: "#fffbeb", label: t("sprint2.checklist.status.inProgress"),     icon: "⏳" },
  SOUMIS:       { color: "#2563eb", bg: "#eff6ff", label: t("sprint2.checklist.status.submitted"),      icon: "📤" },
  VALIDE_N1:    { color: "#7c3aed", bg: "#f5f3ff", label: t("sprint2.checklist.status.validatedN1"),    icon: "✅" },
  VALIDE_N2:    { color: "#0284c7", bg: "#f0f9ff", label: t("sprint2.checklist.status.validatedN2"),    icon: "✅" },
  VALIDE_FINAL: { color: "#16a34a", bg: "#f0fdf4", label: t("sprint2.checklist.status.validatedFinal"), icon: "🏆" },
  REJETE:       { color: "#dc2626", bg: "#fef2f2", label: t("sprint2.checklist.status.rejected"),       icon: "❌" },
});


const VALIDATION_STEPS = [
  { key: "SOUMIS",       label: "Soumis",      icon: "📤", color: "#3b82f6" },
  { key: "VALIDE_N1",    label: "Validé N1",   icon: "✅", color: "#7c3aed" },
  { key: "VALIDE_N2",    label: "Validé N2",   icon: "✅", color: "#0284c7" },
  { key: "VALIDE_FINAL", label: "Final",       icon: "🏆", color: "#16a34a" },
];

function translate(v) { return v; }

export default function OperateurChecklistConsultPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const consultId = Number(searchParams.get("consultId"));

  const sessions   = useMemo(() => buildSessions(t), [t]);
  const statusMeta = useMemo(() => buildStatusMeta(t), [t]);

  const [checklist,    setChecklist]    = useState(null);
  const [plans,        setPlans]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState("ALL"); // ALL | NC | OK
  const [myChecklists, setMyChecklists] = useState([]);
  const startTimeRef = useRef(Date.now());
  // Load all my checklists + the specific one
  useEffect(() => {
    setLoading(true);
    getAllChecklists()
      .then(r => {
        const all = Array.isArray(r.data) ? r.data : [];
        const mine = all.filter(c => c.operateurId === user?.id && c.status !== "EN_COURS");
        setMyChecklists(mine);
        if (consultId) {
          const found = mine.find(c => c.id === consultId) || all.find(c => c.id === consultId);
          if (found) {
            setChecklist(found);
            planActionAPI.findByChecklist(found.id)
              .then(pr => setPlans(Array.isArray(pr.data) ? pr.data : []))
              .catch(() => setPlans([]));
          }
        } else if (mine.length > 0) {
          // Auto-select latest
          const latest = [...mine].sort((a, b) => b.id - a.id)[0];
          setChecklist(latest);
          planActionAPI.findByChecklist(latest.id)
            .then(pr => setPlans(Array.isArray(pr.data) ? pr.data : []))
            .catch(() => setPlans([]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [consultId, user?.id]); // eslint-disable-line

  const handleValiderAQ = async (plan) => {
    if (!plan || !plan.id) return;
    if (!user || !(user.role === "AGENT_QUALITE" || user.role === "ADMIN")) {
      alert("Accès refusé.");
      return;
    }
    const commentaire = window.prompt("Commentaire (optionnel) pour la validation AQ :", "");
    try {
      await planActionAPI.validerAQ(plan.id, commentaire || "");
      // reload plans for current checklist
      if (checklist && checklist.id) {
        const pr = await planActionAPI.findByChecklist(checklist.id);
        setPlans(Array.isArray(pr.data) ? pr.data : []);
      }
      alert("Plan validé par AQ.");
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la validation AQ.");
    }
  };

  const selectChecklist = (c) => {
    setChecklist(c);
    setActiveFilter("ALL");
    planActionAPI.findByChecklist(c.id)
      .then(pr => setPlans(Array.isArray(pr.data) ? pr.data : []))
      .catch(() => setPlans([]));
  };

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <span style={{ color: "var(--tx-3)", fontSize: 14 }}>Chargement de vos checklists…</span>
      </div>
    );
  }

  const session = checklist ? sessions.find(s => s.value === checklist.session) : null;
  const meta    = checklist ? (statusMeta[checklist.status] || { color: "#6b7280", bg: "#f3f4f6", label: checklist.status, icon: "•" }) : null;

  const allReponses = checklist?.reponses || [];
  const nc   = allReponses.filter(r => r.valeur === "ROUGE" || r.valeur === "JAUNE");
  const ok   = allReponses.filter(r => r.valeur === "VERT");
  const na   = allReponses.filter(r => r.valeur === "NA");
  const rouge = allReponses.filter(r => r.valeur === "ROUGE");
  const jaune = allReponses.filter(r => r.valeur === "JAUNE");

  const displayedReponses = activeFilter === "NC" ? nc : activeFilter === "OK" ? ok : allReponses;

  // Current step index for progress bar
  const stepOrder = ["SOUMIS", "VALIDE_N1", "VALIDE_N2", "VALIDE_FINAL"];
  const currentStepIdx = checklist ? stepOrder.indexOf(checklist.status) : -1;
  const isRejected = checklist?.status === "REJETE";

  const planClos = plans.some(p => p.statut === "CLOS");

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:none } }
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
        .consult-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important; transform: translateY(-1px); }
      `}</style>

      {/* ── Page Header ── */}
      <div style={S.pageHeader}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <button style={S.backBtn} onClick={() => navigate("/checklist/operateur")}>
            ← Retour
          </button>
          <div>
            <h1 style={S.pageTitle}>📋 Mes checklists</h1>
            <p style={S.pageSub}>Consultation de vos checklists soumises</p>
          </div>
        </div>
        <div style={S.headerBadge}>
          <span style={{ fontSize:13 }}>👁️</span>
          <span>Lecture seule</span>
        </div>
      </div>

      <div style={S.layout}>

        {/* ── Sidebar : liste de mes checklists ── */}
        <div style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <span style={{ fontSize:13, fontWeight:700, color:"var(--tx-2)" }}>Mes soumissions</span>
            <span style={S.sidebarCount}>{myChecklists.length}</span>
          </div>

          {myChecklists.length === 0 ? (
            <div style={S.emptyState}>
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:13, color:"var(--tx-4)", fontWeight:500 }}>Aucune checklist soumise</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {[...myChecklists].sort((a,b)=>b.id-a.id).map(c => {
                const m   = statusMeta[c.status] || { color:"#6b7280", bg:"#f3f4f6", label:c.status, icon:"•" };
                const rCount = (c.reponses||[]).filter(r=>r.valeur==="ROUGE").length;
                const isSel  = checklist?.id === c.id;
                const sess   = sessions.find(s=>s.value===c.session);
                return (
                  <div
                    key={c.id}
                    className="consult-card"
                    style={{
                      padding:"12px 14px",
                      borderRadius:10,
                      cursor:"pointer",
                      transition:"all 0.15s ease",
                      background: isSel ? "var(--l1)" : "var(--bg-1)",
                      border: `1px solid ${isSel ? "var(--l3)" : "var(--bd-1)"}`,
                      borderLeft: `3px solid ${isSel ? "var(--l5)" : rCount>0 ? "#ef4444" : "#10b981"}`,
                      boxShadow: isSel ? "0 2px 10px rgba(0,87,168,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                    onClick={() => selectChecklist(c)}
                  >
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:700, color:"var(--tx-1)" }}>
                        🔧 {c.machineNom ? translate(c.machineNom) : "—"}
                      </span>
                      <span style={{ fontSize:11, color:"var(--tx-4)" }}>{c.date}</span>
                    </div>
                    <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                      {sess && (
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:sess.bg, color:sess.color, fontWeight:700, border:`1px solid ${sess.border}` }}>
                          {sess.icon} {sess.label}
                        </span>
                      )}
                      <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:m.bg, color:m.color, fontWeight:700 }}>
                        {m.icon} {m.label}
                      </span>
                      {rCount > 0 && (
                        <span style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:"#fee2e2", color:"#991b1b", fontWeight:700 }}>
                          🔴 {rCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div style={S.main}>
          {!checklist ? (
            <div style={S.noSelection}>
              <div style={{ fontSize:48, marginBottom:16 }}>👈</div>
              <div style={{ fontSize:16, fontWeight:700, color:"var(--tx-2)" }}>Sélectionnez une checklist</div>
              <div style={{ fontSize:13, color:"var(--tx-4)", marginTop:6 }}>Choisissez une checklist dans la liste à gauche</div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:16, animation:"fadeUp .3s ease both" }}>

              {/* ── Carte identité ── */}
              <div style={S.identityCard}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={S.machineAvatar}>🔧</div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:900, color:"var(--tx-1)" }}>
                        {checklist.machineNom ? translate(checklist.machineNom) : "—"}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6, flexWrap:"wrap" }}>
                        {session && (
                          <span style={{ padding:"3px 10px", borderRadius:20, fontSize:12, fontWeight:700, background:session.bg, color:session.color, border:`1px solid ${session.border}` }}>
                            {session.icon} {session.label}
                          </span>
                        )}
                        <span style={{ fontSize:12, color:"var(--tx-4)" }}>📅 {checklist.date}</span>
                        {checklist.processusNom && (
                          <span style={{ fontSize:12, color:"var(--tx-4)" }}>⚙️ {translate(checklist.processusNom)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ padding:"6px 16px", borderRadius:20, fontSize:12, fontWeight:800, background:meta.bg, color:meta.color, border:`1.5px solid ${meta.color}30` }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>

                {/* Infos secondaires */}
                <div style={S.infoGrid}>
                  {[
                    { icon:"📍", label:"Site",     value: checklist.siteNom  || "—" },
                    { icon:"🏭", label:"Plant",    value: checklist.plantNom || "—" },
                    { icon:"⚙️",  label:"Processus",value: checklist.processusNom ? translate(checklist.processusNom) : "—" },
                    { icon:"📅", label:"Date",     value: checklist.date },
                    ...(checklist.dateValidationN1  ? [{ icon:"🟣", label:"Validation N1",    value:`${checklist.valideN1Par  ||"—"}` }] : []),
                    ...(checklist.dateValidationN2  ? [{ icon:"🔵", label:"Validation N2",    value:`${checklist.valideN2Par  ||"—"}` }] : []),
                    ...(checklist.dateValidationFinale ? [{ icon:"✅", label:"Validation finale", value:`${checklist.valideParFinal||"—"}` }] : []),
                  ].map(item => (
                    <div key={item.label} style={S.infoItem}>
                      <span style={{ fontSize:14 }}>{item.icon}</span>
                      <div>
                        <div style={{ fontSize:10, color:"var(--tx-4)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.5px" }}>{item.label}</div>
                        <div style={{ fontSize:12, fontWeight:600, color:"var(--tx-1)", marginTop:1 }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Suivi de validation ── */}
              <div style={S.progressCard}>
                <div style={S.cardTitle}>📊 Suivi de validation</div>
                {isRejected ? (
                  <div style={{ padding:"14px 16px", background:"#fef2f2", borderRadius:10, border:"1px solid #fecaca" }}>
                    <div style={{ fontWeight:700, color:"#991b1b", marginBottom:4 }}>❌ Checklist rejetée</div>
                    {checklist.motifRejet && <div style={{ fontSize:13, color:"#7f1d1d" }}>{checklist.motifRejet}</div>}
                  </div>
                ) : (
                  <div style={S.stepsRow}>
                    {VALIDATION_STEPS.map((step, idx) => {
                      const done    = currentStepIdx >= idx;
                      const current = currentStepIdx === idx;
                      const pending = !done;
                      return (
                        <div key={step.key} style={{ display:"flex", alignItems:"center", flex:1 }}>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flex:1 }}>
                            <div style={{
                              width:30, height:36, borderRadius:"50%",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize: done ? 16 : 13,
                              fontWeight:700,
                              background: done ? step.color : "var(--bg-3)",
                              color: done ? "#fff" : "var(--tx-4)",
                              border: current ? `3px solid ${step.color}` : "none",
                              boxShadow: done ? `0 4px 12px ${step.color}40` : "none",
                              transition:"all 0.2s",
                            }}>
                              {done ? step.icon : idx + 1}
                            </div>
                            <span style={{ fontSize:11, fontWeight: done ? 700 : 500, color: done ? step.color : "var(--tx-4)", textAlign:"center" }}>
                              {step.label}
                            </span>
                          </div>
                          {idx < VALIDATION_STEPS.length - 1 && (
                            <div style={{ height:2, flex:1, background: currentStepIdx > idx ? step.color : "var(--bd-1)", borderRadius:2, margin:"0 4px", marginBottom:24, transition:"background 0.3s" }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Plans d'action liés ── */}
              {plans.length > 0 && (
                <div style={S.plansCard}>
                  <div style={S.cardTitle}>⚠️ Plan d'action associé</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {plans.map(p => {
                      const isClos = p.statut === "CLOS";
                      const isRouge = (p.couleurCritere || "").toUpperCase() === "ROUGE";
                      const enAttenteAQ = p.statut === "EN_ATTENTE_VALIDATION_AQ";
                      return (
                        <div key={p.id} style={{ padding:"12px 14px", borderRadius:10, background: isClos ? "#f0fdf4" : "#fef2f2", border:`1.5px solid ${isClos ? "#bbf7d0" : "#fecaca"}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                            <div>
                              <div style={{ fontSize:13, fontWeight:700, color:"var(--tx-1)" }}>{p.titre || p.description || "Plan d'action"}</div>
                              {p.dateEcheance && <div style={{ fontSize:11, color:"var(--tx-4)", marginTop:2 }}>Échéance : {p.dateEcheance}</div>}
                            </div>
                            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8 }}>
                              <span style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:800, background: isClos?"#dcfce7":"#fee2e2", color:isClos?"#15803d":"#991b1b" }}>
                                {isClos ? "✅ Clôturé" : "⏳ En cours"}
                              </span>
                              {isRouge && enAttenteAQ && (user?.role === "AGENT_QUALITE" || user?.role === "ADMIN") && (
                                <button onClick={() => handleValiderAQ(p)} style={{ marginTop:6, background:"var(--purple)", color:"#fff", border:"none", padding:"6px 10px", borderRadius:8, cursor:"pointer", fontWeight:700 }}>Valider AQ</button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!planClos && nc.length > 0 && (
                    <div style={{ marginTop:10, padding:"10px 14px", background:"#fef9c3", borderRadius:8, border:"1px solid #fde047", fontSize:12, color:"#854d0e", fontWeight:600 }}>
                      ⏳ En attente de clôture du plan d'action avant validation finale
                    </div>
                  )}
                </div>
              )}

              {/* ── Résultats ── */}
              {allReponses.length > 0 && (
                <div style={S.resultsCard}>
                  {/* Stats */}
                  <div style={S.statsRow}>
                    <div style={{ ...S.statBox, background:"#fee2e2", border:"1px solid #fca5a5", cursor: rouge.length?"pointer":"default", opacity: rouge.length?1:0.5 }} onClick={()=>rouge.length&&setActiveFilter(f=>f==="NC"?"ALL":"NC")}>
                      <span style={{ fontSize:22, fontWeight:900, color:"#ef4444", lineHeight:1 }}>{rouge.length}</span>
                      <span style={{ fontSize:11, color:"#991b1b", fontWeight:700 }}>Non-conformes</span>
                      {activeFilter === "NC" && <span style={{ fontSize:9, color:"#ef4444", fontWeight:800 }}>● actif</span>}
                    </div>
                    <div style={{ ...S.statBox, background:"#fef9c3", border:"1px solid #fde047", cursor: jaune.length?"pointer":"default", opacity: jaune.length?1:0.5 }} onClick={()=>jaune.length&&setActiveFilter(f=>f==="NC"?"ALL":"NC")}>
                      <span style={{ fontSize:22, fontWeight:900, color:"#ca8a04", lineHeight:1 }}>{jaune.length}</span>
                      <span style={{ fontSize:11, color:"#854d0e", fontWeight:700 }}>Non-conformes
                        
                      </span>
                    </div>
                    <div style={{ ...S.statBox, background:"#dcfce7", border:"1px solid #86efac", cursor:"pointer" }} onClick={()=>setActiveFilter(f=>f==="OK"?"ALL":"OK")}>
                      <span style={{ fontSize:22, fontWeight:900, color:"#16a34a", lineHeight:1 }}>{ok.length}</span>
                      <span style={{ fontSize:11, color:"#15803d", fontWeight:700 }}>Conformes</span>
                      {activeFilter === "OK" && <span style={{ fontSize:9, color:"#16a34a", fontWeight:800 }}>● actif</span>}
                    </div>
                    {na.length > 0 && (
                      <div style={{ ...S.statBox, background:"#f3f4f6", border:"1px solid #d1d5db" }}>
                        <span style={{ fontSize:22, fontWeight:900, color:"#6b7280", lineHeight:1 }}>{na.length}</span>
                        <span style={{ fontSize:11, color:"#6b7280", fontWeight:700 }}>N/A</span>
                      </div>
                    )}
                  </div>

                  {/* Filtre pills */}
                  <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                    {[
                      { key:"ALL", label:`Tous (${allReponses.length})`, color:"var(--tx-2)", bg:"var(--bg-3)", activeBg:"var(--l5)", activeColor:"#fff" },
                      { key:"NC",  label:`⚠️ Non-conformités (${nc.length})`, color:"#991b1b", bg:"#fef2f2", activeBg:"#ef4444", activeColor:"#fff" },
                      { key:"OK",  label:`✅ Conformes (${ok.length})`, color:"#15803d", bg:"#f0fdf4", activeBg:"#16a34a", activeColor:"#fff" },
                    ].map(f => (
                      <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{
                        padding:"6px 14px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer", border:"none",
                        background: activeFilter===f.key ? f.activeBg : f.bg,
                        color: activeFilter===f.key ? f.activeColor : f.color,
                        transition:"all 0.15s",
                      }}>{f.label}</button>
                    ))}
                  </div>

                  {/* Titre section */}
                  <div style={S.cardTitle}>
                    {activeFilter === "NC" ? "⚠️ Points non-conformes" : activeFilter === "OK" ? "✅ Points conformes" : `📋 Résultats (${allReponses.length} critères)`}
                  </div>

                  {displayedReponses.length === 0 ? (
                    <div style={{ padding:"24px", textAlign:"center", color:"var(--tx-4)", fontSize:13 }}>
                      Aucun critère dans cette catégorie
                    </div>
                  ) : (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
                      {displayedReponses.map(r => {
                        const isRouge = r.valeur === "ROUGE";
                        const isJaune = r.valeur === "JAUNE";
                        const isVert  = r.valeur === "VERT";
                        const isNA    = r.valeur === "NA";
                        const bgMap   = { ROUGE:"#fff1f2", JAUNE:"#fefce8", VERT:"#f0fdf4", NA:"#f8fafc" };
                        const brMap   = { ROUGE:"#fda4af", JAUNE:"#fde047", VERT:"#86efac", NA:"#cbd5e1" };
                        const blMap   = { ROUGE:"#ef4444", JAUNE:"#eab308", VERT:"#22c55e", NA:"#94a3b8" };
                        const txMap   = { ROUGE:"#991b1b", JAUNE:"#854d0e", VERT:"#15803d", NA:"#64748b" };
                        const lbMap   = { ROUGE:"Non conforme", JAUNE:"Non conforme", VERT:"Conforme", NA:"N/A" };
                        const dotMap  = { ROUGE:"#ef4444", JAUNE:"#ca8a04", VERT:"#22c55e", NA:"#9ca3af" };
                        return (
                          <div key={r.id} style={{
                            padding:"14px 16px", borderRadius:10,
                            background: bgMap[r.valeur] || bgMap.NA,
                            borderTop:`1.5px solid ${brMap[r.valeur]||brMap.NA}`,
                            borderRight:`1.5px solid ${brMap[r.valeur]||brMap.NA}`,
                            borderBottom:`1.5px solid ${brMap[r.valeur]||brMap.NA}`,
                            borderLeft:`4px solid ${blMap[r.valeur]||blMap.NA}`,
                          }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8, marginBottom:6 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"var(--tx-1)", lineHeight:1.4, flex:1 }}>
                                {r.critereNom ? translate(r.critereNom) : "Critère"}
                              </div>
                              <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:700, background:"rgba(255,255,255,0.7)", color:txMap[r.valeur]||txMap.NA, whiteSpace:"nowrap", flexShrink:0 }}>
                                <span style={{ width:7, height:7, borderRadius:"50%", background:dotMap[r.valeur]||dotMap.NA, display:"inline-block" }}/>
                                {lbMap[r.valeur] || r.valeur}
                              </span>
                            </div>
                            {r.commentaire && (
                              <div style={{ fontSize:12, color:txMap[r.valeur]||txMap.NA, marginTop:6, padding:"6px 8px", background:"rgba(255,255,255,0.55)", borderRadius:6, fontStyle:"italic" }}>
                                💬 {r.commentaire}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    minHeight: "100%",
  },
  loadingWrap: {
    display:"flex", alignItems:"center", justifyContent:"center",
    gap:12, minHeight:"50vh", color:"var(--tx-3)", fontSize:14,
  },
  spinner: {
    width:22, height:22, borderRadius:"50%",
    border:"3px solid var(--bd-1)", borderTopColor:"var(--l5)",
    animation:"spin .7s linear infinite", flexShrink:0,
  },
  pageHeader: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    marginBottom:20, flexWrap:"wrap", gap:12,
  },
  pageTitle: { fontSize:20, fontWeight:800, color:"var(--tx-1)", margin:"0 0 4px" },
  pageSub:   { fontSize:13, color:"var(--tx-3)", margin:0 },
  backBtn: {
    background:"var(--bg-1)", color:"var(--tx-2)",
    border:"1.5px solid var(--bd-1)", borderRadius:8,
    padding:"7px 14px", cursor:"pointer", fontSize:13, fontWeight:600,
    fontFamily:"inherit",
  },
  headerBadge: {
    display:"flex", alignItems:"center", gap:6,
    padding:"6px 14px", borderRadius:20,
    background:"#eff6ff", color:"#2563eb",
    fontSize:12, fontWeight:700, border:"1px solid #bfdbfe",
  },
  layout: {
    display:"grid", gridTemplateColumns:"260px 1fr", gap:16, alignItems:"start",
  },
  sidebar: {
    background:"var(--bg-1)", borderRadius:12,
    border:"1px solid var(--bd-1)",
    padding:"16px",
    position:"sticky", top:16,
    maxHeight:"calc(100vh - 120px)", overflowY:"auto",
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
  },
  sidebarHeader: {
    display:"flex", justifyContent:"space-between", alignItems:"center",
    marginBottom:12, paddingBottom:10, borderBottom:"1px solid var(--bd-1)",
  },
  sidebarCount: {
    background:"var(--bg-3)", color:"var(--tx-3)",
    borderRadius:20, padding:"2px 8px", fontSize:11, fontWeight:700,
  },
  emptyState: {
    padding:"28px 16px", textAlign:"center",
  },
  main: { minWidth:0 },
  noSelection: {
    display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
    minHeight:300, color:"var(--tx-4)", textAlign:"center",
    background:"var(--bg-2)", borderRadius:12, border:"1px dashed var(--bd-1)",
  },
  identityCard: {
    background:"var(--bg-1)", borderRadius:12,
    border:"1px solid var(--bd-1)", padding:"20px 24px",
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
  },
  machineAvatar: {
    width:48, height:48, borderRadius:12,
    background:"linear-gradient(135deg,#1e293b,#334155)",
    display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:22, flexShrink:0,
  },
  infoGrid: {
    display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",
    gap:12, marginTop:16, padding:"14px 16px",
    background:"var(--bg-2)", borderRadius:10, border:"1px solid var(--bd-1)",
  },
  infoItem: { display:"flex", gap:8, alignItems:"flex-start" },
  progressCard: {
    background:"var(--bg-1)", borderRadius:12,
    border:"1px solid var(--bd-1)", padding:"10px 24px",
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
  },
  stepsRow: {
    display:"flex", alignItems:"center", marginTop:16, padding:"8px 0",
  },
  plansCard: {
    background:"var(--bg-1)", borderRadius:12,
    border:"1.5px solid #fecaca", padding:"18px 24px",
    boxShadow:"0 2px 8px rgba(239,68,68,0.06)",
  },
  resultsCard: {
    background:"var(--bg-1)", borderRadius:12,
    border:"1px solid var(--bd-1)", padding:"18px 24px",
    boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
  },
  cardTitle: {
    fontSize:13, fontWeight:800, color:"var(--tx-2)",
    marginBottom:14, textTransform:"uppercase", letterSpacing:"0.5px",
  },
  statsRow: {
    display:"flex", gap:10, marginBottom:16, flexWrap:"wrap",
  },
  statBox: {
    flex:1, minWidth:80, padding:"12px 14px", borderRadius:10,
    display:"flex", flexDirection:"column", alignItems:"center", gap:3,
    transition:"transform 0.15s",
  },
};