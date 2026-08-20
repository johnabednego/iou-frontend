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

// Response interceptor: redirect on 401
api.interceptors.response.use(r => r, (err) => {
  if (err?.response?.status === 401 && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export default api;
