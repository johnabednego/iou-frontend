// src/components/ui/ConfirmModal.jsx
import React, { useEffect, useRef } from 'react';

/**
 * Premium confirmation/alert modal.
 * 
 * Props:
 * - open (boolean): whether modal is visible
 * - onClose (() => void): called when user dismisses
 * - onConfirm (() => void): called when user confirms (confirm mode only)
 * - title (string): modal title
 * - message (string|ReactNode): modal body
 * - confirmText (string): confirm button label (default "Confirm")
 * - cancelText (string): cancel button label (default "Cancel")
 * - variant ('danger' | 'warning' | 'info' | 'success'): icon & color theme
 * - mode ('confirm' | 'alert'): confirm shows 2 buttons, alert shows 1
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  mode = 'confirm'
}) {
  const confirmRef = useRef(null);
  const overlayRef = useRef(null);

  // Focus management & escape key
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    setTimeout(() => confirmRef.current?.focus(), 50);

    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKey);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const variants = {
    danger: {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      bg: 'bg-red-50',
      ring: 'ring-red-100',
      iconBg: 'bg-red-100',
      btnClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
      titleColor: 'text-red-800'
    },
    warning: {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      bg: 'bg-amber-50',
      ring: 'ring-amber-100',
      iconBg: 'bg-amber-100',
      btnClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-300',
      titleColor: 'text-amber-800'
    },
    info: {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      ),
      bg: 'bg-blue-50',
      ring: 'ring-blue-100',
      iconBg: 'bg-blue-100',
      btnClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300',
      titleColor: 'text-blue-800'
    },
    success: {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-100',
      iconBg: 'bg-emerald-100',
      btnClass: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-300',
      titleColor: 'text-emerald-800'
    }
  };

  const v = variants[variant] || variants.warning;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`
          relative w-full max-w-md rounded-2xl shadow-2xl border
          ${v.bg} ${v.ring} ring-1
          transform transition-all duration-200
          animate-modal-in
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="p-6">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full ${v.iconBg} flex items-center justify-center mx-auto mb-4`}>
            {v.icon}
          </div>

          {/* Title */}
          <h3 id="modal-title" className={`text-lg font-bold text-center ${v.titleColor} mb-2`}>
            {title}
          </h3>

          {/* Message */}
          <div className="text-sm text-slate-600 text-center leading-relaxed mb-6">
            {message}
          </div>

          {/* Buttons */}
          <div className={`flex gap-3 ${mode === 'alert' ? 'justify-center' : 'justify-end'}`}>
            {mode === 'confirm' && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {cancelText}
              </button>
            )}
            <button
              ref={confirmRef}
              onClick={() => {
                if (mode === 'confirm') onConfirm?.();
                else onClose?.();
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });

              }}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all focus:outline-none focus:ring-2 shadow-sm hover:shadow-md ${v.btnClass}`}
            >
              {mode === 'alert' ? (cancelText === 'Cancel' ? 'OK' : cancelText) : confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { 
          from { opacity: 0; transform: scale(0.9) translateY(10px); } 
          to { opacity: 1; transform: scale(1) translateY(0); } 
        }
        .animate-fade-in { animation: fadeIn 0.15s ease-out; }
        .animate-modal-in { animation: modalIn 0.2s ease-out; }
      `}</style>
    </div>
  );
}
