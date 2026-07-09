// Helper central de chamadas à API com token JWT do admin.
const TOKEN_KEY = 'nfse_token';
const USER_KEY = 'nfse_user';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => localStorage.getItem(USER_KEY);
export function setAuth(token, username) {
  if (token) { localStorage.setItem(TOKEN_KEY, token); if (username) localStorage.setItem(USER_KEY, username); }
  else { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
}
export const logout = () => { setAuth(null); window.dispatchEvent(new Event('nfse-unauth')); };

export async function apiFetch(url, opts = {}) {
  url = API_BASE + url;
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (opts.body && !(opts.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401) { setAuth(null); window.dispatchEvent(new Event('nfse-unauth')); }
  return res;
}

// JSON helper que já lança erro com a mensagem do backend.
export async function apiJson(url, opts = {}) {
  const res = await apiFetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro na requisição.');
  return data;
}

// URL do PDF com token na query (para abrir em nova aba via window.open).
export const pdfHref = (notaId) => `${API_BASE}/api/rps/${notaId}/pdf?token=${encodeURIComponent(getToken() || '')}`;
