import React, { useState, useEffect, useMemo } from "react";
import { getAllChecklists } from "../../api";
import { useAuth } from "../../context/AuthContext";

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const SESSION_META = {
  M: { label: "Matin", icon: "🌅" },
  S: { label: "Soir", icon: "🌆" },
  N: { label: "Nuit", icon: "🌙" },
};

const STATUS_META = {
  EN_COURS: { color: "#f59e0b", bg: "#fffbeb", label: "En cours", icon: "⏳" },
  SOUMIS: { color: "#2563eb", bg: "#eff6ff", label: "Soumis", icon: "📤" },
  VALIDE_N1: { color: "#7c3aed", bg: "#f5f3ff", label: "Validé N1", icon: "✅" },
  VALIDE_N2: { color: "#0284c7", bg: "#f0f9ff", label: "Validé N2", icon: "✅" },
  VALIDE_FINAL: { color: "#16a34a", bg: "#f0fdf4", label: "Validé Final", icon: "🏆" },
  REJETE: { color: "#dc2626", bg: "#fef2f2", label: "Rejeté", icon: "❌" },
};

const LTPM_META = {
  ROUGE: { label: "LTPM Rouge", color: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: "🔴" },
  JAUNE: { label: "LTPM Jaune", color: "#ca8a04", bg: "#fffbeb", border: "#fde68a", icon: "🟡" },
  VERT: { label: "LTPM Vert", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", icon: "🟢" },
};

const getInitials = (n) => {
  if (!n) return "??";
  const p = n.trim().split(/\s+/);
  return (p.length > 1 ? p[0][0] + p[p.length - 1][0] : n.substring(0, 2)).toUpperCase();
};

// Bucket LTPM d'une checklist individuelle
const checklistBucket = (c) => {
  const reponses = c.reponses || [];
  const hasRouge = c.status === "REJETE" || reponses.some((r) => r.valeur === "ROUGE");
  if (hasRouge) return "ROUGE";
  const hasJaune = reponses.some((r) => r.valeur === "JAUNE");
  if (hasJaune) return "JAUNE";
  return "VERT";
};

// Bucket LTPM agrégé d'un opérateur (pire cas parmi ses checklists)
const operatorBucket = (checklists) => {
  if (checklists.some((c) => checklistBucket(c) === "ROUGE")) return "ROUGE";
  if (checklists.some((c) => checklistBucket(c) === "JAUNE")) return "JAUNE";
  return "VERT";
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d;
  }
};

