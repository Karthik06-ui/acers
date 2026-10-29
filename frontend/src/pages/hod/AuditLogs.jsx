import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import Table from '../../components/shared/Table';
import Button from '../../components/shared/Button';
import Pagination from '../../components/shared/Pagination';

const PAGE_SIZE = 15;

const ACTION_CHOICES = [
  '', 'APPROVE_FACULTY', 'REJECT_FACULTY', 'ACTIVATE_FACULTY', 'DEACTIVATE_FACULTY',
  'EDIT_STUDENT', 'SET_STUDENT_STATUS', 'CREATE_DEPARTMENT', 'UPDATE_DEPARTMENT',
  'DELETE_DEPARTMENT', 'CREATE_SEMESTER', 'UPDATE_SEMESTER', 'DELETE_SEMESTER',
  'CREATE_COURSE', 'UPDATE_COURSE', 'ARCHIVE_COURSE', 'DELETE_COURSE',
  'CREATE_OFFERING', 'UPDATE_OFFERING', 'DELETE_OFFERING',
  'APPROVE_REQUEST', 'REJECT_REQUEST', 'WITHDRAW_ENROLLMENT', 'COMPLETE_ENROLLMENT',
  'HOD_OVERRIDE', 'HOD_UPDATE_ACADEMIC_RECORD',
];

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/hod/audit-logs/?page=${page}&page_size=${PAGE_SIZE}`;
      if (actionFilter) url += `&action=${actionFilter}`;
      if (actorFilter) url += `&actor_email=${encodeURIComponent(actorFilter)}`;
      const { data } = await api.get(url);
      setLogs(data.results || data || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, actorFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [actionFilter, actorFilter]);

  const columns = [
    {
      header: 'Timestamp',
      render: (row) => (
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Actor',
      render: (row) => <span className="font-semibold text-xs text-slate-900">{row.actor_email}</span>,
    },
    {
      header: 'Action',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
          {row.action}
        </span>
      ),
    },
    {
      header: 'Target',
      render: (row) => (
        <span className="text-xs text-slate-600">
          {row.target_type} #{row.target_id}
        </span>
      ),
    },
    {
      header: 'Details',
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono truncate max-w-xs block">
          {JSON.stringify(row.details || {})}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Security &amp; Administrative Audit Logs</h2>
          <p className="text-xs text-slate-500">
            Immutable log entries recording all administrative overrides, course edits, and faculty approvals.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchLogs} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Actions</option>
          {ACTION_CHOICES.filter(Boolean).map(a => <option key={a}>{a}</option>)}
        </select>
        <input
          value={actorFilter}
          onChange={e => setActorFilter(e.target.value)}
          placeholder="Filter by actor email…"
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
        />
      </div>

      <Table columns={columns} data={logs} loading={loading} emptyMessage="No audit logs recorded." />

      <Pagination
        currentPage={page}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
};

export default AuditLogs;
