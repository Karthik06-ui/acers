import React, { useState, useEffect, useCallback } from 'react';
import { Search, Eye, Edit, Shield, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Pagination from '../../components/shared/Pagination';
import Spinner from '../../components/shared/Spinner';

const PAGE_SIZE = 20;

const HODStudents = () => {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ name: '', roll_no: '', department: '', year: '', status: '' });

  const [detailStudent, setDetailStudent] = useState(null);
  const [academicRecord, setAcademicRecord] = useState(null);
  const [loadingRecord, setLoadingRecord] = useState(false);

  const [editStudent, setEditStudent] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/auth/hod/students/?page=${page}&page_size=${PAGE_SIZE}`;
      Object.entries(filters).forEach(([k, v]) => { if (v) url += `&${k}=${encodeURIComponent(v)}`; });
      const { data } = await api.get(url);
      setStudents(data.results || data || []);
      setTotal(data.count || 0);
    } catch {
      toast.error('Failed to load students.');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [filters]);

  const openDetail = async (s) => {
    setDetailStudent(s);
    setLoadingRecord(true);
    try {
      const { data } = await api.get(`/hod/academic-records/${s.id}/`);
      setAcademicRecord(data);
    } catch { setAcademicRecord(null); }
    finally { setLoadingRecord(false); }
  };

  const handleEditSave = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/auth/hod/students/${editStudent.id}/`, editForm);
      toast.success('Student updated.');
      setEditStudent(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetStatus = async () => {
    setActionLoading(true);
    try {
      await api.post(`/auth/hod/students/${statusTarget.id}/status/`, { status: newStatus });
      toast.success(`Status set to ${newStatus}.`);
      setStatusTarget(null);
      fetchStudents();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const cols = [
    { header: 'Student', render: (r) => <div><div className="font-semibold text-xs">{r.name}</div><div className="text-[11px] font-mono text-slate-400">{r.roll_no}</div></div> },
    { header: 'Email', render: (r) => <span className="text-xs">{r.user?.email || r.email}</span> },
    { header: 'Dept / Year', render: (r) => <span className="text-xs">{r.department_code || '—'} / Y{r.year}</span> },
    { header: 'CGPA', render: (r) => <span className="font-bold text-xs text-indigo-700">{parseFloat(r.cgpa).toFixed(2)}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1 flex-wrap">
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => openDetail(r)}>Detail</Button>
          <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditStudent(r); setEditForm({ name: r.name, phone: r.phone || '', year: r.year, cgpa: r.cgpa }); }}>Edit</Button>
          <Button size="sm" variant="secondary" icon={Shield} onClick={() => { setStatusTarget(r); setNewStatus(r.status === 'Active' ? 'Inactive' : 'Active'); }}>Status</Button>
        </div>
      )
    },
  ];

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Management</h2>
          <p className="text-xs text-slate-500">Search, view, edit student accounts and academic records.</p>
        </div>
        <Button icon={RefreshCw} variant="secondary" size="sm" onClick={fetchStudents} loading={loading}>Refresh</Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {[['name', 'Name'], ['roll_no', 'Roll No'], ['department', 'Dept Code'], ['year', 'Year']].map(([k, ph]) => (
          <div key={k} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <input value={filters[k]} onChange={e => setFilter(k, e.target.value)} placeholder={ph}
              className="pl-7 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        ))}
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Statuses</option>
          {['Active','Inactive','Suspended'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <Table columns={cols} data={students} loading={loading} emptyMessage="No students found." />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Detail / Academic Record Modal */}
      <Modal isOpen={Boolean(detailStudent)} onClose={() => { setDetailStudent(null); setAcademicRecord(null); }} title="Student Detail & Academic Record" size="lg">
        {detailStudent && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <p><span className="font-semibold">Name:</span> {detailStudent.name}</p>
              <p><span className="font-semibold">Roll No:</span> {detailStudent.roll_no}</p>
              <p><span className="font-semibold">Email:</span> {detailStudent.user?.email}</p>
              <p><span className="font-semibold">Year:</span> {detailStudent.year}</p>
              <p><span className="font-semibold">CGPA:</span> <strong className="text-indigo-700">{parseFloat(detailStudent.cgpa).toFixed(2)}</strong></p>
              <p><span className="font-semibold">Status:</span> <Badge status={detailStudent.status}>{detailStudent.status}</Badge></p>
            </div>
            <hr />
            <h4 className="font-bold text-sm text-slate-800">Academic Records</h4>
            {loadingRecord ? <Spinner /> : academicRecord?.records?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b text-slate-500">
                    <th className="text-left py-1 pr-4">Semester</th>
                    <th className="text-left py-1 pr-4">GPA</th>
                    <th className="text-left py-1 pr-4">Credits Earned</th>
                  </tr></thead>
                  <tbody>
                    {academicRecord.records.map((r) => (
                      <tr key={r.id} className="border-b border-slate-50">
                        <td className="py-1 pr-4">{r.academic_year} {r.semester_name}</td>
                        <td className="py-1 pr-4 font-bold text-indigo-700">{parseFloat(r.gpa).toFixed(2)}</td>
                        <td className="py-1 pr-4">{r.credits_earned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-slate-400">No academic records.</p>}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={Boolean(editStudent)} onClose={() => setEditStudent(null)} title="Edit Student" size="sm">
        <div className="space-y-3">
          <Input label="Full Name" id="stu-edit-name" value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Phone" id="stu-edit-phone" value={editForm.phone || ''} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Year" id="stu-edit-year" type="number" min={1} max={5} value={editForm.year || ''} onChange={e => setEditForm(f => ({ ...f, year: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditStudent(null)}>Cancel</Button>
            <Button onClick={handleEditSave} loading={actionLoading}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={Boolean(statusTarget)} onClose={() => setStatusTarget(null)} title="Change Account Status" size="sm">
        <div className="space-y-3">
          <p className="text-sm">Change <strong>{statusTarget?.name}</strong>'s status to:</p>
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            className="w-full border border-slate-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {['Active','Inactive','Suspended'].map(s => <option key={s}>{s}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button onClick={handleSetStatus} loading={actionLoading}>Apply</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HODStudents;
