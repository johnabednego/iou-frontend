import React, { useEffect, useState } from 'react';
import { getUsers, updateUserRole, updateUser, addUserByEmail, getDepartments } from '../services/iouService';
import Card from '../components/ui/Card';
import { toast } from 'react-toastify';

const ROLES = ['employee', 'hod', 'cashier', 'authorizer'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [saving, setSaving] = useState(null);

  // Add User by Email modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('employee');
  const [addAdmin, setAddAdmin] = useState(false);
  const [addDept, setAddDept] = useState('');
  const [ldapPreview, setLdapPreview] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(t);
  }, [search, roleFilter, deptFilter]);

  async function fetchDepartments() {
    try {
      const res = await getDepartments();
      setDepartments(res.data.data || []);
    } catch (e) {
      console.error('Failed to fetch departments', e);
    }
  }

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (deptFilter) params.department = deptFilter;
      const r = await getUsers(params);
      setUsers(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleRoleChange(userId, newRole) {
    setSaving(userId);
    try {
      await updateUserRole(userId, { role: newRole });
      setUsers(s => s.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update role');
    }
    finally { setSaving(null); }
  }

  async function handleDepartmentChange(userId, newDept) {
    setSaving(userId);
    try {
      await updateUser(userId, { department: newDept });
      setUsers(s => s.map(u => u.id === userId ? { ...u, department: newDept } : u));
      toast.success('Department updated');
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to update department');
    }
    finally { setSaving(null); }
  }

  async function toggleAdmin(userId, current) {
    setSaving(userId);
    try {
      await updateUserRole(userId, { is_admin: !current });
      setUsers(s => s.map(u => u.id === userId ? { ...u, is_admin: !current } : u));
      toast.success(current ? 'Admin access removed' : 'Admin access granted');
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setSaving(null); }
  }

  async function toggleActive(userId, current) {
    setSaving(userId);
    try {
      await updateUser(userId, { is_active: !current });
      setUsers(s => s.map(u => u.id === userId ? { ...u, is_active: !current } : u));
      toast.success(current ? 'User deactivated' : 'User activated');
    } catch (e) { toast.error(e?.response?.data?.message || 'Failed'); }
    finally { setSaving(null); }
  }

  // LDAP lookup preview
  async function handleLdapPreview() {
    if (!addEmail.trim()) return;
    setAddLoading(true);
    setLdapPreview(null);
    try {
      const res = await addUserByEmail({ email: addEmail.trim(), preview: true });
      setLdapPreview(res.data.ldap_user);
      if (res.data.ldap_user?.department) {
        setAddDept(res.data.ldap_user.department);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || 'LDAP lookup failed');
    }
    finally { setAddLoading(false); }
  }

  async function handleAddUser() {
    if (!addEmail.trim()) return;
    setAddLoading(true);
    try {
      await addUserByEmail({
        email: addEmail.trim(),
        role: addRole,
        is_admin: addAdmin,
        department: addDept
      });
      toast.success('User added successfully');
      setShowAddModal(false);
      setAddEmail('');
      setLdapPreview(null);
      setAddRole('employee');
      setAddAdmin(false);
      setAddDept('');
      fetchUsers();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add user');
    }
    finally { setAddLoading(false); }
  }

  // Summary statistics computed off fetched users
  const totalCount = users.length;
  const activeCount = users.filter(u => u.is_active !== false).length;
  const hodCount = users.filter(u => u.role === 'hod').length;
  const adminCount = users.filter(u => u.is_admin).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage user accounts, assign roles, configure admin privileges, and assign departments.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          + Add User by Email
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Users</span>
            <div className="p-1.5 rounded-lg bg-white/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-1">Registered in system</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Active Accounts</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{activeCount}</div>
          <div className="text-xs text-emerald-100 mt-1">Can log in & request IOUs</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">Heads of Dept (HODs)</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{hodCount}</div>
          <div className="text-xs text-indigo-100 mt-1">Eligible for HOD approval flow</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 p-5 shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-amber-100 uppercase tracking-wider">Administrators</span>
            <div className="p-1.5 rounded-lg bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{adminCount}</div>
          <div className="text-xs text-amber-100 mt-1">Full system configuration rights</div>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 max-w-md relative">
            <input
              placeholder="Search by name, username, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
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

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Roles</option>
              {ROLES.map(r => (
                <option key={r} value={r}>{r === 'hod' ? 'Head of Dept (HOD)' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>

            {(search || roleFilter || deptFilter) && (
              <button
                onClick={() => { setSearch(''); setRoleFilter(''); setDeptFilter(''); }}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No users found</p>
            <p className="text-sm mt-1">Try adjusting your search query or filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">User</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Username</th>
                  <th className="py-3 px-3 hidden md:table-cell">Email</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3 text-center">Role</th>
                  <th className="py-3 px-3 text-center">Admin</th>
                  <th className="py-3 px-3 text-center">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => {
                  const initials = (u.display_name || u.username || 'U')
                    .split(' ')
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{u.display_name || '-'}</div>
                            <div className="text-xs text-slate-400 sm:hidden">{u.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 hidden sm:table-cell font-mono text-xs">
                        {u.username}
                      </td>
                      <td className="py-3 px-3 text-slate-600 hidden md:table-cell">
                        {u.email || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-3 px-3">
                        <select
                          value={u.department || ''}
                          onChange={e => handleDepartmentChange(u.id, e.target.value)}
                          disabled={saving === u.id}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 max-w-[210px] truncate focus:ring-2 focus:ring-blue-200"
                          title="Assign Department"
                        >
                          <option value="">-- No Department --</option>
                          {u.department && !departments.some(d => d.name.toLowerCase() === u.department.toLowerCase()) && (
                            <option value={u.department}>{u.department} (Custom)</option>
                          )}
                          {departments.map(d => (
                            <option key={d.id} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <select
                          value={u.role || 'employee'}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          disabled={saving === u.id}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            u.role === 'hod'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : u.role === 'cashier'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : u.role === 'authorizer'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>
                              {r === 'hod' ? 'HOD' : r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <label className={`relative inline-flex items-center cursor-pointer ${saving === u.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={u.is_admin}
                            onChange={() => toggleAdmin(u.id, u.is_admin)}
                            disabled={saving === u.id}
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <label className={`relative inline-flex items-center cursor-pointer ${saving === u.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={u.is_active !== false}
                            onChange={() => toggleActive(u.id, u.is_active)}
                            disabled={saving === u.id}
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add User by Email Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !addLoading && setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-4">Add User by Email (LDAP)</h3>

            <div className="mb-4">
              <label className="block text-sm text-slate-700 mb-1">Email Address</label>
              <div className="flex gap-2">
                <input
                  value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  placeholder="user@mps-gh.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm"
                />
                <button
                  onClick={handleLdapPreview}
                  disabled={addLoading || !addEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {addLoading ? 'Searching...' : 'Look Up'}
                </button>
              </div>
            </div>

            {ldapPreview && (
              <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-600 uppercase tracking-wider mb-2 font-semibold">LDAP User Found</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-500">Name:</span> <strong>{ldapPreview.display_name}</strong></div>
                  <div><span className="text-slate-500">Username:</span> <strong>{ldapPreview.username}</strong></div>
                  <div><span className="text-slate-500">Email:</span> <strong>{ldapPreview.email}</strong></div>
                  <div><span className="text-slate-500">Title:</span> <strong>{ldapPreview.title || '-'}</strong></div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Department</label>
                    <select
                      value={addDept}
                      onChange={e => setAddDept(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                    >
                      <option value="">None</option>
                      {addDept && !departments.some(d => d.name.toLowerCase() === addDept.toLowerCase()) && (
                        <option value={addDept}>{addDept} (LDAP)</option>
                      )}
                      {departments.map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Assign Role</label>
                    <select value={addRole} onChange={e => setAddRole(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white">
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={addAdmin} onChange={e => setAddAdmin(e.target.checked)} className="rounded" />
                      <span className="text-xs font-medium text-slate-700">Admin access</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setShowAddModal(false); setLdapPreview(null); setAddEmail(''); setAddDept(''); }} disabled={addLoading} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              {ldapPreview && (
                <button
                  onClick={handleAddUser}
                  disabled={addLoading}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md"
                >
                  {addLoading ? 'Adding...' : 'Confirm & Add User'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
