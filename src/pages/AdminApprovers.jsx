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
  const [userSearchQ, setUserSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adding, setAdding] = useState(false);

  // Remove confirmation state
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchApprovers();
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

  // Handle user search in Add Approver modal
  useEffect(() => {
    if (!userSearchQ || userSearchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await getUsers({ search: userSearchQ, limit: 15 });
        const existingIds = new Set(approvers.map(a => a.id));
        setSearchResults((res.data.data || []).filter(u => !existingIds.has(u.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [userSearchQ, approvers]);

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

  const filteredApprovers = approvers.filter(a => {
    const q = search.toLowerCase();
    return !search ||
      (a.display_name && a.display_name.toLowerCase().includes(q)) ||
      (a.username && a.username.toLowerCase().includes(q)) ||
      (a.department && a.department.toLowerCase().includes(q)) ||
      (a.email && a.email.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Approvers Management</h1>
          <p className="text-sm text-slate-600">
            Maintain the official list of authorized approvers for IOU and Expense approval chains.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedUser(null);
            setUserSearchQ('');
            setSearchResults([]);
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 shadow-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Approver
        </button>
      </div>

      <Card>
        {/* Filter / Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name, username, department, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md px-4 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {/* Approvers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Loading approvers list...
                  </td>
                </tr>
              ) : filteredApprovers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    {search ? 'No matching approvers found.' : 'No managed approvers configured yet. Click "Add Approver" to add users to the list.'}
                  </td>
                </tr>
              ) : (
                filteredApprovers.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{a.display_name || a.username}</div>
                      <div className="text-xs text-slate-500">{a.email || a.username}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{a.department || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="capitalize px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {a.role || 'employee'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.is_admin ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">Admin</span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveApprover(a.id, a.display_name || a.username)}
                        disabled={removingId === a.id}
                        className="px-3 py-1.5 rounded text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                      >
                        {removingId === a.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Approver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800">Add User to Approvers List</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Search for any active user by name, email, or username to grant them authorization privileges.
            </p>

            <div className="relative">
              <input
                type="text"
                placeholder="Type to search users (LDAP & Local)..."
                value={userSearchQ}
                onChange={(e) => {
                  setUserSearchQ(e.target.value);
                  setSelectedUser(null);
                }}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {searchLoading && (
                <div className="absolute right-3 top-3 text-xs text-slate-400">Searching...</div>
              )}
            </div>

            {/* Search Results Dropdown / List */}
            {searchResults.length > 0 && !selectedUser && (
              <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100">
                {searchResults.map(u => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="p-3 hover:bg-blue-50 cursor-pointer transition flex items-center justify-between text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{u.display_name || u.username}</div>
                      <div className="text-xs text-slate-500">{u.email || u.username} {u.department ? `(${u.department})` : ''}</div>
                    </div>
                    <span className="text-xs font-semibold text-blue-600">Select</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected User Banner */}
            {selectedUser && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Selected User</div>
                  <div className="font-bold text-slate-800">{selectedUser.display_name || selectedUser.username}</div>
                  <div className="text-xs text-slate-500">{selectedUser.email} • {selectedUser.department || 'No Dept'}</div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-xs text-red-500 hover:underline font-semibold"
                >
                  Change
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddApprover}
                disabled={!selectedUser || adding}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
