import React, { createContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
