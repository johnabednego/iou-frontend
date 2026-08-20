// src/components/layouts/MainLayout.jsx
import React, { useContext, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import NotificationsDropdown from '../NotificationsDropdown';
import { AuthContext } from '../../contexts/AuthContext';
import mpsLogo from '../../assets/mps.svg';

const NavItem = ({ to, label, show = true, isActive, onClick }) => {
  if (!show) return null;

  if (isActive) {
    return (
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 animate-spin-gradient bg-[conic-gradient(from_0deg,rgba(59,130,246,0.5),rgba(255,255,255,0.6),rgba(59,130,246,0.7))]" />
        <div className="relative m-[1.5px] flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/10">
          <span className="text-sm font-semibold text-[#10306c]">{label}</span>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-md text-white/90 hover:bg-white/10 hover:text-[#242220] transition-colors"
    >
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
};

export default function MainLayout() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const pathname = location.pathname || '/';
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActivePath = (path) => {
    if (path === '/') return pathname === '/';
    if (pathname === '/ious/create') return pathname === path;
    return pathname === path || pathname.startsWith(path + '/');
  };

  const showDashboardHeader = pathname === '/';
  const closeSidebar = () => setSidebarOpen(false);

  const isCashierOrAdmin = user?.is_admin || user?.role === 'cashier';
  const isApprover = user?.is_approver === true;
  const canSeeApprovals = isCashierOrAdmin || isApprover || user?.role === 'hod';
  const canSeeRedeemed = isCashierOrAdmin || isApprover;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 mb-8">
        <img src={mpsLogo} alt="mps logo" className="w-12 h-12 object-contain bg-white rounded-full" />
        <div>
          <h1 className="text-xl font-semibold">IOU Manager</h1>
          <p className="text-sm opacity-80">Petty Cash</p>
        </div>
      </div>

      <nav className="space-y-2" aria-label="Main navigation">
        <NavItem to="/" label="Dashboard" isActive={isActivePath('/')} onClick={closeSidebar} />
        <NavItem to="/ious" label="My Requests" isActive={isActivePath('/ious')} onClick={closeSidebar} />
        <NavItem to="/ious/create" label="Request IOU" isActive={isActivePath('/ious/create')} onClick={closeSidebar} />
        <NavItem to="/approvals" label="Approvals" show={canSeeApprovals} isActive={isActivePath('/approvals')} onClick={closeSidebar} />
        <NavItem to="/redeemed" label="IFS Vouchers" show={canSeeRedeemed} isActive={isActivePath('/redeemed')} onClick={closeSidebar} />
        {/* admin & cashier links */}
        <NavItem to="/admin/approvers" label="Approvers" show={user?.is_admin} isActive={isActivePath('/admin/approvers')} onClick={closeSidebar} />
        <NavItem to="/admin/users" label="Users" show={user?.is_admin} isActive={isActivePath('/admin/users')} onClick={closeSidebar} />
        <NavItem to="/admin/audit-logs" label="Audit Logs" show={user?.is_admin} isActive={isActivePath('/admin/audit-logs')} onClick={closeSidebar} />
        <NavItem to="/admin/settings" label="Settings" show={user?.is_admin} isActive={isActivePath('/admin/settings')} onClick={closeSidebar} />
      </nav>

      <div className="mt-8 text-sm text-white/80">
        <p>
          Logged in as <strong>{user?.display_name || user?.username}</strong>
        </p>
        <p className="mt-2">
          Role: <span className="font-medium capitalize">{user?.role}</span>
        </p>
        <p className="mt-1">
          Department: <span className="font-medium">{user?.department || '-'}</span>
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex relative">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar - Desktop: always visible; Mobile: slide-out drawer 
        bg-gradient-to-b from-[#242220] to-indigo-900
      bg-gradient-to-b from-[#1F88E5] to-indigo-900  */}

      <aside
        className={`
          fixed lg:sticky top-0 left-0 h-screen w-72 p-6
          bg-gradient-to-b from-[#1F88E5] to-indigo-900 text-white
          rounded-r-xl shadow-lg z-50
          transform transition-transform duration-300 ease-in-out
          lg:transform-none lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          overflow-y-auto
        `}
      >
        {/* Close button for mobile */}
        <button
          className="absolute top-4 right-4 text-white/70 hover:text-white text-xl lg:hidden"
          onClick={closeSidebar}
        >
          ✕
        </button>
        {sidebarContent}
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              className="lg:hidden p-2 rounded-lg bg-white/90 shadow-sm hover:bg-white transition"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {showDashboardHeader && (
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
                <p className="text-sm text-slate-600 hidden sm:block">Overview and quick actions.</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationsDropdown />
            <button onClick={() => logout()} className="px-3 py-2 rounded-lg bg-white/90 shadow-sm text-sm">
              Logout
            </button>
          </div>
        </header>

        <div className="space-y-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
