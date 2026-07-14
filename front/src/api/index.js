import api from "./axiosInstance";
import { getUsableStoredToken } from "../utils/authToken";

// AUTH
export const loginApi          = (matricule, password) => api.post("/auth/login", { matricule, password });
export const registerApi       = (data) => api.post("/auth/register", data);
export const forgotPasswordApi = (matricule) => api.post("/auth/forgot-password", { matricule });
export const resetPasswordApi  = (token, newPassword) => api.post("/auth/reset-password", { token, newPassword });
export const getRolesPublic    = () => api.get("/auth/roles");

// UTILISATEURS
export const getAllUtilisateurs    = ()         => api.get("/admin/utilisateurs");
export const createUtilisateur     = (data)     => api.post("/admin/utilisateurs", data);
export const updateUtilisateur     = (id, data) => api.put(`/admin/utilisateurs/${id}`, data);
export const deleteUtilisateur     = (id)       => api.delete(`/admin/utilisateurs/${id}`);
export const reactiverUtilisateur  = (id)       => api.patch(`/admin/utilisateurs/${id}/reactivate`);
export const hardDeleteUtilisateur = (id)       => api.delete(`/admin/utilisateurs/${id}/permanent`);
export const getAllRoles            = ()         => api.get("/admin/utilisateurs/roles");

// SITES
export const getAllSites  = ()         => api.get("/sites");
export const getSiteById = (id)       => api.get(`/sites/${id}`);
export const createSite  = (data)     => api.post("/sites", data);
export const updateSite  = (id, data) => api.put(`/sites/${id}`, data);
export const deleteSite  = (id)       => api.delete(`/sites/${id}`);

// PLANTS
export const getAllPlants      = ()         => api.get("/plants");
export const getPlantsBySite  = (siteId)   => api.get(`/plants/site/${siteId}`);
export const createPlant      = (data)     => api.post("/plants", data);
export const updatePlant      = (id, data) => api.put(`/plants/${id}`, data);
export const deletePlant      = (id)       => api.delete(`/plants/${id}`);

// SEGMENTS
export const getAllSegments      = ()          => api.get("/segments");
export const getSegmentsByPlant  = (plantId)  => api.get(`/segments/plant/${plantId}`);
export const createSegment       = (data)     => api.post("/segments", data);
export const updateSegment       = (id, data) => api.put(`/segments/${id}`, data);
export const deleteSegment       = (id)       => api.delete(`/segments/${id}`);

// PROCESSUS
export const getAllProcessus        = ()            => api.get("/processus");
export const getProcessusBySegment  = (segmentId)  => api.get(`/processus/segment/${segmentId}`);
export const createProcessus        = (data)       => api.post("/processus", data);
export const updateProcessus        = (id, data)   => api.put(`/processus/${id}`, data);
export const deleteProcessus        = (id)         => api.delete(`/processus/${id}`);

// MACHINES
export const getAllMachines          = ()         => api.get("/machines");
export const getMachinesByProcessus  = (id)       => api.get(`/machines/processus/${id}`);
export const createMachine           = (data)     => api.post("/machines", data);
export const updateMachine           = (id, data) => api.put(`/machines/${id}`, data);
export const deleteMachine           = (id)       => api.delete(`/machines/${id}`);

