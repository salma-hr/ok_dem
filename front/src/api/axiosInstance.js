import axios from "axios";
import { clearAuthStorage, getUsableStoredToken } from "../utils/authToken";

// Backend API base URL (restore to main backend). Change if your Spring backend uses a different port.
const api = axios.create({
  baseURL: "http://localhost:8080/api",
  headers: { "Content-Type": "application/json" },
});


const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password"
];

api.interceptors.request.use((config) => {
  const url = config.url || "";

  // Vérification plus stricte
  const isPublicRoute = PUBLIC_ROUTES.some(route => url.includes(route));

  if (!isPublicRoute) {
    const token = getUsableStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
  }

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];
let isRedirecting = false;

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const onPublicPage = PUBLIC_PATHS.includes(window.location.pathname);

    if (status === 401 && !onPublicPage && !isRedirecting) {
      isRedirecting = true;
      clearAuthStorage();
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      setTimeout(() => { isRedirecting = false; }, 3000);
    }

    return Promise.reject(err);
  }
);

export default api;