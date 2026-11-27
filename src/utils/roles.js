/**
 * Shared frontend role helpers aligned with backend/services/accessControlService.js.
 */

export function isAdminUser(user) {
  return user?.is_admin === true;
}

export function isCashierUser(user) {
  return user?.role === 'cashier';
}

export function isAuthorizerUser(user) {
  return Boolean(user && (user.role === 'authorizer' || user.is_approver === true));
}

export function isHodUser(user) {
  return user?.role === 'hod';
}

/**
 * Users with company-wide access (Admins, Cashiers, Authorizers, Managed Approvers).
 */
export function canViewAllCompany(user) {
  return Boolean(user && (isAdminUser(user) || isCashierUser(user) || isAuthorizerUser(user)));
}

/**
 * Users who can access approval workflows (/approvals).
 */
export function canAccessApprovals(user) {
  return Boolean(canViewAllCompany(user) || isHodUser(user));
}
