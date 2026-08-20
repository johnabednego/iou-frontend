import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function RoleProtected({ children, roles, allowApprover = false }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.is_admin) return children;
  if (allowApprover && user.is_approver) return children;
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(user.role)) return <Navigate to="/" />;
  return children;
}
