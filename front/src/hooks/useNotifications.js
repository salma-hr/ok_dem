import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api/axiosInstance";

const POLL_INTERVAL = 30_000; // 30 secondes

export function useNotifications() {
  const [notifs,      setNotifs]      = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const intervalRef = useRef(null);

  const fetchNotifs = useCallback(async () => {
    try {
      // ✅ skipGlobalErrorHandler: true → un 401 sur /notifications
      // ne déclenche PAS la déconnexion globale de l'utilisateur.
      const res = await api.get("/notifications", { skipGlobalErrorHandler: true });
      const data = Array.isArray(res.data) ? res.data : [];
      setNotifs(data);
      setUnreadCount(data.filter(n => !n.lue).length);
    } catch {
      // Silencieux — ne pas déconnecter ni afficher d'erreur pour les notifs
    }
  }, []);

  // Chargement initial + polling toutes les 30s
  useEffect(() => {
    setLoading(true);
    fetchNotifs().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchNotifs, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifs]);

  const handleMarkOne = useCallback(async (id) => {
    try {
      await api.patch(`/notifications/${id}/lire`, null, { skipGlobalErrorHandler: true });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, lue: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silencieux */ }
  }, []);

  const handleMarkAll = useCallback(async () => {
    try {
      await api.patch("/notifications/lire-tout", null, { skipGlobalErrorHandler: true });
      setNotifs(prev => prev.map(n => ({ ...n, lue: true })));
      setUnreadCount(0);
    } catch { /* silencieux */ }
  }, []);

  // Rafraîchissement manuel (ex: après soumission d'une checklist)
  const refresh = useCallback(() => fetchNotifs(), [fetchNotifs]);

  return { notifs, unreadCount, loading, handleMarkOne, handleMarkAll, refresh };
}