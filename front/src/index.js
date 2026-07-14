import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';        
import { AuthProvider } from './context/AuthContext'; 
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { SettingsProvider } from "./pages/Settingscontext";


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <I18nProvider>
      <SettingsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SettingsProvider>
    </I18nProvider>
  </React.StrictMode>
);

