import React, { useEffect, useState } from 'react';
import { getUsers, updateUserRole, updateUser, addUserByEmail } from '../services/iouService';
import Card from '../components/ui/Card';
import { toast } from 'react-toastify';

const ROLES = ['employee', 'hod', 'cashier', 'authorizer'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(null);

  // Add User by Email modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('employee');
  const [addAdmin, setAddAdmin] = useState(false);
  const [ldapPreview, setLdapPreview] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // HOD replace confirm modal
  const [hodConfirm, setHodConfirm] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(t);
  }, [search, roleFilter]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const r = await getUsers(params);
      setUsers(r.data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleRoleChange(userId, newRole) {
    setSaving(userId);
    try {
      const res = await updateUserRole(userId, { role: newRole });
      setUsers(s => s.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success('Role updated');
    } catch (e) {
      const data = e?.response?.data;
      if (data?.requires_confirm) {
        // HOD swap confirmation needed
        setHodConfirm({ userId, newRole, message: data.message, current_hod: data.current_hod });
      } else {
        toast.error(data?.message || 'Failed to update role');
      }
    }
    finally { setSaving(null); }
  }

  async function confirmHodReplace() {
    if (!hodConfirm) return;
    setSaving(hodConfirm.userId);
    try {
      await updateUserRole(hodConfirm.userId, { role: hodConfirm.newRole, confirm_replace: true });
      toast.success('HOD replaced successfully');
      fetchUsers(); // refresh to show both changes
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to replace HOD');
    }
    finally {
      setSaving(null);
      setHodConfirm(null);
    }
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
    } catch (e) {
      toast.error(e?.response?.data?.message || 'LDAP lookup failed');
    }
    finally { setAddLoading(false); }
  }

  async function handleAddUser() {
    if (!addEmail.trim()) return;
    setAddLoading(true);
    try {
      await addUserByEmail({ email: addEmail.trim(), role: addRole, is_admin: addAdmin });
      toast.success('User added successfully');
      setShowAddModal(false);
      setAddEmail('');
      setLdapPreview(null);
      setAddRole('employee');
      setAddAdmin(false);
      fetchUsers();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to add user');
    }
    finally { setAddLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md hover:shadow-lg transition"
        >
          + Add User by Email
        </button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500 mb-1 block">Search</label>
            <input placeholder="Name, username, email..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Role</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm">
              <option value="">All Roles</option>
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <button onClick={() => { setSearch(''); setRoleFilter(''); }} className="px-3 py-2 text-sm text-slate-500 hover:text-slate-800">Reset</button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="space-y-3">{[0,1,2,3].map(i => <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />)}</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-slate-500">No users found</div>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-xs uppercase">
                  <th className="text-left py-3 px-2">Name</th>
                  <th className="text-left py-3 px-2 hidden sm:table-cell">Username</th>
                  <th className="text-left py-3 px-2 hidden md:table-cell">Email</th>
                  <th className="text-left py-3 px-2 hidden lg:table-cell">Department</th>
                  <th className="text-center py-3 px-2">Role</th>
                  <th className="text-center py-3 px-2">Admin</th>
                  <th className="text-center py-3 px-2">Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2 font-medium text-slate-800">
                      {u.display_name || '-'}
                      <div className="text-xs text-slate-400 sm:hidden">{u.username}</div>
                    </td>
                    <td className="py-3 px-2 text-slate-600 hidden sm:table-cell">{u.username}</td>
                    <td className="py-3 px-2 text-slate-600 hidden md:table-cell">{u.email || '-'}</td>
                    <td className="py-3 px-2 text-slate-600 hidden lg:table-cell">{u.department || '-'}</td>
                    <td className="py-3 px-2 text-center">
                      <select
                        value={u.role || 'employee'}
                        onChange={e => handleRoleChange(u.id, e.target.value)}
                        disabled={saving === u.id}
                        className="px-2 py-1 rounded border border-slate-200 text-xs bg-white"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                      </select>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <label className={`relative inline-flex items-center cursor-pointer ${saving === u.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" className="sr-only peer" checked={u.is_admin} onChange={() => toggleAdmin(u.id, u.is_admin)} disabled={saving === u.id} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <label className={`relative inline-flex items-center cursor-pointer ${saving === u.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" className="sr-only peer" checked={u.is_active !== false} onChange={() => toggleActive(u.id, u.is_active)} disabled={saving === u.id} />
                        <div className="w-11 h-6 bg-red-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                    </td>
                  </tr>
                ))}
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
                  <div><span className="text-slate-500">Dept:</span> <strong>{ldapPreview.department || '-'}</strong></div>
                  <div className="col-span-2"><span className="text-slate-500">Title:</span> <strong>{ldapPreview.title || '-'}</strong></div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Assign Role</label>
                    <select value={addRole} onChange={e => setAddRole(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm">
                      {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={addAdmin} onChange={e => setAddAdmin(e.target.checked)} className="rounded" />
                      <span className="text-sm">Admin access</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => { setShowAddModal(false); setLdapPreview(null); setAddEmail(''); }} disabled={addLoading} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
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

      {/* HOD Replace Confirmation Modal */}
      {hodConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Replace Head of Department?</h3>
            <p className="text-sm text-slate-600 mb-4">{hodConfirm.message}</p>
            {hodConfirm.current_hod && (
              <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-sm">
                <span className="text-amber-700">Current HOD: </span>
                <strong>{hodConfirm.current_hod.display_name || hodConfirm.current_hod.username}</strong>
                <span className="text-amber-600"> will be demoted to Employee.</span>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setHodConfirm(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm">Cancel</button>
              <button
                onClick={confirmHodReplace}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-sm shadow-md"
              >
                {saving ? 'Replacing...' : 'Yes, Replace HOD'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
