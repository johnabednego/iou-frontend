/**
 * Client-side status group matchers matching backend/services/filterService.js.
 * Used for instant, flicker-free filtering when clicking KPI cards or breakdown segments.
 */

export const IOU_STATUS_GROUPS = {
  PENDING_GROUP: ['PENDING', 'PENDING_HOD_ASSIGNMENT'],
  APPROVED_READY_GROUP: ['APPROVED', 'APPROVED_FOR_DISBURSEMENT'],
  AWAITING_ACTION_GROUP: ['PENDING', 'PENDING_HOD_ASSIGNMENT', 'APPROVED', 'APPROVED_FOR_DISBURSEMENT'],
  ACTIVE_DISBURSED_GROUP: [
    'DISBURSED',
    'DISBURSEMENT_CONFIRMED',
    'EXPENSE_SUBMITTED',
    'EXPENSE_PENDING_APPROVAL',
    'EXPENSE_RETURNED'
  ],
  SETTLED_GROUP: ['RECONCILED', 'REDEEMED'],
  IN_PROGRESS_GROUP: [
    'DISBURSED',
    'DISBURSEMENT_CONFIRMED',
    'EXPENSE_PENDING_APPROVAL',
    'EXPENSE_SUBMITTED',
    'EXPENSE_RETURNED',
    'RECONCILED'
  ],
  DRAFT_RETURNED_GROUP: ['DRAFT', 'RETURNED'],
  REJECTED_GROUP: ['REJECTED', 'CANCELLED'],
  APPROVED_GROUP: [
    'APPROVED',
    'APPROVED_FOR_DISBURSEMENT',
    'DISBURSED',
    'DISBURSEMENT_CONFIRMED',
    'EXPENSE_PENDING_APPROVAL',
    'EXPENSE_SUBMITTED',
    'EXPENSE_RETURNED',
    'RECONCILED',
    'REDEEMED'
  ]
};

export const DE_STATUS_GROUPS = {
  PENDING_GROUP: ['PENDING', 'PENDING_HOD_ASSIGNMENT'],
  AWAITING_ACTION_GROUP: ['PENDING', 'PENDING_HOD_ASSIGNMENT', 'APPROVED_FOR_DISBURSEMENT'],
  IN_PROGRESS_GROUP: ['DISBURSED', 'DISBURSEMENT_CONFIRMED'],
  DRAFT_RETURNED_GROUP: ['DRAFT', 'RETURNED'],
  REJECTED_GROUP: ['REJECTED', 'CANCELLED'],
  APPROVED_GROUP: ['APPROVED_FOR_DISBURSEMENT', 'DISBURSED', 'DISBURSEMENT_CONFIRMED', 'COMPLETED']
};

function matchesStatusFilter(itemStatus, filterValue, groupMap) {
  if (!filterValue) return true;
  const raw = String(filterValue).trim().toUpperCase();
  if (!raw) return true;

  const status = String(itemStatus || '').toUpperCase();
  if (groupMap[raw]) {
    return groupMap[raw].includes(status);
  }
  if (raw.includes(',')) {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    return parts.includes(status);
  }
  return status === raw;
}

export function matchesIouStatus(itemStatus, filterValue) {
  return matchesStatusFilter(itemStatus, filterValue, IOU_STATUS_GROUPS);
}

export function matchesDeStatus(itemStatus, filterValue) {
  return matchesStatusFilter(itemStatus, filterValue, DE_STATUS_GROUPS);
}
