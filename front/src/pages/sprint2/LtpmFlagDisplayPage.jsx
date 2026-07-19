import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllChecklists } from "../../api";
import { useI18n } from "../../context/I18nContext";

/* ─────────────────────────────────────────────────────────────────
   Affichage plein écran de l'état du drapeau LTPM (ROUGE / JAUNE / VERT)
   Remplace le drapeau papier posé sur le poste : à laisser ouvert en
   permanence sur un PC dédié au poste opérateur. L'état est mis en
   cache (localStorage) pour s'afficher instantanément à la réouverture,
   puis rafraîchi automatiquement depuis le serveur.
   ───────────────────────────────────────────────────────────────── */

const STORAGE_KEY = "ltpm_flag_display_v1";
const PHOTOS_KEY  = "ltpm_flag_photos_v1"; // photos réelles du drapeau, une par couleur/état
const MODE_KEY     = "ltpm_flag_mode_v1";   // "icon" (par défaut) ou "photo"
const REFRESH_MS = 30000; // rafraîchissement auto toutes les 30s

const FLAG_CFG = {
  ROUGE: { icon: "🔴", gradient: "linear-gradient(160deg,#ef4444,#9f1239)", label: "ROUGE" },
  JAUNE: { icon: "🟡", gradient: "linear-gradient(160deg,#eab308,#a16207)", label: "JAUNE" },
  VERT:  { icon: "🟢", gradient: "linear-gradient(160deg,#22c55e,#15803d)", label: "VERT" },
};

// Même règle de calcul que OperateursLtpmPage : le pire cas prévaut
const checklistBucket = (c) => {
  const reponses = c.reponses || [];
  const hasRouge = c.status === "REJETE" || reponses.some((r) => r.valeur === "ROUGE");
  if (hasRouge) return "ROUGE";
  const hasJaune = reponses.some((r) => r.valeur === "JAUNE");
  if (hasJaune) return "JAUNE";
  return "VERT";
};

const readCache = (machineId) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all?.[machineId || "default"] || null;
  } catch {
    return null;
  }
};

const writeCache = (machineId, entry) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[machineId || "default"] = entry;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota / parsing errors */
  }
};

