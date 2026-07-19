import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OperateurSessionProvider } from "./components/Operateursessioncontext";
import PrivateRoute from "./components/PrivateRoute";
import { I18nProvider } from "./context/I18nContext";
import Layout                 from './components/Layout/Layout';
import LoginPage              from "./pages/LoginPage";
import RegisterPage           from "./pages/RegisterPage";
import ForgotPasswordPage     from "./pages/ForgotPasswordPage";
import ResetPasswordPage      from "./pages/ResetPasswordPage";
import UtilisateursPage       from "./pages/admin/UtilisateursPage";
import PlantsPage             from "./pages/admin/PlantsPage";
import SegmentsPage           from "./pages/admin/SegmentsPage";
import SitesPage              from "./pages/admin/SitesPage";
import ProfilePage            from "./pages/MonProfil";
import ProcessusPage          from "./pages/sprint2/ProcessusPage";
import CriteresPage           from "./pages/sprint2/CriteresPage";
import ChecklistPage          from "./pages/sprint2/ChecklistPage";
import OperateurChecklistPage        from "./pages/sprint2/OperateurChecklistPage";
import OperateurChecklistConsultPage from "./pages/sprint2/OperateurChecklistConsultPage";
import OperateursLtpmPage            from "./pages/sprint2/OperateursLtpmPage";
import LtpmFlagDisplayPage           from "./pages/sprint2/LtpmFlagDisplayPage";
import NotificationsPage      from "./components/NotificationBell";
import MachinesPage           from "./pages/sprint2/MachinesPage";
import './styles/theme.css';
import './styles/mockup-design-system.css';
import { useI18n } from "./context/I18nContext";
import DashboardAdvanced  from './components/Dashboard/DashboardAdvanced';
import DashboardChefLigne from './components/Dashboard/DashboardChefLigne';
import DashboardTechnicien from './components/Dashboard/DashboardTechnicien';
import DashboardAgentQualite from './components/Dashboard/DashboardAgentQualite';
import QualityManagementPage from "./pages/QualityManagementSystem.jsx";
import DashboardRouter from "./pages/DashboardRouter";
export default function App() {
  const { t } = useI18n();
  return (
    <I18nProvider>
      <AuthProvider>
        <OperateurSessionProvider>
          <BrowserRouter>
            <Routes>
              {/* ── Pages publiques (sans Layout) ── */}
              <Route path="/"                element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/register"        element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password"  element={<ResetPasswordPage />} />
              <Route path="/unauthorized"    element={
                <div style={{ padding:40, textAlign:"center" }}>
                  <h2>{t('app.unauthorized.title')}</h2>
                  <p>{t('app.unauthorized.message')}</p>
                </div>
              } />


              <Route path="/dashboard-advanced" element={
                <PrivateRoute><Layout><DashboardAdvanced /></Layout></PrivateRoute>
              } />

              <Route path="/dashboard/chef-ligne" element={
                <PrivateRoute roles={["CHEF_LIGNE","ADMIN"]}><Layout><DashboardChefLigne /></Layout></PrivateRoute>
              } />

              <Route path="/dashboard/technicien" element={
                <PrivateRoute roles={["TECHNICIEN","ADMIN"]}><Layout><DashboardTechnicien /></Layout></PrivateRoute>
              } />

              <Route path="/dashboard/agent-qualite" element={
                <PrivateRoute roles={["AGENT_QUALITE","ADMIN"]}><Layout><DashboardAgentQualite /></Layout></PrivateRoute>
              } />

              <Route path="/dashboard/ppo" element={
                <PrivateRoute roles={["PPO","ADMIN"]}><Layout><DashboardAdvanced /></Layout></PrivateRoute>
              } />

              {/* ── Admin ── */}
              <Route path="/admin/utilisateurs" element={
                <PrivateRoute roles={["ADMIN","ADMIN_PLANT","CHEF_LIGNE"]}><Layout><UtilisateursPage /></Layout></PrivateRoute>
              } />
              <Route path="/utilisateurs" element={
                <PrivateRoute roles={["ADMIN","ADMIN_PLANT","CHEF_LIGNE"]}><Layout><UtilisateursPage /></Layout></PrivateRoute>
              } />
             

            

              {/* ✅ Profil — accessible à tous les rôles connectés */}
              <Route path="/profil" element={
                <PrivateRoute><Layout><ProfilePage /></Layout></PrivateRoute>
              } />

              {/* ── Configuration ── */}
              <Route path="/segments" element={
                <PrivateRoute roles={["ADMIN","ADMIN_PLANT"]}><Layout><SegmentsPage /></Layout></PrivateRoute>
              } />
              <Route path="/plants" element={
                <PrivateRoute roles={["ADMIN", "ADMIN_PLANT", "PPO"]}><Layout><PlantsPage /></Layout></PrivateRoute>
              } />
              <Route path="/sites" element={
                <PrivateRoute roles={["ADMIN", "ADMIN_PLANT", "PPO"]}><Layout><SitesPage /></Layout></PrivateRoute>
              } />

              {/* ── Métier ── */}
              <Route path="/processus" element={
                <PrivateRoute roles={["PPO","ADMIN","ADMIN_PLANT"]}><Layout><ProcessusPage /></Layout></PrivateRoute>
              } />
              <Route path="/machines" element={
                <PrivateRoute roles={["PPO","ADMIN","ADMIN_PLANT"]}><Layout><MachinesPage /></Layout></PrivateRoute>
              } />

              <Route path="/criteres" element={
                <PrivateRoute roles={["PPO","ADMIN","ADMIN_PLANT"]}><Layout><CriteresPage /></Layout></PrivateRoute>
              } />

              {/* ── Checklists ── */}
              <Route path="/checklist" element={
                <PrivateRoute><Layout><ChecklistPage /></Layout></PrivateRoute>
              } />
              <Route path="/checklist/operateur" element={
                <PrivateRoute roles={["OPERATEUR","ADMIN","PPO"]}>
                  <Layout><OperateurChecklistPage /></Layout>
                </PrivateRoute>
              } />
              <Route path="/checklist/operateur/consultation" element={
                <PrivateRoute roles={["OPERATEUR","ADMIN","PPO"]}>
                  <Layout><OperateurChecklistConsultPage /></Layout>
                </PrivateRoute>
              } />
              <Route path="/checklist/operateurs-ltpm" element={
                <PrivateRoute roles={["ADMIN","ADMIN_PLANT","AGENT_QUALITE","TECHNICIEN","CHEF_LIGNE"]}>
                  <Layout><OperateursLtpmPage /></Layout>
                </PrivateRoute>
              } />

              {/* ── Drapeau LTPM plein écran (remplace le drapeau papier) ── */}
              <Route path="/checklist/operateur/drapeau" element={
                <PrivateRoute roles={["OPERATEUR","ADMIN","PPO","CHEF_LIGNE","ADMIN_PLANT"]}>
                  <LtpmFlagDisplayPage />
                </PrivateRoute>
              } />

              {/* ── Sprint 3 — QUALITY MANAGEMENT PAGES ── */}
              <Route path="/non-conformites" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              <Route path="/validation" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              <Route path="/validation/:id" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              <Route path="/plan-actions" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              <Route path="/qualityMangement" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              <Route path="/checklist/non-conformites" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />
              {/* ── Old routes (legacy) ── */}
              <Route path="/validations" element={
                <PrivateRoute><Layout><QualityManagementPage /></Layout></PrivateRoute>
              } />

              <Route path="/notifications" element={
                <PrivateRoute><Layout><NotificationsPage /></Layout></PrivateRoute>
              } />

            </Routes>
          </BrowserRouter>
        </OperateurSessionProvider>
      </AuthProvider>
    </I18nProvider>
  );
}