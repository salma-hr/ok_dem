import { createContext, useContext, useState } from "react";

const OperateurSessionContext = createContext(null);

export function OperateurSessionProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  return (
    <OperateurSessionContext.Provider value={{ activeSession, setActiveSession }}>
      {children}
    </OperateurSessionContext.Provider>
  );
}

export function useOperateurSession() {
  return useContext(OperateurSessionContext);
}