// Photos réelles du drapeau (une image par couleur), pour remplacer le drapeau
// papier posé sur la machine par une vraie photo affichée sur le PC opérateur.
// Stockées en base64 dans localStorage : pas de dépendance serveur, dispo hors-ligne.
const readPhotos = () => {
  try {
    const raw = localStorage.getItem(PHOTOS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writePhotos = (photos) => {
  try {
    localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
  } catch {
    /* ignore quota / parsing errors (image trop volumineuse) */
  }
};

const readMode = () => {
  try {
    return localStorage.getItem(MODE_KEY) === "photo" ? "photo" : "icon";
  } catch {
    return "icon";
  }
};

export default function LtpmFlagDisplayPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const machineId   = params.get("machineId") || "";
  const machineNom  = params.get("machineNom") || "";
  const processusNom = params.get("processusNom") || "";
  const autoLaunch  = params.get("auto") === "1";

  const [state, setState] = useState(() => readCache(machineId));
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mode, setMode] = useState(readMode); // "icon" | "photo"
  const [photos, setPhotos] = useState(readPhotos); // { ROUGE, JAUNE, VERT } -> dataURL
  const wrapRef = useRef(null);
  const hideTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getAllChecklists()
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        let filtered = list.filter((c) => c.status !== "EN_COURS");
        if (machineId) {
          filtered = filtered.filter((c) => String(c.machineId) === String(machineId));
        }
        if (!filtered.length) return; // garde le dernier état connu (cache) si rien de neuf
        const sorted = [...filtered].sort((a, b) => {
          const da = new Date(a.date || 0).getTime();
          const db = new Date(b.date || 0).getTime();
          return db - da || (b.id || 0) - (a.id || 0);
        });
        const latest = sorted[0];
        const entry = {
          bucket: checklistBucket(latest),
          machineNom: latest.machineNom || machineNom || "",
          processusNom: latest.processusNom || processusNom || "",
          date: latest.date || null,
          updatedAt: Date.now(),
        };
        setState(entry);
        writeCache(machineId, entry);
      })
      .catch(() => {
        /* silencieux : on garde le dernier état affiché */
      })
      .finally(() => setLoading(false));
  }, [machineId, machineNom, processusNom]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  // Suivi de l'état plein écran natif du navigateur
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Passage automatique en plein écran natif juste après la soumission d'une
  // checklist (arrivée avec ?auto=1) : le clic "Soumettre" de l'opérateur sert
  // de geste utilisateur pour autoriser l'appel Fullscreen API du navigateur.
  useEffect(() => {
    if (!autoLaunch) return;
    const el = wrapRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => { /* refusé par le navigateur : l'affichage reste plein cadre (position fixed) */ });
    }
  }, [autoLaunch]);

  // Masque automatiquement la barre de contrôle après quelques secondes d'inactivité
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => hideTimerRef.current && clearTimeout(hideTimerRef.current);
  }, [resetHideTimer]);

  const bucket = state?.bucket || "VERT";
  const cfg = FLAG_CFG[bucket];
  const lastUpdateStr = state?.updatedAt
    ? new Date(state.updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const currentPhoto = photos?.[bucket] || null;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const togglePhotoMode = () => {
    setMode((m) => {
      const next = m === "photo" ? "icon" : "photo";
      try { localStorage.setItem(MODE_KEY, next); } catch { /* ignore */ }
      return next;
    });
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handlePhotoSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de resélectionner le même fichier plus tard
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => {
        const next = { ...prev, [bucket]: reader.result };
        writePhotos(next);
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[bucket];
      writePhotos(next);
      return next;
    });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      style={{
        position: "fixed",
        inset: 0,
        background: cfg.gradient,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        zIndex: 999,
      }}
    >
      {/* Décor */}
      <div style={{ position: "absolute", width: 480, height: 480, background: "rgba(255,255,255,0.08)", borderRadius: "50%", top: -180, left: -140, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 380, height: 380, background: "rgba(255,255,255,0.08)", borderRadius: "50%", bottom: -160, right: -120, pointerEvents: "none" }} />

      {mode === "photo" && currentPhoto ? (
        <>
          {/* Photo réelle du drapeau (remplace l'icône), encadrée par la couleur d'état */}
          <img
            src={currentPhoto}
            alt={`Drapeau LTPM ${cfg.label}`}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              padding: "3vw",
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 26,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(4px)",
              borderRadius: 12,
              padding: "10px 22px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "min(6vw, 44px)", fontWeight: 900, color: "#fff", letterSpacing: "2px", fontFamily: "var(--fh)" }}>
              LTPM {cfg.label}
            </div>
            {(machineNom || state?.machineNom) && (
              <div style={{ fontSize: "min(3vw, 20px)", fontWeight: 700, color: "rgba(255,255,255,0.92)", marginTop: 2 }}>
                ⚙️ {machineNom || state?.machineNom}
              </div>
            )}
            {lastUpdateStr && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
                {t("ltpmFlag.lastUpdate")} {lastUpdateStr}{loading ? " · …" : ""}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Contenu principal (mode icône) */}
          <div style={{ fontSize: "min(22vw, 220px)", lineHeight: 1, filter: "drop-shadow(0 8px 30px rgba(0,0,0,0.25))" }}>
            {cfg.icon}
          </div>
          <div style={{ fontSize: "min(9vw, 88px)", fontWeight: 900, color: "#fff", letterSpacing: "2px", fontFamily: "var(--fh)", marginTop: 8, textShadow: "0 4px 18px rgba(0,0,0,0.25)" }}>
            LTPM {cfg.label}
          </div>
          {(machineNom || state?.machineNom) && (
            <div style={{ fontSize: "min(4vw, 30px)", fontWeight: 700, color: "rgba(255,255,255,0.92)", marginTop: 14 }}>
              ⚙️ {machineNom || state?.machineNom}
            </div>
          )}
          {(processusNom || state?.processusNom) && (
            <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              {processusNom || state?.processusNom}
            </div>
          )}
          {lastUpdateStr && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 22 }}>
              {t("ltpmFlag.lastUpdate")} {lastUpdateStr}{loading ? " · …" : ""}
            </div>
          )}
          {mode === "photo" && !currentPhoto && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 14, maxWidth: 440, textAlign: "center", background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 16px" }}>
              {t("ltpmFlag.noPhotoHint")}
            </div>
          )}
        </>
      )}
      {!machineId && (
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 10, maxWidth: 440, textAlign: "center" }}>
          {t("ltpmFlag.noMachineHint")}
        </div>
      )}

      {/* Barre de contrôle discrète (se masque automatiquement) */}
      <div
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          display: "flex",
          gap: 8,
          opacity: showControls ? 1 : 0,
          transition: "opacity .4s ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        <button onClick={refresh} style={ctrlBtnStyle} title={t("ltpmFlag.refreshBtn")}>🔄</button>
        <button
          onClick={togglePhotoMode}
          style={{ ...ctrlBtnStyle, ...(mode === "photo" ? ctrlBtnActiveStyle : {}) }}
          title={mode === "photo" ? t("ltpmFlag.iconModeBtn") : t("ltpmFlag.photoModeBtn")}
        >
          {mode === "photo" ? "🚩" : "📷"}
        </button>
        {mode === "photo" && (
          <button onClick={openFilePicker} style={ctrlBtnStyle} title={t("ltpmFlag.uploadPhotoBtn")}>📤</button>
        )}
        {mode === "photo" && currentPhoto && (
          <button onClick={clearPhoto} style={ctrlBtnStyle} title={t("ltpmFlag.clearPhotoBtn")}>🗑</button>
        )}
        <button onClick={toggleFullscreen} style={ctrlBtnStyle} title={t("ltpmFlag.fullscreenBtn")}>
          {isFullscreen ? "⤢" : "⛶"}
        </button>
        <button onClick={() => navigate("/checklist/operateur")} style={ctrlBtnStyle} title={t("ltpmFlag.exitBtn")}>✕</button>
      </div>

      {/* Sélecteur de fichier caché, utilisé pour associer une photo à l'état courant */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelected}
        style={{ display: "none" }}
      />
    </div>
  );
}

const ctrlBtnStyle = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(0,0,0,0.22)",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(4px)",
};

const ctrlBtnActiveStyle = {
  background: "rgba(255,255,255,0.85)",
  color: "#111",
  borderColor: "#fff",
};
