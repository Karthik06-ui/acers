import React, { useState, useEffect, useCallback } from 'react';
import { Search, Edit, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Pagination from '../../components/shared/Pagination';
import Spinner from '../../components/shared/Spinner';
import ConfirmDialog from '../../components/shared/ConfirmDialog';

const PAGE_SIZE = 20;

const HODAcademicRecords = () => {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const [selectedStudent, setSelectedStudent] = useState(null);
  const [records, setRecords] = useState([]);
  const [loadingRec, setLoadingRec] = useState(false);

  // Edit state
  const [editRecord, setEditRecord] = useState(null); // a specific record row
  const [editGpa, setEditGpa] = useState('');
  const [editCgpa, setEditCgpa] = useState('');
  const [confirmSave, setConfirmSave] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/auth/hod/students/?page=${page}&page_size=${PAGE_SIZE}`;
      if (search) url += `&name=${encodeURIComponent(search)}`;
      const { data } = await api.get(url);
      setStudents(data.results || data || []);
      setTotal(data.count || 0);
    } catch { toast.error('Failed to load students.'); }
    finally { setLoading(false); }
  }, [page, search]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { setPage(1); }, [search]);

  const openRecords = async (s) => {
    setSelectedStudent(s);
    setLoadingRec(true);
    try {
      const { data } = await api.get(`/hod/academic-records/${s.id}/`);
      setRecords(data.records || []);
      setEditCgpa(data.student?.cgpa || '');
    } catch { setRecords([]); }
    finally { setLoadingRec(false); }
  };

  const handleSave = async () => {
    setActionLoading(true);
    try {
      const payload = {};
      if (editRecord) {
        payload.record_id = editRecord.id;
        payload.gpa = editGpa;
        payload.credits_earned = editRecord.credits_earned;
      }
      if (editCgpa !== '') payload.cgpa = editCgpa;
      await api.patch(`/hod/academic-records/${selectedStudent.id}/`, payload);
      toast.success('Academic record updated.');
      setConfirmSave(false);
      setEditRecord(null);
      openRecords(selectedStudent);
    } catch (err) {
      toast.error(err.normalizedMessage || 'Update failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const studentCols = [
    { header: 'Student', render: (r) => <div><div className="text-xs font-semibold">{r.name}</div><div className="text-[11px] font-mono text-slate-400">{r.roll_no}</div></div> },
    { header: 'Dept / Year', render: (r) => <span className="text-xs">{r.department_code || '—'} / Y{r.year}</span> },
    { header: 'CGPA', render: (r) => <span className="font-bold text-xs text-indigo-700">{parseFloat(r.cgpa || 0).toFixed(2)}</span> },
    { header: '', render: (r) => <Button size="sm" variant="secondary" icon={Edit} onClick={() => openRecords(r)}>View/Edit Records</Button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Academic Records</h2>
          <p className="text-xs text-slate-500 flex items-center gap-1"><AlertCircle size={12} className="text-amber-500" /> Edits are audited and require confirmation.</p>
        </div>
        <Button icon={RefreshCw} size="sm" variant="secondary" onClick={fetchStudents} loading={loading}>Refresh</Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student…"
          className="pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <Table columns={studentCols} data={students} loading={loading} emptyMessage="No students." />
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      {/* Records Modal */}
      <Modal isOpen={Boolean(selectedStudent)} onClose={() => { setSelectedStudent(null); setEditRecord(null); }} title={`Academic Records — ${selectedStudent?.name}`} size="lg">
        {loadingRec ? <Spinner /> : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold">Overall CGPA:</span>
              <Input id="edit-cgpa" type="number" step="0.01" min={0} max={10} value={editCgpa}
                onChange={e => setEditCgpa(e.target.value)} className="w-24" />
            </div>

            <table className="w-full text-xs">
              <thead><tr className="border-b text-slate-500">
                <th className="text-left py-1 pr-4">Semester</th>
                <th className="text-left py-1 pr-4">GPA</th>
                <th className="text-left py-1 pr-4">Credits Earned</th>
                <th className="text-left py-1">Edit</th>
              </tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-1 pr-4">{r.academic_year} {r.semester_name}</td>
                    <td className="py-1 pr-4">
                      {editRecord?.id === r.id ? (
                        <input type="number" step="0.01" min={0} max={10} value={editGpa}
                          onChange={e => setEditGpa(e.target.value)}
                          className="w-20 border border-slate-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                      ) : (
                        <span className="font-bold text-indigo-700">{parseFloat(r.gpa).toFixed(2)}</span>
                      )}
                    </td>
                    <td className="py-1 pr-4">{r.credits_earned}</td>
                    <td className="py-1">
                      {editRecord?.id === r.id ? (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => setConfirmSave(true)}>Save</Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditRecord(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditRecord(r); setEditGpa(r.gpa); }}>Edit</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-slate-400">No records.</td></tr>}
              </tbody>
            </table>

            {/* Save overall CGPA only */}
            {!editRecord && (
              <div className="flex justify-end">
                <Button onClick={() => setConfirmSave(true)} loading={actionLoading}>Save CGPA Change</Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Save */}
      <ConfirmDialog isOpen={confirmSave} title="Confirm Academic Record Edit"
        message="This edit is audited and irreversible without HOD authority. Proceed?"
        confirmText="Yes, Save" isDanger={false} onConfirm={handleSave} onCancel={() => setConfirmSave(false)} loading={actionLoading} />
    </div>
  );
};

export default HODAcademicRecords;
