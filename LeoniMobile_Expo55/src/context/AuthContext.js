import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

const isJwt = (token) => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(token || '');

function isExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp && payload.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
        ]);
        if (savedToken && isJwt(savedToken) && !isExpired(savedToken) && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const login = async (data) => {
    console.log('[AUTH] login data recu:', JSON.stringify(data, null, 2));
    const rawToken = data?.token;
    if (!rawToken || !isJwt(rawToken) || isExpired(rawToken)) {
      await AsyncStorage.multiRemove(['token', 'user']);
      setUser(null); setToken(null);
      return;
    }

    const siteId       = data?.siteId      ?? data?.site?.id      ?? null;
    const siteNom      = data?.siteNom     ?? data?.site?.nom     ?? '';
    const plantId      = data?.plantId     ?? data?.plant?.id     ?? null;
    const plantNom     = data?.plantNom    ?? data?.plant?.nom    ?? '';
    const segmentId    = data?.segmentId   ?? data?.segment?.id   ?? null;
    const segmentNom   = data?.segmentNom  ?? data?.segment?.nom  ?? '';
    const processusId  = data?.processusId ?? data?.processus?.id ?? null;
    const processusNom = data?.processusNom ?? data?.processus?.nom ?? '';

    const u = {
      id:        data.id,
      nom:       data.nom,
      matricule: data.matricule,
      role:      data.role,
      email:     data.email,
      siteId, siteNom, plantId, plantNom,
      segmentId, segmentNom, processusId, processusNom,
    };

    await AsyncStorage.setItem('token', rawToken);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(rawToken);
    setUser(u);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
