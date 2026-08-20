import React, { useContext, useEffect, useState } from 'react';
import { BellIcon } from '@heroicons/react/24/outline';
import * as notificationService from '../services/notificationService';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function NotificationsDropdown() {
  const { user } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function load() {
    if (!user) return;
    try {
      const { items: rows, unreadCount: count } = await notificationService.fetchNotifications({ limit: 20 });
      setItems(rows);
      setUnreadCount(count);
    } catch (err) {
      // Silently ignore polling errors (DB may be temporarily unavailable)
    }
  }

  useEffect(() => {
    load();
    // Poll every 30 seconds to reduce DB connection pressure
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [user]);

  async function handleOpen(n) {
    try {
      if (!n.is_read) {
        await notificationService.markRead(n.id);
        setItems(s => s.map(it => it.id === n.id ? { ...it, is_read: true } : it));
        setUnreadCount(c => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error(err);
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (!e.target.closest('.notifications-dropdown')) setOpen(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  return (
    <div className="relative notifications-dropdown">
      <button onClick={() => setOpen(!open)} className="p-2 rounded-lg bg-white/90 shadow-sm flex items-center gap-2 hover:bg-white transition">
        <BellIcon className="w-5 h-5 text-slate-700" />
        {unreadCount > 0 && <span className="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{unreadCount}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h4 className="font-semibold text-slate-800">Notifications</h4>
          </div>
          <div className="max-h-96 overflow-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications yet</div>
            ) : items.map(n => (
              <div
                key={n.id}
                onClick={() => handleOpen(n)}
                className={`px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors flex gap-3 ${!n.is_read ? 'bg-blue-50/40' : ''}`}
              >
                {/* Unread indicator */}
                <div className="flex-shrink-0 pt-1.5">
                  {!n.is_read ? (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-transparent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${!n.is_read ? 'font-semibold text-slate-900' : 'font-normal text-slate-600'}`}>{n.title}</div>
                  <div className={`text-xs mt-0.5 ${!n.is_read ? 'text-slate-700' : 'text-slate-400'}`}>{n.body}</div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
