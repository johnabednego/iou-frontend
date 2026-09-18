import api from './api';

// IOU CRUD
export const createIOU = (data) => api.post('/ious', data);
export const listIOUs = (params) => api.get('/ious', { params });
export const getIOU = (id) => api.get(`/ious/${id}`);
export const updateIOU = (id, data) => api.put(`/ious/${id}`, data);
export const submitIOU = (id) => api.post(`/ious/${id}/submit`);
export const assignApprovers = (id, approvers) => api.post(`/ious/${id}/assign-approvers`, { approvers });
export const confirmApproval = (id) => api.post(`/ious/${id}/confirm-approval`);

// Disbursement
export const disburseIOU = (id, data) => api.post(`/ious/${id}/disburse`, data);
export const confirmDisbursement = (id) => api.post(`/ious/${id}/confirm-disbursement`);
export const getDisbursements = (id) => api.get(`/ious/${id}/disbursements`);

// Expense
export const submitExpense = (id, data) => api.post(`/ious/${id}/expense`, data);
export const getExpense = (id) => api.get(`/ious/${id}/expense`);
export const updateExpense = (id, data) => api.put(`/ious/${id}/expense`, data);
export const rejectExpense = (id, data) => api.post(`/ious/${id}/expense/reject`, data);

// Expense Approval
export const assignExpenseApprovers = (id, approvers) => api.post(`/ious/${id}/expense/assign-approvers`, { approvers });
export const decideExpenseApproval = (iouId, approvalId, data) => api.put(`/ious/${iouId}/expense/approve/${approvalId}`, data);

// Reconciliation
export const reconcileIOU = (id, data) => api.post(`/ious/${id}/reconcile`, data);

// Redemption
export const redeemIOU = (id, data) => api.post(`/ious/${id}/redeem`, data);

// Managed Approvers List
export const listApprovers = () => api.get('/users/approvers');
export const addApprover = (userId) => api.post('/users/approvers', { user_id: userId });
export const removeApprover = (userId) => api.delete(`/users/approvers/${userId}`);

// Users
export const getUsers = (params) => api.get('/users', { params });
export const updateUserRole = (id, data) => api.put(`/users/${id}/role`, data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const addUserByEmail = (data) => api.post('/users/add-by-email', data);

// Departments
export const getDepartments = (params) => api.get('/departments', { params });
export const getDepartment = (id) => api.get(`/departments/${id}`);
export const createDepartment = (data) => api.post('/departments', data);
export const updateDepartment = (id, data) => api.put(`/departments/${id}`, data);
export const deleteDepartment = (id) => api.delete(`/departments/${id}`);
export const mergeDepartments = (data) => api.post('/departments/merge', data);

// Approvals
export const getMyApprovals = () => api.get('/approvals/mine');
export const decideApproval = (id, data) => api.put(`/approvals/${id}`, data);

// Audit Logs
export const getAuditLogs = (params) => api.get('/audit-logs', { params });

// Cashier pre-approval actions (at PENDING_HOD_ASSIGNMENT stage)
export const cashierRejectIOU = (id, data) => api.post(`/ious/${id}/cashier-reject`, data);
export const cashierReturnIOU = (id, data) => api.post(`/ious/${id}/cashier-return`, data);

// Settings
export const getDateLimit = () => api.get('/settings/date-limit');
export const setDateLimit = (min_date) => api.put('/settings/date-limit', { min_date });

// Export (returns download URL string for use with window.open or anchor)
export const getExportUrl = (params = {}) => {
  const baseUrl = api.defaults.baseURL || '';
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.start_date) qs.set('start_date', params.start_date);
  if (params.end_date) qs.set('end_date', params.end_date);
  const queryStr = qs.toString();
  return `${baseUrl}/ious/export${queryStr ? '?' + queryStr : ''}`;
};

// Export via fetch (for proper auth cookie handling)
export const exportIOUs = (params = {}) => api.get('/ious/export', {
  params,
  responseType: 'blob'
});

// Currencies
export const getCurrencies = (params) => api.get('/currencies', { params });
export const addCurrency = (data) => api.post('/currencies', data);
export const updateCurrency = (id, data) => api.put(`/currencies/${id}`, data);
export const deleteCurrency = (id) => api.delete(`/currencies/${id}`);

// Fund Management
export const getFundBalances = () => api.get('/funds');
export const updateFundBalance = (currency, data) => api.put(`/funds/${currency}`, data);
export const checkFunds = (currency, amount) => api.get(`/funds/check/${currency}/${amount}`);
export const getFundTransactions = (params) => api.get('/funds/transactions', { params });

// Analytics
export const getDashboardAnalytics = (params) => api.get('/analytics/dashboard', { params });