// ─────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────
export default function OperateursLtpmPage() {
  const { user } = useAuth();

  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [ltpmFilter, setLtpmFilter] = useState("ALL"); // ALL | ROUGE | JAUNE | VERT

  const [selectedOperatorId, setSelectedOperatorId] = useState(null);
  const [selectedChecklist, setSelectedChecklist] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getAllChecklists()
      .then((r) => {
        if (cancelled) return;
        setChecklists(Array.isArray(r.data) ? r.data : []);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les checklists.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Historique complet = toutes les checklists soumises (on exclut les brouillons EN_COURS)
  const submitted = useMemo(
    () => checklists.filter((c) => c.status !== "EN_COURS"),
    [checklists]
  );

  // Regroupement par opérateur
  const operators = useMemo(() => {
    const map = new Map();
    submitted.forEach((c) => {
      if (!c.operateurId) return;
      if (!map.has(c.operateurId)) {
        map.set(c.operateurId, {
          operateurId: c.operateurId,
          operateurNom: c.operateurNom || "Opérateur",
          operateurMatricule: c.operateurMatricule || "—",
          checklists: [],
        });
      }
      map.get(c.operateurId).checklists.push(c);
    });

    return Array.from(map.values())
      .map((op) => {
        const sorted = [...op.checklists].sort((a, b) => {
          const da = new Date(a.date || 0).getTime();
          const db = new Date(b.date || 0).getTime();
          return db - da || (b.id || 0) - (a.id || 0);
        });
        const bucket = operatorBucket(sorted);
        const nbRouge = sorted.filter((c) => checklistBucket(c) === "ROUGE").length;
        const nbJaune = sorted.filter((c) => checklistBucket(c) === "JAUNE").length;
        const nbVert = sorted.filter((c) => checklistBucket(c) === "VERT").length;
        return {
          ...op,
          checklists: sorted,
          bucket,
          nbRouge,
          nbJaune,
          nbVert,
          derniereDate: sorted[0]?.date || null,
        };
      })
      .sort((a, b) => a.operateurNom.localeCompare(b.operateurNom));
  }, [submitted]);

  const filteredOperators = useMemo(() => {
    const q = search.trim().toLowerCase();
    return operators.filter((op) => {
      if (ltpmFilter !== "ALL" && op.bucket !== ltpmFilter) return false;
      if (!q) return true;
      return (
        op.operateurNom.toLowerCase().includes(q) ||
        op.operateurMatricule.toLowerCase().includes(q)
      );
    });
  }, [operators, search, ltpmFilter]);

  const selectedOperator = useMemo(
    () => operators.find((o) => o.operateurId === selectedOperatorId) || null,
    [operators, selectedOperatorId]
  );

  const counts = useMemo(() => {
    return {
      total: operators.length,
      rouge: operators.filter((o) => o.bucket === "ROUGE").length,
      jaune: operators.filter((o) => o.bucket === "JAUNE").length,
      vert: operators.filter((o) => o.bucket === "VERT").length,
    };
  }, [operators]);

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <span style={{ color: "var(--tx-3)", fontSize: 14 }}>Chargement des opérateurs…</span>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{spinCss}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Opérateurs LTPM</h1>
          <p style={S.subtitle}>
            Historique des checklists soumises par opérateur
            {user?.plantNom ? ` — Plant ${user.plantNom}` : ""}
          </p>
        </div>
      </div>

      {error && <div style={S.errorBanner}>{error}</div>}

      {/* ── KPI cards ── */}
      <div style={S.kpiGrid}>
        <div style={{ ...S.kpiCard, borderColor: "var(--bd-1)" }} onClick={() => setLtpmFilter("ALL")}>
          <div style={S.kpiValue}>{counts.total}</div>
          <div style={S.kpiLabel}>Opérateurs</div>
        </div>
        <div style={{ ...S.kpiCard, borderColor: LTPM_META.ROUGE.border, background: ltpmFilter === "ROUGE" ? LTPM_META.ROUGE.bg : "#fff" }}
             onClick={() => setLtpmFilter(ltpmFilter === "ROUGE" ? "ALL" : "ROUGE")}>
          <div style={{ ...S.kpiValue, color: LTPM_META.ROUGE.color }}>{counts.rouge}</div>
          <div style={S.kpiLabel}>{LTPM_META.ROUGE.icon} LTPM Rouge</div>
        </div>
        <div style={{ ...S.kpiCard, borderColor: LTPM_META.JAUNE.border, background: ltpmFilter === "JAUNE" ? LTPM_META.JAUNE.bg : "#fff" }}
             onClick={() => setLtpmFilter(ltpmFilter === "JAUNE" ? "ALL" : "JAUNE")}>
          <div style={{ ...S.kpiValue, color: LTPM_META.JAUNE.color }}>{counts.jaune}</div>
          <div style={S.kpiLabel}>{LTPM_META.JAUNE.icon} LTPM Jaune</div>
        </div>
        <div style={{ ...S.kpiCard, borderColor: LTPM_META.VERT.border, background: ltpmFilter === "VERT" ? LTPM_META.VERT.bg : "#fff" }}
             onClick={() => setLtpmFilter(ltpmFilter === "VERT" ? "ALL" : "VERT")}>
          <div style={{ ...S.kpiValue, color: LTPM_META.VERT.color }}>{counts.vert}</div>
          <div style={S.kpiLabel}>{LTPM_META.VERT.icon} LTPM Vert</div>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={S.toolbar}>
        <input
          type="text"
          placeholder="🔎 Rechercher un opérateur (nom ou matricule)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={S.searchInput}
        />
        {(search || ltpmFilter !== "ALL") && (
          <button style={S.resetBtn} onClick={() => { setSearch(""); setLtpmFilter("ALL"); }}>
            ✕ Réinitialiser
          </button>
        )}
        <span style={S.resultsCount}>{filteredOperators.length} opérateur(s)</span>
      </div>

      {/* ── Operator grid ── */}
      {filteredOperators.length === 0 ? (
        <div style={S.emptyState}>Aucun opérateur trouvé pour ce plant.</div>
      ) : (
        <div style={S.opGrid}>
          {filteredOperators.map((op) => {
            const meta = LTPM_META[op.bucket];
            return (
              <div
                key={op.operateurId}
                style={{ ...S.opCard, borderColor: meta.border }}
                onClick={() => setSelectedOperatorId(op.operateurId)}
              >
                <div style={{ ...S.opFlag, background: meta.bg, color: meta.color }}>{meta.icon} {meta.label}</div>
                <div style={S.opAvatar}>{getInitials(op.operateurNom)}</div>
                <div style={S.opName}>{op.operateurNom}</div>
                <div style={S.opMatricule}>Matricule : {op.operateurMatricule}</div>
                <div style={S.opStatsRow}>
                  <span style={S.opStatPill}>📋 {op.checklists.length} checklist(s)</span>
                  <span style={S.opStatPill}>🗓 {fmtDate(op.derniereDate)}</span>
                </div>
                <div style={S.opBadgesRow}>
                  <span style={{ ...S.miniBadge, color: LTPM_META.ROUGE.color }}>🔴 {op.nbRouge}</span>
                  <span style={{ ...S.miniBadge, color: LTPM_META.JAUNE.color }}>🟡 {op.nbJaune}</span>
                  <span style={{ ...S.miniBadge, color: LTPM_META.VERT.color }}>🟢 {op.nbVert}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal historique opérateur ── */}
      {selectedOperator && (
        <div style={S.modalWrap} onClick={() => setSelectedOperatorId(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.opAvatar}>{getInitials(selectedOperator.operateurNom)}</div>
              <div style={{ flex: 1 }}>
                <div style={S.modalTitle}>{selectedOperator.operateurNom}</div>
                <div style={S.modalSub}>Matricule {selectedOperator.operateurMatricule} · {selectedOperator.checklists.length} checklist(s) soumise(s)</div>
              </div>
              <button style={S.closeBtn} onClick={() => setSelectedOperatorId(null)}>✕</button>
            </div>

            <div style={S.modalBody}>
              {selectedOperator.checklists.map((c) => {
                const bucket = checklistBucket(c);
                const bMeta = LTPM_META[bucket];
                const sMeta = STATUS_META[c.status] || { color: "#6b7280", bg: "#f3f4f6", label: c.status, icon: "•" };
                const sess = SESSION_META[c.session] || { label: c.session, icon: "🕒" };
                return (
                  <div key={c.id} style={S.histRow} onClick={() => setSelectedChecklist(c)}>
                    <div style={{ ...S.histFlag, background: bMeta.bg, color: bMeta.color }}>{bMeta.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={S.histLine1}>
                        <span style={S.histDate}>{fmtDate(c.date)}</span>
                        <span style={S.histSep}>·</span>
                        <span>{sess.icon} {sess.label}</span>
                        <span style={S.histSep}>·</span>
                        <span>🔧 {c.machineNom || c.processusNom || "—"}</span>
                      </div>
                      <div style={S.histLine2}>
                        <span style={{ ...S.statusBadge, background: sMeta.bg, color: sMeta.color }}>{sMeta.icon} {sMeta.label}</span>
                        {c.plantNom && <span style={S.histPlant}>🏭 {c.plantNom}</span>}
                      </div>
                    </div>
                    <span style={S.histArrow}>→</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal détail checklist ── */}
      {selectedChecklist && (
        <div style={S.modalWrap} onClick={() => setSelectedChecklist(null)}>
          <div style={S.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={{ flex: 1 }}>
                <div style={S.modalTitle}>Checklist du {fmtDate(selectedChecklist.date)}</div>
                <div style={S.modalSub}>
                  {(SESSION_META[selectedChecklist.session] || {}).label} · {selectedChecklist.machineNom || selectedChecklist.processusNom || "—"}
                </div>
              </div>
              <button style={S.closeBtn} onClick={() => setSelectedChecklist(null)}>✕</button>
            </div>

            <div style={S.modalBody}>
              {/* Suivi de validation */}
              <div style={S.detailSection}>
                <div style={S.detailSectionTitle}>Suivi de validation</div>
                <div style={S.trailRow}>
                  <span>📤 Soumis</span>
                </div>
                {selectedChecklist.valideN1Par && (
                  <div style={S.trailRow}><span>✅ Validé N1 par {selectedChecklist.valideN1Par}</span><span style={S.trailDate}>{fmtDateTime(selectedChecklist.dateValidationN1)}</span></div>
                )}
                {selectedChecklist.valideN2Par && (
                  <div style={S.trailRow}><span>✅ Validé N2 par {selectedChecklist.valideN2Par}</span><span style={S.trailDate}>{fmtDateTime(selectedChecklist.dateValidationN2)}</span></div>
                )}
                {selectedChecklist.valideParFinal && (
                  <div style={S.trailRow}><span>🏆 Validé final par {selectedChecklist.valideParFinal}</span><span style={S.trailDate}>{fmtDateTime(selectedChecklist.dateValidationFinale)}</span></div>
                )}
                {selectedChecklist.status === "REJETE" && (
                  <div style={{ ...S.trailRow, color: "#dc2626" }}>
                    <span>❌ Rejeté par {selectedChecklist.rejetePar || "—"} : {selectedChecklist.motifRejet || "—"}</span>
                    <span style={S.trailDate}>{fmtDateTime(selectedChecklist.dateRejet)}</span>
                  </div>
                )}
              </div>

              {/* Réponses / critères */}
              <div style={S.detailSection}>
                <div style={S.detailSectionTitle}>Critères ({(selectedChecklist.reponses || []).length})</div>
                {(selectedChecklist.reponses || []).map((r) => {
                  const cMeta = LTPM_META[r.valeur] || { color: "#6b7280", bg: "#f3f4f6", icon: "•" };
                  return (
                    <div key={r.id} style={S.critRow}>
                      <span style={{ ...S.critFlag, background: cMeta.bg, color: cMeta.color }}>{cMeta.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={S.critNom}>{r.critereNom}</div>
                        {r.commentaire && <div style={S.critComment}>{r.commentaire}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const spinCss = `
@keyframes oltpmSpin { to { transform: rotate(360deg); } }
`;

const S = {
  page: { padding: "24px 28px", maxWidth: 1280, margin: "0 auto" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, minHeight: 300 },
  spinner: { width: 32, height: 32, border: "3px solid var(--bd-1)", borderTopColor: "var(--l5)", borderRadius: "50%", animation: "oltpmSpin 0.8s linear infinite" },

  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 10 },
  title: { fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, color: "var(--tx-1)", margin: 0 },
  subtitle: { fontSize: 13.5, color: "var(--tx-3)", margin: "4px 0 0" },

  errorBanner: { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13.5 },

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 },
  kpiCard: { background: "#fff", border: "1px solid var(--bd-1)", borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "all .15s ease", boxShadow: "var(--sh-xs)" },
  kpiValue: { fontSize: 26, fontWeight: 800, color: "var(--tx-1)", fontFamily: "var(--fh)" },
  kpiLabel: { fontSize: 12.5, color: "var(--tx-3)", marginTop: 4, fontWeight: 600 },

  toolbar: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  searchInput: { flex: "1 1 280px", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--bd-1)", fontSize: 13.5, outline: "none", fontFamily: "var(--fb)" },
  resetBtn: { padding: "8px 14px", borderRadius: 8, border: "1px solid var(--bd-1)", background: "#fff", color: "var(--tx-3)", fontSize: 12.5, cursor: "pointer" },
  resultsCount: { fontSize: 12.5, color: "var(--tx-3)", fontWeight: 600 },

  emptyState: { textAlign: "center", padding: "60px 20px", color: "var(--tx-3)", fontSize: 14 },

  opGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 },
  opCard: { background: "#fff", border: "1.5px solid", borderRadius: 16, padding: 18, cursor: "pointer", transition: "all .15s ease", boxShadow: "var(--sh-xs)", display: "flex", flexDirection: "column", gap: 8 },
  opFlag: { alignSelf: "flex-start", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99 },
  opAvatar: { width: 42, height: 42, borderRadius: "50%", background: "var(--grd-main)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 },
  opName: { fontWeight: 700, fontSize: 15, color: "var(--tx-1)" },
  opMatricule: { fontSize: 12, color: "var(--tx-3)" },
  opStatsRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 },
  opStatPill: { fontSize: 11.5, background: "var(--bg-2)", color: "var(--tx-2)", padding: "3px 8px", borderRadius: 8, fontWeight: 600 },
  opBadgesRow: { display: "flex", gap: 12, marginTop: 2 },
  miniBadge: { fontSize: 12, fontWeight: 700 },

  modalWrap: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#fff", borderRadius: 18, width: "min(560px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "var(--sh-2xl, 0 20px 50px rgba(0,0,0,0.25))" },
  detailModal: { background: "#fff", borderRadius: 18, width: "min(560px, 100%)", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  modalHead: { display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid var(--bd-1)" },
  modalTitle: { fontWeight: 800, fontSize: 16, color: "var(--tx-1)" },
  modalSub: { fontSize: 12.5, color: "var(--tx-3)", marginTop: 2 },
  closeBtn: { border: "none", background: "var(--bg-2)", width: 30, height: 30, borderRadius: 8, cursor: "pointer", fontSize: 14, color: "var(--tx-2)" },
  modalBody: { padding: "12px 16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 },

  histRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bd-1)", cursor: "pointer", transition: "all .15s ease" },
  histFlag: { width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 },
  histLine1: { fontSize: 13, color: "var(--tx-1)", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  histDate: { fontWeight: 700 },
  histSep: { color: "var(--tx-4)" },
  histLine2: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 },
  histPlant: { fontSize: 11.5, color: "var(--tx-3)" },
  histArrow: { color: "var(--tx-4)", fontSize: 14 },
  statusBadge: { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 },

  detailSection: { border: "1px solid var(--bd-1)", borderRadius: 12, padding: 14 },
  detailSectionTitle: { fontWeight: 700, fontSize: 13, color: "var(--tx-1)", marginBottom: 10 },
  trailRow: { display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--tx-2)", padding: "4px 0" },
  trailDate: { color: "var(--tx-4)", fontSize: 11.5 },

  critRow: { display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--bg-2)" },
  critFlag: { width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 },
  critNom: { fontSize: 13, color: "var(--tx-1)", fontWeight: 600 },
  critComment: { fontSize: 12, color: "var(--tx-3)", marginTop: 2, fontStyle: "italic" },
};
