import React, { createContext, useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const nav = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  // Flag to suppress 401 redirect during SSO handshake
  const ssoInProgress = useRef(false);

  useEffect(() => {
    (async () => {
      // 1. Check for SSO token in URL (?token=...)
      const params = new URLSearchParams(window.location.search);
      const ssoToken = params.get('token');

      if (ssoToken) {
        ssoInProgress.current = true;
        try {
          const res = await api.post('/auth/sso-login', { token: ssoToken });
          if (res.data && res.data.user) {
            setUser(res.data.user);
            // Clean the token from the URL to prevent leaking via browser history
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            nav('/', { replace: true });
            return;
          }
        } catch (err) {
          console.error('SSO login failed:', err?.response?.data?.message || err.message);
          // SSO failed — fall through to normal session check or show login
        } finally {
          ssoInProgress.current = false;
          setLoading(false);
        }
      }

      // 2. Normal session check
      try {
        const res = await api.get('/users/me');
        setUser(res.data.user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(username, password) {
    // backend LDAP login: /auth/login
    const res = await api.post('/auth/login', { username, password });
    // fetch DB user
    const me = await api.get('/users/me');
    setUser(me.data.user);
    return me.data.user;
  }

  async function logout() {
    try {
      await api.get('/auth/logout');
    } catch (e) { /* ignore */ }
    setUser(null);
    nav('/login');
  }

  // Expose ssoInProgress so the API interceptor can check it
  window.__iou_sso_in_progress = ssoInProgress;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
