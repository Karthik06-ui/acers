import React, { useState, useEffect, useCallback } from 'react';
import { Shield, RefreshCw, Filter, Eye } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Pagination from '../../components/shared/Pagination';

const PAGE_SIZE = 20;

const HODEnrollments = () => {
  const toast = useToast();
  const [tab, setTab] = useState('enrollments'); // enrollments | requests
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');
  const [semesters, setSemesters] = useState([]);

  // Override modal
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overrideType, setOverrideType] = useState(''); // 'request' | 'enrollment'
  const [overrideAction, setOverrideAction] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api.get('/academics/semesters/').then(({ data }) => setSemesters(data.results || data || [])).catch(() => {});
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/hod/${tab}/?page=${page}&page_size=${PAGE_SIZE}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (semFilter) url += `&semester=${semFilter}`;
      const { data } = await api.get(url);
      setItems(data.results || data || []);
      setTotal(data.count || 0);
    } catch { toast.error(`Failed to load ${tab}.`); }
    finally { setLoading(false); }
  }, [tab, page, statusFilter, semFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);
  useEffect(() => { setPage(1); }, [tab, statusFilter, semFilter]);

  const openOverride = (item, type) => {
    setOverrideTarget(item);
    setOverrideType(type);
    setOverrideAction(type === 'request' ? 'approve' : 'withdraw');
    setOverrideReason('');
  };

  const submitOverride = async () => {
    if (!overrideReason.trim()) { toast.error('Override reason is mandatory.'); return; }
    setActionLoading(true);
    try {
      await api.post('/hod/override/', {
        target_type: overrideType,
        target_id: overrideTarget.id,
        action: overrideAction,
        reason: overrideReason,
      });
      toast.success(`Override applied: ${overrideAction}.`);
      setOverrideTarget(null);
      fetchItems();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Override failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const tabCls = (t) => `px-4 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`;

  const enrollCols = [
    { header: 'Student', render: (r) => <div><div className="text-xs font-semibold">{r.student?.name}</div><div className="text-[11px] font-mono text-slate-400">{r.student?.roll_no}</div></div> },
    { header: 'Course', render: (r) => <span className="font-mono text-xs font-bold text-indigo-700">{r.offering?.course_code}</span> },
    { header: 'Faculty', render: (r) => <span className="text-xs">{r.offering?.faculty_name}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { header: 'Grade', render: (r) => <span className="text-xs font-bold">{r.grade_points !== null && r.grade_points !== undefined ? parseFloat(r.grade_points).toFixed(2) : '—'}</span> },
    { header: 'Override', render: (r) => (
      <Button size="sm" icon={Shield} variant="secondary" onClick={() => openOverride(r, 'enrollment')}>Override</Button>
    )},
  ];

  const requestCols = [
    { header: 'Student', render: (r) => <div><div className="text-xs font-semibold">{r.student?.name}</div><div className="text-[11px] font-mono text-slate-400">{r.student?.roll_no}</div></div> },
    { header: 'Course', render: (r) => <span className="font-mono text-xs font-bold text-indigo-700">{r.offering?.course_code}</span> },
    { header: 'Faculty', render: (r) => <span className="text-xs">{r.offering?.faculty_name}</span> },
    { header: 'Requested', render: (r) => <span className="text-xs text-slate-500">{new Date(r.request_date).toLocaleDateString()}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { header: 'Override', render: (r) => (
      <Button size="sm" icon={Shield} variant="secondary" onClick={() => openOverride(r, 'request')}>Override</Button>
    )},
  ];

  const enrollStatuses = ['Active','Completed','Withdrawn'];
  const requestStatuses = ['Pending','Approved','Rejected'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Enrollments & Requests</h2>
          <p className="text-xs text-slate-500">Monitor all enrollments and requests. Apply HOD overrides with mandatory reason.</p>
        </div>
        <Button icon={RefreshCw} size="sm" variant="secondary" onClick={fetchItems} loading={loading}>Refresh</Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {['enrollments', 'requests'].map(t => <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 ml-4 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          {(tab === 'enrollments' ? enrollStatuses : requestStatuses).map(s => <option key={s}>{s}</option>)}
        </select>

        <select value={semFilter} onChange={e => setSemFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Semesters</option>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.academic_year} {s.semester_name}</option>)}
        </select>
      </div>

      <Table columns={tab === 'enrollments' ? enrollCols : requestCols} data={items} loading={loading} emptyMessage={`No ${tab} found.`} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Override Modal */}
      <Modal isOpen={Boolean(overrideTarget)} onClose={() => setOverrideTarget(null)} title="HOD Override Action" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Override <strong>{overrideType}</strong> #{overrideTarget?.id} for student{' '}
            <strong>{overrideTarget?.student?.name}</strong>.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Action</label>
            <select value={overrideAction} onChange={e => setOverrideAction(e.target.value)}
              className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {overrideType === 'request'
                ? ['approve','reject'].map(a => <option key={a}>{a}</option>)
                : ['withdraw','complete'].map(a => <option key={a}>{a}</option>)
              }
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reason (mandatory)</label>
            <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} rows={3}
              className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Override reason…" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOverrideTarget(null)}>Cancel</Button>
            <Button onClick={submitOverride} loading={actionLoading}>Apply Override</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HODEnrollments;
