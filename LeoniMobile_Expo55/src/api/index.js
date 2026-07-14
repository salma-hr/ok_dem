import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = "http://192.168.100.9:8080/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

const PUBLIC_ROUTES = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

// Attach token
api.interceptors.request.use(async (config) => {
  const isPublic = PUBLIC_ROUTES.some((r) => config.url?.includes(r));
  if (!isPublic) {
    const token = await AsyncStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Auth ─────────────────────────────────────────
export const loginApi = (matricule, password) =>
  api.post('/auth/login', { matricule, password });

// ── Profile ──────────────────────────────────────
export const getMonProfil = () => api.get('/utilisateurs/me');

// ── Processus ────────────────────────────────────
export const getAllProcessus = () => api.get('/processus');

// ── Critères ─────────────────────────────────────
export const getCriteresByProcessus = (processusId) =>
  api.get(`/criteres/processus/${processusId}`);

// ── Checklists ───────────────────────────────────
export const getAllChecklists = () => api.get('/checklists');

export const verifierEtatChecklist = (operateurId, machineId, session, date) =>
  api.get('/checklists/etat', {
    params: {
      operateurId,
      ...(machineId != null ? { machineId } : {}),
      session,
      date,
    },
  });

export const soumettreChecklist = (payload) =>
  api.post('/checklists/soumettre', payload);  

export const getChecklistById = (id) => api.get(`/checklists/${id}`);

export default api;
