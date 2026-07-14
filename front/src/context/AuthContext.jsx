import { createContext, useContext, useState, useEffect } from "react";
import {
  clearAuthStorage,
  getUsableStoredToken,
  isJwtFormat,
  isTokenExpired,
  normalizeStoredToken,
} from "../utils/authToken";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const token = getUsableStoredToken();
    if (!token) return null;

    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      clearAuthStorage();
      return null;
    }
  });

  const login = (data) => {
    const token = normalizeStoredToken(data?.token);
    if (!token || !isJwtFormat(token) || isTokenExpired(token)) {
      clearAuthStorage();
      setUser(null);
      return;
    }

    const siteId = data?.siteId ?? data?.site?.id ?? null;
    const siteNom = data?.siteNom ?? data?.site?.nom ?? "";
    const plantId = data?.plantId ?? data?.plant?.id ?? null;
    const plantNom = data?.plantNom ?? data?.plant?.nom ?? "";
    const segmentId = data?.segmentId ?? data?.segment?.id ?? null;
    const segmentNom = data?.segmentNom ?? data?.segment?.nom ?? "";
    const processusId = data?.processusId ?? data?.processus?.id ?? null;
    const processusNom = data?.processusNom ?? data?.processus?.nom ?? "";

    const u = {
      id:        data.id,
      nom:       data.nom,
      matricule: data.matricule,
      role:      data.role,
      email:     data.email,
      siteId,
      siteNom,
      plantId,
      plantNom,
      segmentId,
      segmentNom,
      processusId,
      processusNom,
      ...(siteId ? { site: { id: siteId, nom: siteNom } } : {}),
      ...(plantId ? { plant: { id: plantId, nom: plantNom } } : {}),
      ...(segmentId ? { segment: { id: segmentId, nom: segmentNom } } : {}),
      ...(processusId ? { processus: { id: processusId, nom: processusNom } } : {}),
    };
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
  };

  // ✅ Écoute l'événement déclenché par l'intercepteur axios quand un 401 est reçu.
  // Au lieu d'un rechargement brutal (window.location.href), on met user=null ici,
  // ce qui déclenche PrivateRoute → <Navigate to="/login" /> proprement (SPA, sans flash).
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuthStorage();
      setUser(null);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);