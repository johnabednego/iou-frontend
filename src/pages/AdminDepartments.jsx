import React, { useEffect, useState, useMemo } from 'react';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, getUsers, mergeDepartments } from '../services/iouService';
import Card from '../components/ui/Card';
import { toast } from 'react-toastify';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive

  // Modal states: 'create' | 'edit' | null
  const [modalMode, setModalMode] = useState(null);
  const [currentDept, setCurrentDept] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    ldap_aliases: '',
    is_active: true,
    selectedHods: [] // array of user objects: { id, display_name, username, email }
  });
  const [saving, setSaving] = useState(false);

  // User search state for HOD picker inside modal
  const [userSearchQ, setUserSearchQ] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeKeepAlias, setMergeKeepAlias] = useState(true);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    setLoading(true);
    try {
      const res = await getDepartments({ include_inactive: 'true' });
      setDepartments(res.data.data || []);
    } catch (err) {
      console.error('Failed to load departments', err);
      toast.error('Failed to fetch departments list');
    } finally {
      setLoading(false);
    }
  }

  // User search for HOD multi-select
  useEffect(() => {
    if (!userSearchQ || userSearchQ.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await getUsers({ search: userSearchQ.trim(), limit: 12, is_active: true });
        const selectedIds = new Set(formData.selectedHods.map(h => h.id));
        setUserSearchResults((res.data.data || []).filter(u => !selectedIds.has(u.id)));
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [userSearchQ, formData.selectedHods]);

  function openCreateModal() {
    setCurrentDept(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      ldap_aliases: '',
      is_active: true,
      selectedHods: []
    });
    setUserSearchQ('');
    setUserSearchResults([]);
    setModalMode('create');
  }

  function openEditModal(dept) {
    setCurrentDept(dept);
    setFormData({
      name: dept.name || '',
      code: dept.code || '',
      description: dept.description || '',
      ldap_aliases: dept.ldap_aliases || '',
      is_active: dept.is_active !== false,
      selectedHods: Array.isArray(dept.hods) ? [...dept.hods] : []
    });
    setUserSearchQ('');
    setUserSearchResults([]);
    setModalMode('edit');
  }

  function addHodToForm(user) {
    if (!formData.selectedHods.some(h => (h.id && h.id === user.id) || (h.username && h.username === user.username))) {
      setFormData(prev => ({
        ...prev,
        selectedHods: [...prev.selectedHods, user]
      }));
    }
    setUserSearchQ('');
    setUserSearchResults([]);
  }

  function removeHodFromForm(userId) {
    setFormData(prev => ({
      ...prev,
      selectedHods: prev.selectedHods.filter(h => h.id !== userId && h.username !== userId)
    }));
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase() || null,
        description: formData.description.trim() || null,
        ldap_aliases: formData.ldap_aliases.trim() || null,
        is_active: formData.is_active,
        hod_user_ids: formData.selectedHods.map(h => h.id || h.username)
      };

      if (modalMode === 'create') {
        await createDepartment(payload);
        toast.success('Department created successfully');
      } else {
        await updateDepartment(currentDept.id, payload);
        toast.success('Department updated successfully');
      }
      setModalMode(null);
      fetchDepartments();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  }

  async function handleMerge() {
    if (!mergeSourceId || !mergeTargetId) {
      toast.error('Please select both a source and a target department');
      return;
    }
    if (mergeSourceId === mergeTargetId) {
      toast.error('Source and target departments cannot be the same');
      return;
    }

    setMerging(true);
    try {
      const res = await mergeDepartments({
        source_department_id: mergeSourceId,
        target_department_id: mergeTargetId,
        keep_alias: mergeKeepAlias
      });
      toast.success(res.data?.message || 'Departments merged successfully');
      setShowMergeModal(false);
      setMergeSourceId('');
      setMergeTargetId('');
      fetchDepartments();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || 'Failed to merge departments');
    } finally {
      setMerging(false);
    }
  }

  async function handleToggleStatus(dept) {
    try {
      await updateDepartment(dept.id, { is_active: !dept.is_active });
      toast.success(`Department ${dept.is_active ? 'deactivated' : 'activated'}`);
      setDepartments(prev =>
        prev.map(d => (d.id === dept.id ? { ...d, is_active: !dept.is_active } : d))
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update department status');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteDepartment(deleteTarget.id);
      toast.success(res.data?.message || 'Department deleted successfully');
      setDeleteTarget(null);
      fetchDepartments();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  }

  // Filtered list
  const filteredDepartments = useMemo(() => {
    return departments.filter(d => {
      const matchesSearch =
        (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.code || '').toLowerCase().includes(search.toLowerCase()) ||
        (d.description || '').toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;
      if (statusFilter === 'active') return d.is_active !== false;
      if (statusFilter === 'inactive') return d.is_active === false;
      return true;
    });
  }, [departments, search, statusFilter]);

  // Summary counts
  const totalCount = departments.length;
  const activeCount = departments.filter(d => d.is_active !== false).length;
  const withHodCount = departments.filter(d => (d.hods && d.hods.length > 0) || d.hod).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Department Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage company departments and assign multiple Heads of Department (HODs).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setMergeSourceId('');
              setMergeTargetId('');
              setShowMergeModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            ⇄ Merge Departments
          </button>
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            + Add Department
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 p-5 shadow-lg text-white">
          <div className="text-xs font-medium text-slate-300 uppercase tracking-wider">Total Departments</div>
          <div className="text-3xl font-extrabold mt-1">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-1">Configured in system</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 shadow-lg text-white">
          <div className="text-xs font-medium text-emerald-100 uppercase tracking-wider">Active Departments</div>
          <div className="text-3xl font-extrabold mt-1">{activeCount}</div>
          <div className="text-xs text-emerald-100 mt-1">Available for user selection</div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 p-5 shadow-lg text-white">
          <div className="text-xs font-medium text-indigo-100 uppercase tracking-wider">With Assigned HOD(s)</div>
          <div className="text-3xl font-extrabold mt-1">{withHodCount}</div>
          <div className="text-xs text-indigo-100 mt-1">Ready for IOU approval routing</div>
        </div>
      </div>

      {/* Filters & Search */}
      <Card>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 max-w-md relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search department name, code, or description..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: 'Active' },
                { key: 'inactive', label: 'Inactive' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    statusFilter === tab.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Department Table */}
      <Card>
        {loading ? (
          <div className="space-y-3 py-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <div className="w-12 h-12 mx-auto mb-3 text-slate-300 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-600">No departments found</p>
            <p className="text-sm mt-1">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter.'
                : 'Click "+ Add Department" to create your first department.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Heads of Department (HODs)</th>
                  <th className="py-3 px-3 text-center">Members</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDepartments.map(dept => {
                  const hodList = Array.isArray(dept.hods) ? dept.hods : [];
                  return (
                    <tr key={dept.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800">{dept.name}</div>
                        {dept.description && (
                          <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{dept.description}</div>
                        )}
                        {dept.ldap_aliases && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-[10px] font-medium text-slate-400">LDAP:</span>
                            {dept.ldap_aliases.split(',').map((alias, idx) => (
                              <span key={idx} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100">
                                {alias.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        {dept.code ? (
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700">
                            {dept.code}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {hodList.length === 0 ? (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              No HOD assigned
                            </span>
                          ) : (
                            hodList.map(h => (
                              <span
                                key={h.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                {h.display_name || h.username}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="text-xs font-semibold text-slate-600 px-2 py-0.5 rounded bg-slate-100">
                          {dept.member_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(dept)}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            dept.is_active !== false
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {dept.is_active !== false ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(dept)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteTarget(dept)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Department Modal */}
      {modalMode && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !saving && setModalMode(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">
                {modalMode === 'create' ? 'Add New Department' : `Edit Department: ${currentDept?.name}`}
              </h3>
              <button
                onClick={() => !saving && setModalMode(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Information Technology"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Code / Abbr
                  </label>
                  <input
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. IT"
                    maxLength={10}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 font-mono uppercase"
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                    />
                    <span className="text-sm font-semibold text-slate-700">Active Department</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief summary of department functions (optional)"
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    LDAP Department Aliases
                  </label>
                  <span className="text-xs text-slate-400">Comma-separated</span>
                </div>
                <input
                  value={formData.ldap_aliases}
                  onChange={e => setFormData({ ...formData, ldap_aliases: e.target.value })}
                  placeholder="e.g. Finance & Admin Department, FINANCE & ADMIN DEPT"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  When employees log in with these LDAP department names, they are automatically mapped to this department.
                </p>
              </div>

              {/* Multi-HOD Selector */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Assigned Heads of Department (HODs)
                  </label>
                  <span className="text-xs text-slate-400">Multiple allowed</span>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  All assigned users will have HOD permissions. Cashiers will select one HOD from this list when assigning approvals.
                </p>

                {/* Selected HODs Chips */}
                <div className="flex flex-wrap gap-2 mb-3 min-h-[32px] p-2 bg-slate-50 rounded-xl border border-slate-100">
                  {formData.selectedHods.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No HODs selected yet.</span>
                  ) : (
                    formData.selectedHods.map(h => (
                      <span
                        key={h.id || h.username}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
                      >
                        <span>{h.display_name || h.username}</span>
                        <button
                          type="button"
                          onClick={() => removeHodFromForm(h.id || h.username)}
                          className="hover:text-red-700 text-emerald-900 font-bold ml-1 text-sm leading-none"
                        >
                          &times;
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Search to add HOD */}
                <div className="relative">
                  <input
                    value={userSearchQ}
                    onChange={e => setUserSearchQ(e.target.value)}
                    placeholder="Search user by name, username, or email to add as HOD..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {searchLoading && (
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">Searching...</span>
                  )}

                  {/* Search Results Dropdown */}
                  {userSearchQ.trim().length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-100 z-30 max-h-56 overflow-y-auto divide-y divide-slate-50">
                      {userSearchResults.map(u => (
                        <div
                          key={u.id}
                          onClick={() => addHodToForm(u)}
                          className="px-3.5 py-2 text-xs hover:bg-emerald-50 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">{u.display_name || u.username}</div>
                            <div className="text-slate-400">{u.email} {u.department ? `(${u.department})` : ''}</div>
                          </div>
                          <span className="text-emerald-600 font-bold text-xs">+ Add</span>
                        </div>
                      ))}
                      <div
                        onClick={() => addHodToForm({ id: userSearchQ.trim(), username: userSearchQ.trim(), display_name: userSearchQ.trim(), email: userSearchQ.trim().includes('@') ? userSearchQ.trim() : null })}
                        className="px-3.5 py-2.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold cursor-pointer flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                          <span>Add "{userSearchQ.trim()}" (Create/Promote to HOD)</span>
                        </div>
                        <span className="text-[10px] bg-indigo-200 text-indigo-900 px-1.5 py-0.5 rounded font-bold">Auto-HOD</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {saving ? 'Saving...' : modalMode === 'create' ? 'Create Department' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Delete Department</h3>
            <p className="text-sm text-slate-600 text-center mb-4">
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              If this department has active users or past IOUs, it will be automatically deactivated instead of deleted to protect historical audit records.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-md disabled:opacity-50"
              >
                {deleting ? 'Processing...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Departments Modal */}
      {showMergeModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => !merging && setShowMergeModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Merge Departments</h3>
                  <p className="text-xs text-slate-500">Consolidate duplicate LDAP departments into one</p>
                </div>
              </div>
              <button
                onClick={() => !merging && setShowMergeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-800 leading-relaxed">
                <strong>How it works:</strong> All users and IOUs under the <em>Source Department</em> will be automatically reassigned to the <em>Target Department</em>. All assigned HODs will be merged, and the duplicate department will be safely archived/removed.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Source Department (Duplicate to Merge / Remove) <span className="text-red-500">*</span>
                </label>
                <select
                  value={mergeSourceId}
                  onChange={e => setMergeSourceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
                >
                  <option value="">-- Select duplicate department --</option>
                  {departments
                    .filter(d => d.id !== mergeTargetId)
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.member_count ?? 0} members)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Department (Clean Master Department) <span className="text-red-500">*</span>
                </label>
                <select
                  value={mergeTargetId}
                  onChange={e => setMergeTargetId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="">-- Select master department to keep --</option>
                  {departments
                    .filter(d => d.id !== mergeSourceId)
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeKeepAlias}
                    onChange={e => setMergeKeepAlias(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-700">
                      Add source department name as an LDAP alias
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Recommended: When employees authenticate with the old/messy Active Directory department name in the future, they will automatically map to the master department.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowMergeModal(false)}
                disabled={merging}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={merging || !mergeSourceId || !mergeTargetId}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 text-white text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {merging ? 'Merging...' : 'Confirm & Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
