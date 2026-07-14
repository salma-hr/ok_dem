import { useState, useEffect } from "react";
import Modal from "../../components/Modal";
import api from "../../api/axiosInstance";
import { getUsableStoredToken } from "../../utils/authToken";

/* ── helpers ── */
const ACTION_META = {
  CREATION:     { label: "Création",     bg: "#ecfdf5", color: "#059669", border: "#6ee7b7", icon: "✚" },
  MODIFICATION: { label: "Modification", bg: "#eff6ff", color: "#2563eb", border: "#93c5fd", icon: "✏" },
  SUPPRESSION:  { label: "Suppression",  bg: "#fff1f2", color: "#e11d48", border: "#fda4af", icon: "✕" },
};

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/* ── DiffLine : affiche "champ: avant → après" avec coloration ── */
function DiffBlock({ changements }) {
  if (!changements?.trim()) return null;
  const lines = changements.split("\n").filter(Boolean);
  return (
    <div style={{ marginTop: 8 }}>
      {lines.map((line, i) => {
        const [champ, ...rest] = line.split(": ");
        const valeur = rest.join(": ");
        const [avant, apres] = valeur.split(" → ");
        return (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "140px 1fr 20px 1fr",
            gap: 4,
            alignItems: "center",
            padding: "4px 8px",
            borderRadius: 6,
            background: i % 2 === 0 ? "#f8fafc" : "#fff",
            marginBottom: 2,
            fontSize: 12,
          }}>
            <span style={{ color: "#64748b", fontWeight: 600, fontSize: 11 }}>{champ}</span>
            <span style={{
              background: "#fff1f2", color: "#be123c",
              padding: "2px 8px", borderRadius: 4,
              fontFamily: "monospace", wordBreak: "break-all",
            }}>{avant || "—"}</span>
            <span style={{ textAlign: "center", color: "#94a3b8", fontSize: 14 }}>→</span>
            <span style={{
              background: "#f0fdf4", color: "#15803d",
              padding: "2px 8px", borderRadius: 4,
              fontFamily: "monospace", wordBreak: "break-all",
            }}>{apres || "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ── */
export default function CritereHistoriqueModal({ critereId, critereNom, onClose }) {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!critereId) return;
    const token = getUsableStoredToken();
    if (!token) {
      setError("Session expirée. Veuillez vous reconnecter.");
      setLoading(false);
      return;
    }
    setLoading(true);

    api.get(`/criteres/${critereId}/historique`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch((err) => {
        const status = err?.response?.status;
        console.warn(`[Historique] status=${status}`, err?.response?.data);
        if (status === 401) {
          setError("Session expirée. Veuillez vous reconnecter.");
          return;
        }
        if (status === 403) {
          setError("Accès refusé : rôle insuffisant (PPO, Admin ou Agent Qualité requis).");
          return;
        }
        setError(`Erreur ${status ?? 'réseau'} — voir console.`);
      })
      .finally(() => setLoading(false));
    }, [critereId]);

  const toggleExpand = (id) => setExpanded(prev => prev === id ? null : id);

  return (
    <Modal
      title={`Historique — ${critereNom || "critère"}`}
      onClose={onClose}
      size="wide"
    >
      <div style={{ minHeight: 200, maxHeight: "70vh", overflowY: "auto" }}>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 32, justifyContent: "center" }}>
            <div style={css.spinner} />
            <span style={{ color: "#94a3b8", fontSize: 14 }}>Chargement…</span>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div style={{ background: "#fff1f2", color: "#be123c", padding: "12px 16px", borderRadius: 8, border: "1px solid #fda4af", fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && logs.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontSize: 14 }}>Aucune modification enregistrée</div>
          </div>
        )}

        {/* ── Timeline ── */}
        {!loading && logs.length > 0 && (
          <div style={{ position: "relative" }}>

            {/* Ligne verticale de timeline */}
            <div style={{
              position: "absolute", left: 19, top: 0, bottom: 0,
              width: 2, background: "linear-gradient(to bottom, #e2e8f0 0%, transparent 100%)",
            }} />

            {logs.map((log, idx) => {
              const meta      = ACTION_META[log.action] || ACTION_META.MODIFICATION;
              const isExpanded = expanded === log.id;
              const hasDiff    = log.changements?.trim()?.length > 0;

              return (
                <div key={log.id} style={{ display: "flex", gap: 14, marginBottom: 6, position: "relative" }}>

                  {/* Dot sur la timeline */}
                  <div style={{
                    flexShrink: 0,
                    width: 38, height: 38,
                    borderRadius: "50%",
                    background: meta.bg,
                    border: `2px solid ${meta.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: meta.color, fontSize: 14, fontWeight: 700,
                    zIndex: 1,
                    marginTop: 4,
                  }}>
                    {meta.icon}
                  </div>

                  {/* Carte */}
                  <div style={{
                    flex: 1,
                    background: "#fff",
                    border: `1px solid ${isExpanded ? meta.border : "#e2e8f0"}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 2,
                    borderLeft: `3px solid ${meta.color}`,
                    cursor: hasDiff ? "pointer" : "default",
                    transition: "border-color 0.15s",
                  }} onClick={() => hasDiff && toggleExpand(log.id)}>

                    {/* En-tête de la carte */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Badge action */}
                        <span style={{
                          padding: "2px 10px", borderRadius: 20,
                          fontSize: 11, fontWeight: 700,
                          background: meta.bg, color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}>
                          {meta.label}
                        </span>
                        {/* Auteur */}
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                          {log.utilisateurNom || log.matricule || "Inconnu"}
                        </span>
                        {log.matricule && log.utilisateurNom && (
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>({log.matricule})</span>
                        )}
                      </div>
                      {/* Date */}
                      <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
                        {fmtDate(log.dateAction)}
                      </span>
                    </div>

                    {/* Résumé diff (compact) */}
                    {hasDiff && !isExpanded && (
                      <div style={{
                        marginTop: 6, fontSize: 12, color: "#64748b",
                        fontStyle: "italic", lineHeight: 1.5,
                      }}>
                        {log.changements.split("\n").slice(0, 2).join(" · ")}
                        {log.changements.split("\n").length > 2 && " …"}
                        <span style={{ marginLeft: 8, color: "#6366f1", fontStyle: "normal", fontWeight: 600 }}>
                          Voir détails ▾
                        </span>
                      </div>
                    )}

                    {/* Diff détaillé (expandé) */}
                    {isExpanded && hasDiff && (
                      <>
                        <DiffBlock changements={log.changements} />
                        <div style={{ marginTop: 6, fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                          Réduire ▴
                        </div>
                      </>
                    )}

                    {/* Message pour création / suppression */}
                    {!hasDiff && log.action === "CREATION" && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#059669" }}>
                        Critère créé
                      </div>
                    )}
                    {!hasDiff && log.action === "SUPPRESSION" && (
                      <div style={{ marginTop: 4, fontSize: 12, color: "#e11d48" }}>
                        Critère supprimé
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
        <button
          style={{
            background: "#f1f5f9", color: "#475569",
            border: "1.5px solid #e2e8f0", borderRadius: 8,
            padding: "9px 20px", fontWeight: 600, cursor: "pointer", fontSize: 13,
          }}
          onClick={onClose}
        >
          Fermer
        </button>
      </div>
    </Modal>
  );
}

const css = {
  spinner: {
    width: 24, height: 24,
    border: "3px solid #e2e8f0",
    borderTop: "3px solid #6366f1",
    borderRadius: "50%",
    animation: "spin .7s linear infinite",
  },
};