import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import IOUList from './pages/IOUList';
import IOUCreate from './pages/IOUCreate';
import IOUDetail from './pages/IOUDetail';
import Approvals from './pages/Approvals';
import AdminApprovers from './pages/AdminApprovers';
import AdminUsers from './pages/AdminUsers';
import AuditLogs from './pages/AuditLogs';
import RedeemedRequests from './pages/RedeemedRequests';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import RoleProtected from './components/RoleProtected';

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="ious" element={<IOUList />} />
        <Route path="ious/create" element={<IOUCreate />} />
        <Route path="ious/:id" element={<IOUDetail />} />
        <Route path="approvals" element={
          <RoleProtected roles={['cashier', 'hod', 'authorizer']} allowApprover={true}>
            <Approvals />
          </RoleProtected>
        } />
        <Route path="redeemed" element={
          <RoleProtected roles={['admin', 'cashier']} allowApprover={true}>
            <RedeemedRequests />
          </RoleProtected>
        } />

        <Route path="admin/approvers" element={
          <RoleProtected roles={['admin', 'cashier']}>
            <AdminApprovers />
          </RoleProtected>
        } />

        <Route path="admin/users" element={
          <RoleProtected roles={['admin', 'cashier']}>
            <AdminUsers />
          </RoleProtected>
        } />

        <Route path="admin/audit-logs" element={
          <RoleProtected roles={['admin']}>
            <AuditLogs />
          </RoleProtected>
        } />

        <Route path="admin/settings" element={
          <RoleProtected roles={['admin']}>
            <Settings />
          </RoleProtected>
        } />

      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
