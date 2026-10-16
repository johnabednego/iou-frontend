import axios from 'axios';
import { BASE_URL } from '../config/baseUrl';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

// Response interceptor: redirect on 401 (skip during SSO handshake)
api.interceptors.response.use(r => r, (err) => {
  const isSsoInProgress = window.__iou_sso_in_progress?.current;
  const isSsoEndpoint = err?.config?.url?.includes('/sso-login');
  if (
    err?.response?.status === 401 &&
    !window.location.pathname.includes('/login') &&
    !isSsoInProgress &&
    !isSsoEndpoint
  ) {
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default api;
