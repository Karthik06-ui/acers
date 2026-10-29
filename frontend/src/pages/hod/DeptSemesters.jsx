import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import ConfirmDialog from '../../components/shared/ConfirmDialog';

const emptyDept = { name: '', code: '', status: 'Active' };
const emptySem = { academic_year: '', semester_name: 'Odd', start_date: '', end_date: '', status: 'Upcoming' };

const HODDeptSemesters = () => {
  const toast = useToast();
  const [tab, setTab] = useState('departments');
  const [depts, setDepts] = useState([]);
  const [sems, setSems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addDept, setAddDept] = useState(false);
  const [editDept, setEditDept] = useState(null);
  const [deptForm, setDeptForm] = useState(emptyDept);
  const [addSem, setAddSem] = useState(false);
  const [editSem, setEditSem] = useState(null);
  const [semForm, setSemForm] = useState(emptySem);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDepts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/academics/departments/');
      setDepts(data.results || data || []);
    } catch { toast.error('Failed to load departments.'); }
    finally { setLoading(false); }
  };

  const fetchSems = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/academics/semesters/');
      setSems(data.results || data || []);
    } catch { toast.error('Failed to load semesters.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (tab === 'departments') fetchDepts();
    else fetchSems();
  }, [tab]);

  const saveDept = async () => {
    setActionLoading(true);
    try {
      if (editDept) {
        await api.patch(`/academics/departments/${editDept.id}/`, deptForm);
        toast.success('Department updated.');
        setEditDept(null);
      } else {
        await api.post('/academics/departments/', deptForm);
        toast.success('Department created.');
        setAddDept(false);
      }
      setDeptForm(emptyDept);
      fetchDepts();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const deleteDept = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/academics/departments/${deleteTarget.id}/`);
      toast.success('Department deleted.');
      setDeleteTarget(null);
      fetchDepts();
    } catch (err) { toast.error(err.normalizedMessage || 'Cannot delete.'); }
    finally { setActionLoading(false); }
  };

  const saveSem = async () => {
    setActionLoading(true);
    try {
      if (editSem) {
        await api.patch(`/academics/semesters/${editSem.id}/`, semForm);
        toast.success('Semester updated.');
        setEditSem(null);
      } else {
        await api.post('/academics/semesters/', semForm);
        toast.success('Semester created.');
        setAddSem(false);
      }
      setSemForm(emptySem);
      fetchSems();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const toggleSemester = async (sem) => {
    const newStatus = sem.status === 'Open' ? 'Closed' : 'Open';
    setActionLoading(true);
    try {
      await api.patch(`/academics/semesters/${sem.id}/`, { status: newStatus });
      toast.success(`Semester ${newStatus}.`);
      fetchSems();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const tabCls = (t) => `px-4 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`;

  const deptCols = [
    { header: 'Code', render: (r) => <span className="font-mono text-xs font-bold text-indigo-700">{r.code}</span> },
    { header: 'Name', render: (r) => <span className="text-xs">{r.name}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditDept(r); setDeptForm({ name: r.name, code: r.code, status: r.status }); }}>Edit</Button>
        <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteTarget({ ...r, _type: 'dept' })}>Del</Button>
      </div>
    )},
  ];

  const semCols = [
    { header: 'Year', render: (r) => <span className="text-xs font-semibold">{r.academic_year}</span> },
    { header: 'Semester', render: (r) => <span className="text-xs">{r.semester_name}</span> },
    { header: 'Dates', render: (r) => <span className="text-xs text-slate-500">{r.start_date} → {r.end_date}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    { header: 'Actions', render: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditSem(r); setSemForm({ academic_year: r.academic_year, semester_name: r.semester_name, start_date: r.start_date, end_date: r.end_date, status: r.status }); }}>Edit</Button>
        <Button size="sm" variant={r.status === 'Open' ? 'danger' : 'secondary'} icon={r.status === 'Open' ? ToggleLeft : ToggleRight}
          onClick={() => toggleSemester(r)} loading={actionLoading}>
          {r.status === 'Open' ? 'Close' : 'Open'}
        </Button>
      </div>
    )},
  ];

  const DeptForm = () => (
    <div className="space-y-3">
      <Input label="Department Name" id="dept-name" value={deptForm.name} onChange={e => setDeptForm(f => ({ ...f, name: e.target.value }))} />
      <Input label="Code (e.g. CS)" id="dept-code" value={deptForm.code} onChange={e => setDeptForm(f => ({ ...f, code: e.target.value }))} />
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
        <select value={deptForm.status} onChange={e => setDeptForm(f => ({ ...f, status: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['Active','Inactive'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );

  const SemForm = () => (
    <div className="space-y-3">
      <Input label="Academic Year (e.g. 2024-2025)" id="sem-year" value={semForm.academic_year} onChange={e => setSemForm(f => ({ ...f, academic_year: e.target.value }))} />
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Semester Name</label>
        <select value={semForm.semester_name} onChange={e => setSemForm(f => ({ ...f, semester_name: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['Odd','Even'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input label="Start Date" id="sem-start" type="date" value={semForm.start_date} onChange={e => setSemForm(f => ({ ...f, start_date: e.target.value }))} />
        <Input label="End Date" id="sem-end" type="date" value={semForm.end_date} onChange={e => setSemForm(f => ({ ...f, end_date: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
        <select value={semForm.status} onChange={e => setSemForm(f => ({ ...f, status: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['Upcoming','Open','Closed'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Departments & Semesters</h2>
        <p className="text-xs text-slate-500">Manage departments and academic semester lifecycle.</p>
      </div>

      <div className="flex gap-2">
        {['departments','semesters'].map(t => <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      {tab === 'departments' && (
        <>
          <div className="flex justify-end">
            <Button icon={Plus} size="sm" onClick={() => { setDeptForm(emptyDept); setAddDept(true); }}>New Department</Button>
          </div>
          <Table columns={deptCols} data={depts} loading={loading} emptyMessage="No departments." />
        </>
      )}

      {tab === 'semesters' && (
        <>
          <div className="flex justify-end">
            <Button icon={Plus} size="sm" onClick={() => { setSemForm(emptySem); setAddSem(true); }}>New Semester</Button>
          </div>
          <Table columns={semCols} data={sems} loading={loading} emptyMessage="No semesters." />
        </>
      )}

      {/* Department Add/Edit */}
      <Modal isOpen={addDept || Boolean(editDept)} onClose={() => { setAddDept(false); setEditDept(null); }} title={editDept ? 'Edit Department' : 'New Department'} size="sm">
        <div className="space-y-3"><DeptForm /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => { setAddDept(false); setEditDept(null); }}>Cancel</Button><Button onClick={saveDept} loading={actionLoading}>{editDept ? 'Update' : 'Create'}</Button></div></div>
      </Modal>

      {/* Semester Add/Edit */}
      <Modal isOpen={addSem || Boolean(editSem)} onClose={() => { setAddSem(false); setEditSem(null); }} title={editSem ? 'Edit Semester' : 'New Semester'} size="md">
        <div className="space-y-3"><SemForm /><div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={() => { setAddSem(false); setEditSem(null); }}>Cancel</Button><Button onClick={saveSem} loading={actionLoading}>{editSem ? 'Update' : 'Create'}</Button></div></div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Delete Department"
        message={`Delete department "${deleteTarget?.name}"? This cannot be undone.`}
        confirmText="Delete" isDanger onConfirm={deleteDept} onCancel={() => setDeleteTarget(null)} loading={actionLoading} />
    </div>
  );
};

export default HODDeptSemesters;
