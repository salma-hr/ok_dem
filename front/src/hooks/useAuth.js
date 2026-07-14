import { useMemo } from 'react';

export function useAuth() {
  const rawUser = localStorage.getItem('user');
  let storedUser = null;
  try {
    storedUser = rawUser ? JSON.parse(rawUser) : null;
  } catch {
    storedUser = null;
  }

  const token = localStorage.getItem('token');
  const role = storedUser?.role || localStorage.getItem('role');
  const nom = storedUser?.nom || localStorage.getItem('nom');
  const matricule = storedUser?.matricule || localStorage.getItem('matricule');
  const idValue = storedUser?.id ?? localStorage.getItem('id');

  const roles = useMemo(() => ({
    isAdmin: role === 'ADMIN',
    isAdminPlant: role === 'ADMIN_PLANT',
    isPPO: role === 'PPO',
    isChefLigne: role === 'CHEF_LIGNE',
    isTechnicien: role === 'TECHNICIEN',
    isAgentQualite: role === 'AGENT_QUALITE',
    isOperateur: role === 'OPERATEUR',
  }), [role]);

  return { token, role, nom, matricule, id: idValue ? parseInt(idValue, 10) : null, ...roles };
}