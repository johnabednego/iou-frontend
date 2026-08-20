import api from './api';

/**
 * Fetch notifications - returns { items, unreadCount }
 * Single API call to reduce DB connection pressure
 */
export async function fetchNotifications({ limit = 20 } = {}) {
  const res = await api.get('/notifications', { params: { limit } });
  const items = res.data.data || [];
  const unreadCount = items.filter(n => !n.is_read).length;
  return { items, unreadCount };
}

export async function markRead(id) {
  const res = await api.put(`/notifications/${id}/read`);
  return res.data;
}