// CRITERES
export const getAllCriteres          = ()         => api.get("/criteres");
export const getCriteresByProcessus  = (id, ussVariant) => {
  const url = `/criteres/processus/${id}`;
  return ussVariant 
    ? api.get(url, { params: { ussVariant } })
    : api.get(url);
};
export const createCritere           = (data)     => api.post("/criteres", data);
export const updateCritere           = (id, data) => api.put(`/criteres/${id}`, data);
export const batchDeleteCriteres     = (ids)      => api.post("/criteres/batch-delete", { ids });
export const batchCreateCriteres     = (data)     => api.post("/criteres/batch", data);
export const uploadCritereImage      = (file)     => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/criteres/upload-image", formData);
};
export const importCriteresPdf       = (file, processusId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("processusId", String(processusId));
  const token = getUsableStoredToken();
  return api.post("/criteres/import-pdf", formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
};
export const previewCriteresPdf      = (file, processusId) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("processusId", String(processusId));
  const token = getUsableStoredToken();
  return api.post("/criteres/import-pdf/preview", formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
};
export const deleteCritere = (id) => api.delete(`/criteres/${id}`);

// ── Traduction via LibreTranslate (proxy backend) ────────────────
// Évite les problèmes CORS d'un appel direct depuis le browser.
export const translateText = (text, source = "fr", target = "en") =>
  api.post("/translate", { text, source, target });

export const getTranslateStatus = () =>
  api.get("/translate/status");
export const generateAiCritereImage = (id, prompt) =>
  api.post(`/criteres/${id}/generate-ai-image`, null, { params: { prompt } });
export const recomputeCritereImages = (processusId, force = true, limit = 0) =>
  api.post("/criteres/recompute-images", null, {
    params: { processusId, force, limit },
  });

  export const regenerateCritereImage = (id, keyword) =>
  api.post(
    `/criteres/${id}/regenerate-image`,
    null,
    keyword && keyword.trim() ? { params: { keyword } } : {}
  );

// ══════════════════════════════════════════════════════════
//  CHECKLIST
// ══════════════════════════════════════════════════════════
export const getAllChecklists      = ()         => api.get("/checklists");
export const getChecklistById      = (id)       => api.get(`/checklists/${id}`);
// Vérifier l'état avant de commencer (NOUVEAU / BROUILLON / DEJA_SOUMIS)
export const verifierEtatChecklist = (operateurId, machineId, session, date) =>
  api.get("/checklists/etat", { params: { operateurId, machineId, session, date } });

// Sauvegarder un brouillon (réponses partielles, EN_COURS)
export const sauvegarderBrouillon  = (data)     => api.post("/checklists/brouillon", data);

// Récupérer les brouillons d'un opérateur
export const getBrouillonsOperateur = (operateurId) =>
  api.get(`/checklists/brouillons/operateur/${operateurId}`);

export const getBrouillonsActifs = (operateurId, date) =>
  api.get(`/checklists/brouillons/operateur/${operateurId}`, { params: { date } });
// Soumettre une checklist complète (passe à SOUMIS)
export const soumettreChecklist    = (data)     => api.post("/checklists/soumettre", data);

export const validerChecklistN1    = (id)       => api.patch(`/checklists/${id}/valider-n1`);
export const validerChecklistN2    = (id)       => api.patch(`/checklists/${id}/valider-n2`);
export const validerChecklistFinal = (id)       => api.patch(`/checklists/${id}/valider-final`);
export const rejeterChecklist      = (id, motif = "") =>
  api.patch(`/checklists/${id}/rejeter`, null, { params: { motif } });
export const deleteChecklist       = (id)       => api.delete(`/checklists/${id}`);

// PROFIL
export const getMonProfil    = ()     => api.get("/profil/me");
export const updateMonProfil = (data) => api.put("/profil/me", data);

// DASHBOARD
export const getDashboardStats       = ()           => api.get("/dashboard/stats");
export const getDashboardProcessus   = ()           => api.get("/dashboard/processus-counts");
export const getDashboardRecentLists = (limit = 10) => api.get(`/dashboard/recent-checklists?limit=${limit}`);
export const getDashboardStatsPeriod = (start, end) => api.get(`/dashboard/stats/period?startDate=${start}&endDate=${end}`);
export const getDashboardOperatorPerformance = (days = 30) =>
  api.get("/dashboard/operator-performance", { params: { days } });

// NOTIFICATIONS
export const getNotifications  = ()    => api.get("/notifications");
export const getUnreadCount    = ()    => api.get("/notifications/unread-count");
export const marquerNotifLue   = (id)  => api.patch(`/notifications/${id}/lire`);
export const marquerToutesLues = ()    => api.patch("/notifications/lire-tout");

// ── Checklists ──────────────────────────────────────────────────────
export const checklistAPI = {
  findAll: () => api.get('/checklists'),
  findById: (id) => api.get(`/checklists/${id}`),
  getAudit: (id) => api.get(`/checklists/${id}/audit`),
  exportPdf: (id) => {
    const token = getUsableStoredToken();
    return api.get(`/checklists/${id}/export-pdf`, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },
  deleteAll: () => api.delete("/checklists/delete-all"),
  validerN1: (id) => api.patch(`/checklists/${id}/valider-n1`),
  validerN2: (id) => api.patch(`/checklists/${id}/valider-n2`),
  validerFinal: (id) => api.patch(`/checklists/${id}/valider-final`),
  rejeter: (id, motif) => api.patch(`/checklists/${id}/rejeter?motif=${encodeURIComponent(motif)}`),
};
 
// ── Plans d'action ──────────────────────────────────────────────────
export const planActionAPI = {
  findAll: () => api.get('/plans-action'),
  findById: (id) => api.get(`/plans-action/${id}`),
  findByChecklist: (checklistId) => api.get(`/plans-action/checklist/${checklistId}`),
  mesPLans: () => api.get('/plans-action/mes-plans'),
  creer: (data) => api.post('/plans-action', data),
  mettreEnCours: (id) => api.patch(`/plans-action/${id}/en-cours`),
  cloturer: (id, commentaire) => api.patch(`/plans-action/${id}/cloturer?commentaire=${encodeURIComponent(commentaire)}`),
  validerAQ: (id, commentaire = "") => api.patch(`/plans-action/${id}/valider-aq?commentaire=${encodeURIComponent(commentaire)}`),
  supprimer: (id) => api.delete(`/plans-action/${id}`),
  suggererDescription: (checklistId) => api.post(`/plans-action/suggerer-description/${checklistId}`),
};
 
// ── Notifications ───────────────────────────────────────────────────
export const notificationAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/lire`),
  markAllAsRead: () => api.patch('/notifications/lire-tout'),
};
 
// ── Utilisateurs (pour sélecteur responsable) ───────────────────────
export const utilisateurAPI = {
  findAll: () => api.get('/utilisateurs'),
};


// -----------------------------------------
// Real-time anomalies (WebSocket) & Labeling
// -----------------------------------------

export function subscribeAnomalies(onMessage, wsUrl = null, roles = []) {
  const wsEnabled = String(process.env.REACT_APP_ENABLE_ANOMALY_WS ?? 'true').toLowerCase() !== 'false';
  if (!wsEnabled) {
    return { close: () => {} };
  }

  // Construire automatiquement l'URL WebSocket à partir de api.defaults.baseURL si possible.
  let url = wsUrl;
  if (!url) {
    try {
      const base = api.defaults && api.defaults.baseURL;
      if (base) {
        // Ex: base = 'http://localhost:8081/api' -> ws = 'ws://localhost:8081/ws/anomalies'
        const parsed = new URL(base);
        const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${wsProto}//${parsed.host}/ws/anomalies`;
        console.info('Realtime WS URL ->', url);
      }
    } catch (e) {
      url = null;
    }
  }
  if (!url) {
    // Fallback : utiliser l'hôte et le port de la page courante (utile en dev)
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname + (window.location.port ? `:${window.location.port}` : '');
    url = `${proto}//${host}/ws/anomalies`;
  }
  let ws;
  let reconnectDelay = 1000;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 8;
  let intentionallyClosed = false;

  const scheduleReconnect = () => {
    if (intentionallyClosed) return;
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.warn('Anomalies WS disabled after repeated failures.');
      return;
    }
    reconnectAttempts += 1;
    console.warn(`WS closed (attempt ${reconnectAttempts}/${maxReconnectAttempts}) - reconnecting in ${reconnectDelay}ms`);
    setTimeout(() => {
      reconnectDelay = Math.min(30000, Math.floor(reconnectDelay * 1.5));
      connect();
    }, reconnectDelay);
  };

  function connect() {
    ws = new WebSocket(url);
    ws.onopen = () => {
      reconnectAttempts = 0;
      reconnectDelay = 1000;
      console.info('Connected to anomalies WS');
      try {
        // envoyer la subscription initiale précisant les rôles (ex: ['CHEF_LIGNE'])
        ws.send(JSON.stringify({ type: 'subscribe', roles }));
      } catch (e) {}
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        onMessage && onMessage(data);
        // Si c'est une anomalie, déclencher un événement global et une notification native
        try {
          if (data && data.type === 'anomaly') {
            // dispatch in-app event so any page (ex: Checklist) can listen
            try { window.dispatchEvent(new CustomEvent('anomaly:received', { detail: data })); } catch (e) {}

            // Native desktop notification (localhost allowed)
            try {
              if (typeof Notification !== 'undefined') {
                if (Notification.permission === 'granted') {
                  new Notification('Anomalie détectée', {
                    body: `Checklist ${data.checklistId} — score ${data.score_final}`,
                    data,
                  });
                } else if (Notification.permission !== 'denied') {
                  Notification.requestPermission().then((perm) => {
                    if (perm === 'granted') {
                      new Notification('Anomalie détectée', {
                        body: `Checklist ${data.checklistId} — score ${data.score_final}`,
                        data,
                      });
                    }
                  }).catch(() => {});
                }
              }
            } catch (e) {
              // ignore notification errors
            }
          }
        } catch (e) {}
      } catch (e) {
        console.warn('Invalid WS message', e);
      }
    };
    ws.onclose = () => {
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws.close();
    };
  }

  connect();

  return {
    close: () => {
      intentionallyClosed = true;
      try { ws && ws.close(); } catch (e) {}
    },
  };
}

export const sendLabel = (checklistId, label, opts = {}) => {
  const { reviewerId = null, comment = null, baseUrl = 'http://localhost:8000' } = opts;
  return api.post(`${baseUrl}/label`, { checklistId, label, reviewerId, comment });
};

// Assistant IA métier
export const askAssistant = (question) => api.post('/assistant/chat', { question });