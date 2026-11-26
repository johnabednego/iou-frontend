import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getInactivityTimeout } from '../services/iouService';
import api from '../services/api';
import { toast as toastify } from 'react-toastify';

const WARNING_SECONDS = 60;

export default function InactivityMonitor({ onLogout }) {
  const [timeoutMinutes, setTimeoutMinutes] = useState(5);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);
  const [extending, setExtending] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const warningDeadlineRef = useRef(null);
  const showWarningRef = useRef(false);
  const loggingOutRef = useRef(false);
  const lastConfigFetchRef = useRef(0);

  const loadTimeoutSetting = useCallback(async () => {
    const now = Date.now();
    if (now - lastConfigFetchRef.current < 15000) return;
    lastConfigFetchRef.current = now;
    try {
      const res = await getInactivityTimeout();
      const mins = parseInt(res.data?.timeout_minutes, 10);
      if (!isNaN(mins) && mins >= 1) {
        setTimeoutMinutes(mins);
      }
    } catch (_) {
      // Fall back to default 5 minutes
    }
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    loggingOutRef.current = false;
    loadTimeoutSetting();

    const handleSettingUpdated = (e) => {
      const mins = parseInt(e?.detail?.timeout_minutes, 10);
      if (!isNaN(mins) && mins >= 1) {
        setTimeoutMinutes(mins);
        lastActivityRef.current = Date.now();
      } else {
        lastConfigFetchRef.current = 0;
        loadTimeoutSetting();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTimeoutSetting();
      }
    };

    window.addEventListener('inactivity-timeout-updated', handleSettingUpdated);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('inactivity-timeout-updated', handleSettingUpdated);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadTimeoutSetting]);

  useEffect(() => {
    showWarningRef.current = showWarning;
  }, [showWarning]);

  // Reset activity timestamp when timeoutMinutes setting changes so it doesn't trigger unexpectedly
  useEffect(() => {
    if (!showWarningRef.current) {
      lastActivityRef.current = Date.now();
    }
  }, [timeoutMinutes]);

  const triggerAutoLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    showWarningRef.current = false;
    setShowWarning(false);
    toastify.info('You were logged out due to inactivity.');
    try {
      await onLogout('inactivity');
    } catch (_) {
      // ignore
    }
  }, [onLogout]);

  useEffect(() => {
    const recordActivity = () => {
      // Do not dismiss the warning modal on passive movement; require explicit click to extend
      if (showWarningRef.current || loggingOutRef.current) return;
      const now = Date.now();
      if (now - lastActivityRef.current > 250) {
        lastActivityRef.current = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'wheel'];
    events.forEach(ev => window.addEventListener(ev, recordActivity, { passive: true }));

    const intervalId = setInterval(() => {
      if (loggingOutRef.current) return;
      const now = Date.now();
      const idleLimitMs = timeoutMinutes * 60 * 1000;

      if (!showWarningRef.current) {
        const elapsed = now - lastActivityRef.current;
        if (elapsed >= idleLimitMs) {
          const deadline = lastActivityRef.current + idleLimitMs + WARNING_SECONDS * 1000;
          if (now >= deadline) {
            triggerAutoLogout();
            return;
          }
          warningDeadlineRef.current = deadline;
          showWarningRef.current = true;
          setShowWarning(true);
          setSecondsLeft(Math.max(1, Math.ceil((deadline - now) / 1000)));
        }
      } else {
        const deadline = warningDeadlineRef.current || (now + WARNING_SECONDS * 1000);
        const remainingMs = deadline - now;
        const sec = Math.max(0, Math.ceil(remainingMs / 1000));
        setSecondsLeft(sec);
        if (remainingMs <= 0) {
          triggerAutoLogout();
        }
      }
    }, 500);

    return () => {
      events.forEach(ev => window.removeEventListener(ev, recordActivity));
      clearInterval(intervalId);
    };
  }, [timeoutMinutes, triggerAutoLogout]);

  async function handleExtendSession() {
    setExtending(true);
    try {
      await api.get('/users/me');
    } catch (_) {
      // Interceptor will redirect on 401 if session expired server-side
    } finally {
      setExtending(false);
    }
    lastActivityRef.current = Date.now();
    warningDeadlineRef.current = null;
    showWarningRef.current = false;
    setShowWarning(false);
    setSecondsLeft(WARNING_SECONDS);
    toastify.success('Session extended.');
  }

  async function handleLogoutNow() {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    showWarningRef.current = false;
    setShowWarning(false);
    await onLogout('manual');
  }

  if (!showWarning) return null;

  const minsDisplay = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secsDisplay = String(secondsLeft % 60).padStart(2, '0');
  const pct = Math.max(0, Math.min(100, (secondsLeft / WARNING_SECONDS) * 100));

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-100">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Session Timeout Warning</h3>
            <p className="text-sm text-slate-600 mt-0.5">
              You have been inactive for {timeoutMinutes} {timeoutMinutes === 1 ? 'minute' : 'minutes'}.
              Please extend your session to keep working, otherwise you will be automatically logged out.
            </p>
          </div>
        </div>

        <div className="my-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
            Logging out in
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-700">
            {minsDisplay}:{secsDisplay}
          </div>
          <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden mt-3">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleLogoutNow}
            disabled={extending}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
          >
            Logout Now
          </button>
          <button
            type="button"
            onClick={handleExtendSession}
            disabled={extending}
            autoFocus
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold shadow-md hover:from-blue-700 hover:to-indigo-800 transition disabled:opacity-50"
          >
            {extending ? 'Extending...' : 'Extend Session'}
          </button>
        </div>
      </div>
    </div>
  );
}
