import React, { useEffect, useState } from 'react';
import { listApprovers, addApprover, removeApprover, getUsers } from '../services/iouService';
import Card from '../components/ui/Card';
import { toast } from 'react-toastify';

export default function AdminApprovers() {
  const [approvers, setApprovers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Approver Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingAllUsers, setLoadingAllUsers] = useState(false);
  const [userSearchQ, setUserSearchQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adding, setAdding] = useState(false);

  // Remove confirmation state
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchApprovers();
    fetchSystemUsers();
  }, []);

  async function fetchApprovers() {
    setLoading(true);
    try {
      const res = await listApprovers();
      setApprovers(res.data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch approvers list');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSystemUsers() {
    setLoadingAllUsers(true);
    try {
      const res = await getUsers({ limit: 1000, is_active: true, local_only: true });
      setAllUsers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load system users', err);
    } finally {
      setLoadingAllUsers(false);
    }
  }

  // Search LDAP on-demand for users not yet synced to local DB
  async function handleLdapSearch() {
    if (!userSearchQ || userSearchQ.trim().length < 2) {
      toast.info('Enter at least 2 characters to search directory');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await getUsers({ search: userSearchQ.trim(), limit: 20 });
      const found = res.data.data || [];
      if (found.length === 0) {
        toast.info(`No directory users found matching "${userSearchQ}"`);
      } else {
        setAllUsers(prev => {
          const map = new Map(prev.map(u => [u.id, u]));
          found.forEach(u => map.set(u.id, u));
          return Array.from(map.values());
        });
        toast.success(`Found ${found.length} matching user(s) from directory`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Directory search failed');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAddApprover() {
    if (!selectedUser) {
      toast.error('Please select a user to add');
      return;
    }
    setAdding(true);
    try {
      await addApprover(selectedUser.id);
      toast.success(`${selectedUser.display_name || selectedUser.username} added to Approvers list`);
      setShowAddModal(false);
      setSelectedUser(null);
      setUserSearchQ('');
      fetchApprovers();
      fetchSystemUsers();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add approver');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveApprover(userId, name) {
    setRemovingId(userId);
    try {
      await removeApprover(userId);
      toast.success(`${name} removed from Approvers list`);
      setApprovers(s => s.filter(a => a.id !== userId));
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove approver');
    } finally {
      setRemovingId(null);
    }
  }

  const approverIds = new Set(approvers.map(a => a.id));
  const eligibleUsers = allUsers.filter(u => !approverIds.has(u.id));

  const filteredEligible = eligibleUsers.filter(u => {
    if (!userSearchQ.trim()) return true;
    const q = userSearchQ.toLowerCase();
    return (
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  const filteredApprovers = approvers.filter(a => {
    const q = search.toLowerCase();
    return !search ||
      (a.display_name && a.display_name.toLowerCase().includes(q)) ||
      (a.username && a.username.toLowerCase().includes(q)) ||
      (a.department && a.department.toLowerCase().includes(q)) ||
      (a.email && a.email.toLowerCase().includes(q));
  });

  const totalApprovers = approvers.length;
  const deptCount = new Set(approvers.map(a => a.department).filter(Boolean)).size;
  const adminApprovers = approvers.filter(a => a.is_admin).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approvers Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain authorized approvers who can approve IOU and expense reconciliation chains.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedUser(null);
            setUserSearchQ('');
            setShowAddModal(true);
            fetchSystemUsers();
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          + Add Approver
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Approvers</span>
            <div className="p-1.5 rounded-lg bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{totalApprovers}</div>
          <div className="text-xs text-slate-400 mt-1">Configured for approval chains</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Covered Departments</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{deptCount}</div>
          <div className="text-xs text-indigo-100 mt-1">Distinct departments represented</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-800 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-purple-100 uppercase tracking-wider">Admin Approvers</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{adminApprovers}</div>
          <div className="text-xs text-purple-100 mt-1">With full admin privileges</div>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search by name, username, department, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" strokeWidth="2" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
          </svg>
        </div>
      </Card>

      {/* Approvers Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredApprovers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No matching approvers found</p>
            <p className="text-sm mt-1">
              {search ? 'Try adjusting your search criteria.' : 'Click "+ Add Approver" to add users to the list.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-center">Role</th>
                  <th className="py-3 px-3 text-center">Admin</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredApprovers.map(a => {
                  const initials = (a.display_name || a.username || 'A')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-800 truncate max-w-[200px]" title={a.display_name || a.username}>{a.display_name || a.username}</div>
                            <div className="text-xs text-slate-400 truncate max-w-[200px]" title={a.email || a.username}>{a.email || a.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 font-medium">
                        {a.department || <span className="text-slate-300 text-xs">-</span>}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="capitalize px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                          {a.role || 'employee'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {a.is_admin ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                            Admin
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveApprover(a.id, a.display_name || a.username)}
                          disabled={removingId === a.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          {removingId === a.id ? 'Removing...' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Approver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Add User to Approvers List</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Grant authorization privileges to approve IOU or Direct Expense requests.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            {/* Search / Filter Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Find User</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to filter by name, username, department, or email..."
                  value={userSearchQ}
                  onChange={(e) => {
                    setUserSearchQ(e.target.value);
                    setSelectedUser(null);
                  }}
                  className="w-full pl-9 pr-24 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                  autoFocus
                />
                <svg
                  className="w-4 h-4 text-slate-400 absolute left-3 top-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
                </svg>
                {userSearchQ && (
                  <button
                    onClick={() => {
                      setUserSearchQ('');
                      setSelectedUser(null);
                    }}
                    className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Eligible Users Selection List */}
            {!selectedUser && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                  <span>
                    {loadingAllUsers ? 'Loading users...' : `Showing ${filteredEligible.length} eligible user(s)`}
                  </span>
                  {userSearchQ.trim().length >= 2 && (
                    <button
                      type="button"
                      onClick={handleLdapSearch}
                      disabled={searchLoading}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-xs flex items-center gap-1"
                    >
                      {searchLoading ? 'Searching LDAP...' : 'Search directory (LDAP)'}
                    </button>
                  )}
                </div>

                {loadingAllUsers ? (
                  <div className="space-y-2 py-4">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredEligible.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                    <p className="text-sm font-medium text-slate-600">No matching non-approver users found.</p>
                    {userSearchQ ? (
                      <button
                        onClick={handleLdapSearch}
                        disabled={searchLoading}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                      >
                        {searchLoading ? 'Searching LDAP...' : `Search LDAP for "${userSearchQ}"`}
                      </button>
                    ) : (
                      <p className="text-xs text-slate-400">All available active users are already approvers.</p>
                    )}
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 bg-slate-50/40">
                    {filteredEligible.map(u => {
                      const uInitials = (u.display_name || u.username || 'U')
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="p-3 hover:bg-blue-50/80 cursor-pointer transition flex items-center justify-between text-sm group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-200 group-hover:bg-blue-600 group-hover:text-white text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 transition-colors">
                              {uInitials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 truncate">{u.display_name || u.username}</div>
                              <div className="text-xs text-slate-400 truncate">
                                {u.email || u.username} {u.department ? `• ${u.department}` : ''}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                            Select →
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected User Banner */}
            {selectedUser && (
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Ready to Add</div>
                  <div className="font-bold text-slate-800 text-base mt-0.5">{selectedUser.display_name || selectedUser.username}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {selectedUser.email || selectedUser.username} • {selectedUser.department || 'No Dept'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 text-xs text-emerald-800 font-semibold hover:bg-emerald-100 transition-colors"
                >
                  Change User
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddApprover}
                disabled={!selectedUser || adding}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-sm font-semibold hover:shadow-md disabled:opacity-50 transition-all"
              >
                {adding ? 'Adding...' : 'Confirm & Add Approver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
