import React, { useState, useEffect, useCallback } from 'react';
import { Search, Check, X, Edit, Power, PowerOff, Eye, BookOpen, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Spinner from '../../components/shared/Spinner';
import Pagination from '../../components/shared/Pagination';
import ConfirmDialog from '../../components/shared/ConfirmDialog';

const PAGE_SIZE = 20;

const HODFaculty = () => {
  const toast = useToast();
  const [tab, setTab] = useState('pending'); // pending | active | rejected
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  // Modals
  const [detailFac, setDetailFac] = useState(null);
  const [editFac, setEditFac] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(null);

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/auth/hod/faculty/?status=${tab}&page=${page}&page_size=${PAGE_SIZE}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      const { data } = await api.get(url);
      setFaculty(data.results || data || []);
      setTotal(data.count || (data.results ? data.results.length : 0));
    } catch {
      toast.error('Failed to load faculty list.');
    } finally {
      setLoading(false);
    }
  }, [tab, page, search]);

  useEffect(() => { fetchFaculty(); }, [fetchFaculty]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const doAction = async (url, msg) => {
    setActionLoading(true);
    try {
      await api.post(url, {});
      toast.success(msg);
      fetchFaculty();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = (f) => doAction(`/auth/hod/faculty/${f.id}/approve/`, `${f.name} approved.`);
  const handleActivate = (f) => doAction(`/auth/hod/faculty/${f.id}/activate/`, `${f.name} activated.`);
  const handleDeactivate = async (f) => {
    setActionLoading(true);
    try {
      await api.post(`/auth/hod/faculty/${f.id}/deactivate/`, {});
      toast.success(`${f.name} deactivated.`);
      setConfirmDeact(null);
      fetchFaculty();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.error('Rejection reason is required.'); return; }
    setActionLoading(true);
    try {
      await api.post(`/auth/hod/faculty/${rejectTarget.id}/reject/`, { reason: rejectReason });
      toast.success(`${rejectTarget.name} rejected.`);
      setRejectTarget(null);
      setRejectReason('');
      fetchFaculty();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSave = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/auth/hod/faculty/${editFac.id}/`, editForm);
      toast.success('Faculty profile updated.');
      setEditFac(null);
      fetchFaculty();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const tabCls = (t) =>
    `px-4 py-2 text-xs font-semibold rounded-lg transition ${
      tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
    }`;

  const cols = [
    { header: 'Name', render: (r) => <div><div className="font-semibold text-xs">{r.name}</div><div className="text-[11px] text-slate-400">{r.user?.email || r.email}</div></div> },
    { header: 'Designation', render: (r) => <span className="text-xs">{r.designation}</span> },
    { header: 'Department', render: (r) => <span className="text-xs">{r.department_name || '—'}</span> },
    { header: 'Status', render: (r) => <Badge status={r.account_status || r.approval_status}>{r.approval_status}</Badge> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => setDetailFac(r)}>View</Button>
          <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditFac(r); setEditForm({ name: r.name, designation: r.designation, phone: r.phone || '' }); }}>Edit</Button>
          {tab === 'pending' && <Button size="sm" icon={Check} onClick={() => handleApprove(r)} loading={actionLoading}>Approve</Button>}
          {tab === 'pending' && <Button size="sm" variant="danger" icon={X} onClick={() => setRejectTarget(r)}>Reject</Button>}
          {tab === 'active' && <Button size="sm" variant="danger" icon={PowerOff} onClick={() => setConfirmDeact(r)}>Deactivate</Button>}
          {tab === 'rejected' && <Button size="sm" icon={Power} onClick={() => handleActivate(r)} loading={actionLoading}>Activate</Button>}
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Faculty Management</h2>
          <p className="text-xs text-slate-500">Approve, reject, edit and manage faculty accounts.</p>
        </div>
        <Button icon={RefreshCw} variant="secondary" size="sm" onClick={fetchFaculty} loading={loading}>Refresh</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['pending', 'active', 'rejected'].map(t => <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
          className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <Table columns={cols} data={faculty} loading={loading} emptyMessage={`No ${tab} faculty.`} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Detail Modal */}
      <Modal isOpen={Boolean(detailFac)} onClose={() => setDetailFac(null)} title="Faculty Details" size="md">
        {detailFac && (
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold">Name:</span> {detailFac.name}</p>
            <p><span className="font-semibold">Email:</span> {detailFac.user?.email || detailFac.email}</p>
            <p><span className="font-semibold">Phone:</span> {detailFac.phone || '—'}</p>
            <p><span className="font-semibold">Designation:</span> {detailFac.designation}</p>
            <p><span className="font-semibold">Department:</span> {detailFac.department_name || '—'}</p>
            <p><span className="font-semibold">Approval Status:</span> {detailFac.approval_status}</p>
            <p><span className="font-semibold">Account Status:</span> {detailFac.account_status}</p>
            {detailFac.courses_count !== undefined && (
              <p><span className="font-semibold"><BookOpen size={13} className="inline mr-1" />Courses Handled:</span> {detailFac.courses_count}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={Boolean(editFac)} onClose={() => setEditFac(null)} title="Edit Faculty Profile" size="md">
        {editFac && (
          <div className="space-y-3">
            <Input label="Full Name" id="fac-edit-name" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Phone" id="fac-edit-phone" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Designation</label>
              <select value={editForm.designation || ''} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {['Assistant Professor','Associate Professor','Professor','Lecturer'].map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditFac(null)}>Cancel</Button>
              <Button onClick={handleEditSave} loading={actionLoading}>Save Changes</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={Boolean(rejectTarget)} onClose={() => { setRejectTarget(null); setRejectReason(''); }} title="Reject Faculty Application" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Provide a rejection reason for <strong>{rejectTarget?.name}</strong>:</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
            className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="Reason for rejection…" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="danger" onClick={handleReject} loading={actionLoading}>Reject</Button>
          </div>
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog isOpen={Boolean(confirmDeact)} title="Deactivate Faculty"
        message={`Are you sure you want to deactivate ${confirmDeact?.name}? They will lose access to faculty features.`}
        confirmText="Deactivate" isDanger onConfirm={() => handleDeactivate(confirmDeact)} onCancel={() => setConfirmDeact(null)} loading={actionLoading} />
    </div>
  );
};

export default HODFaculty;
