const JWT_FORMAT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function normalizeStoredToken(rawToken) {
  if (typeof rawToken !== "string") return null;

  let token = rawToken.trim();
  if (!token) return null;

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  if (token.toLowerCase().startsWith("bearer ")) {
    token = token.slice(7).trim();
  }

  return token || null;
}

export function isJwtFormat(token) {
  return typeof token === "string" && JWT_FORMAT.test(token);
}

function parseJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return payload.exp * 1000 - 30_000 <= Date.now();
}

export function clearAuthStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getUsableStoredToken() {
  const normalized = normalizeStoredToken(localStorage.getItem("token"));

  if (!normalized || !isJwtFormat(normalized) || isTokenExpired(normalized)) {
    clearAuthStorage();
    return null;
  }

  return normalized;
}
