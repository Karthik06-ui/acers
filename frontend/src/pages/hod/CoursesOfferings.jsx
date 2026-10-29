import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, Users, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Pagination from '../../components/shared/Pagination';
import ConfirmDialog from '../../components/shared/ConfirmDialog';

const PAGE_SIZE = 20;

const emptyOffering = { course: '', faculty: '', semester: '', capacity: 30, status: 'Open' };
const emptyCourse = { code: '', name: '', credits: 3, course_type: 'Theory', department: '', status: 'Open', minimum_cgpa: '' };

const HODCoursesOfferings = () => {
  const toast = useToast();
  const [tab, setTab] = useState('offerings'); // offerings | courses

  // Offerings state
  const [offerings, setOfferings] = useState([]);
  const [offerPage, setOfferPage] = useState(1);
  const [offerTotal, setOfferTotal] = useState(0);
  const [loadingOff, setLoadingOff] = useState(true);
  const [semFilter, setSemFilter] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('');

  // Courses state
  const [courses, setCourses] = useState([]);
  const [courseSearch, setCourseSearch] = useState('');
  const [loadingCourse, setLoadingCourse] = useState(true);

  // Supporting lists
  const [semesters, setSemesters] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modals
  const [addOffering, setAddOffering] = useState(false);
  const [editOffering, setEditOffering] = useState(null);
  const [addCourse, setAddCourse] = useState(false);
  const [editCourse, setEditCourse] = useState(null);
  const [offeringForm, setOfferingForm] = useState(emptyOffering);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [studentsModal, setStudentsModal] = useState(null); // offering to view students
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch supporting data
  useEffect(() => {
    api.get('/academics/semesters/').then(({ data }) => setSemesters(data.results || data || [])).catch(() => {});
    api.get('/auth/hod/faculty/?status=active&page_size=100').then(({ data }) => setFacultyList(data.results || data || [])).catch(() => {});
    api.get('/academics/departments/').then(({ data }) => setDepartments(data.results || data || [])).catch(() => {});
  }, []);

  const fetchOfferings = useCallback(async () => {
    setLoadingOff(true);
    try {
      let url = `/academics/offerings/?page=${offerPage}&page_size=${PAGE_SIZE}`;
      if (semFilter) url += `&semester=${semFilter}`;
      if (facultyFilter) url += `&faculty=${facultyFilter}`;
      const { data } = await api.get(url);
      setOfferings(data.results || data || []);
      setOfferTotal(data.count || 0);
    } catch { toast.error('Failed to load offerings.'); }
    finally { setLoadingOff(false); }
  }, [offerPage, semFilter, facultyFilter]);

  const fetchCourses = useCallback(async () => {
    setLoadingCourse(true);
    try {
      let url = '/academics/courses/?page_size=200';
      if (courseSearch) url += `&search=${encodeURIComponent(courseSearch)}`;
      const { data } = await api.get(url);
      setCourses(data.results || data || []);
    } catch { toast.error('Failed to load courses.'); }
    finally { setLoadingCourse(false); }
  }, [courseSearch]);

  useEffect(() => { fetchOfferings(); }, [fetchOfferings]);
  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const viewEnrolledStudents = async (offering) => {
    setStudentsModal(offering);
    try {
      const { data } = await api.get(`/faculty/offerings/${offering.id}/students/`);
      setEnrolledStudents(data.results || data || []);
    } catch { setEnrolledStudents([]); }
  };

  const saveOffering = async () => {
    setActionLoading(true);
    try {
      if (editOffering) {
        await api.patch(`/academics/offerings/${editOffering.id}/`, offeringForm);
        toast.success('Offering updated.');
        setEditOffering(null);
      } else {
        await api.post('/academics/offerings/', offeringForm);
        toast.success('Offering created.');
        setAddOffering(false);
      }
      setOfferingForm(emptyOffering);
      fetchOfferings();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const deleteOffering = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/academics/offerings/${deleteTarget.id}/`);
      toast.success('Offering deleted.');
      setDeleteTarget(null);
      fetchOfferings();
    } catch (err) { toast.error(err.normalizedMessage || 'Cannot delete.'); }
    finally { setActionLoading(false); }
  };

  const saveCourse = async () => {
    setActionLoading(true);
    try {
      const payload = { ...courseForm };
      if (!payload.minimum_cgpa) delete payload.minimum_cgpa;
      if (editCourse) {
        await api.patch(`/academics/courses/${editCourse.id}/`, payload);
        toast.success('Course updated.');
        setEditCourse(null);
      } else {
        await api.post('/academics/courses/', payload);
        toast.success('Course created.');
        setAddCourse(false);
      }
      setCourseForm(emptyCourse);
      fetchCourses();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const archiveCourse = async (course) => {
    setActionLoading(true);
    try {
      await api.delete(`/academics/courses/${course.id}/`);
      toast.success(`Course ${course.code} archived/deleted.`);
      fetchCourses();
    } catch (err) { toast.error(err.normalizedMessage || 'Failed.'); }
    finally { setActionLoading(false); }
  };

  const tabCls = (t) => `px-4 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`;

  const OfferingForm = ({ form, setForm }) => (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Course</label>
        <select value={form.course} onChange={e => setForm(f => ({ ...f, course: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select course…</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Faculty</label>
        <select value={form.faculty} onChange={e => setForm(f => ({ ...f, faculty: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select faculty…</option>
          {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Semester</label>
        <select value={form.semester} onChange={e => setForm(f => ({ ...f, semester: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select semester…</option>
          {semesters.map(s => <option key={s.id} value={s.id}>{s.academic_year} {s.semester_name} ({s.status})</option>)}
        </select>
      </div>
      <Input label="Capacity" id="off-capacity" type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['Open','Closed','Draft','Archived'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );

  const CourseForm = ({ form, setForm }) => (
    <div className="space-y-3">
      <Input label="Course Code" id="crs-code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
      <Input label="Course Name" id="crs-name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Credits" id="crs-credits" type="number" min={1} max={6} value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} />
        <Input label="Min CGPA (optional)" id="crs-cgpa" type="number" step="0.01" value={form.minimum_cgpa} onChange={e => setForm(f => ({ ...f, minimum_cgpa: e.target.value }))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Type</label>
        <select value={form.course_type} onChange={e => setForm(f => ({ ...f, course_type: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {['Theory','Lab','Theory+Lab'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1">Department</label>
        <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg text-xs p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select department…</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
        </select>
      </div>
    </div>
  );

  const offerCols = [
    { header: 'Course', render: (r) => <div><span className="font-mono text-xs font-bold text-indigo-700">{r.course_code}</span><div className="text-[11px] text-slate-500">{r.course_name}</div></div> },
    { header: 'Faculty', render: (r) => <span className="text-xs">{r.faculty_name}</span> },
    { header: 'Semester', render: (r) => <span className="text-xs">{r.academic_year} {r.semester_name}</span> },
    { header: 'Seats', render: (r) => <span className={`text-xs font-bold ${r.seats_available === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.seats_available}/{r.capacity} left</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" icon={Users} onClick={() => viewEnrolledStudents(r)}>Students</Button>
          <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditOffering(r); setOfferingForm({ course: r.course, faculty: r.faculty, semester: r.semester, capacity: r.capacity, status: r.status }); }}>Edit</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => setDeleteTarget(r)}>Del</Button>
        </div>
      )
    },
  ];

  const courseCols = [
    { header: 'Code', render: (r) => <span className="font-mono text-xs font-bold text-indigo-700">{r.code}</span> },
    { header: 'Name', render: (r) => <span className="text-xs">{r.name}</span> },
    { header: 'Credits', render: (r) => <span className="text-xs">{r.credits}</span> },
    { header: 'Type', render: (r) => <span className="text-xs">{r.course_type}</span> },
    { header: 'Status', render: (r) => <Badge status={r.status}>{r.status}</Badge> },
    {
      header: 'Actions', render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" icon={Edit} onClick={() => { setEditCourse(r); setCourseForm({ code: r.code, name: r.name, credits: r.credits, course_type: r.course_type, department: r.department || '', status: r.status, minimum_cgpa: r.minimum_cgpa || '' }); }}>Edit</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => archiveCourse(r)} loading={actionLoading}>Archive</Button>
        </div>
      )
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Courses & Offerings</h2>
          <p className="text-xs text-slate-500">Full CRUD for courses and course offerings.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {['offerings', 'courses'].map(t => <button key={t} className={tabCls(t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}
      </div>

      {tab === 'offerings' && (
        <>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={semFilter} onChange={e => { setSemFilter(e.target.value); setOfferPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Semesters</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.academic_year} {s.semester_name}</option>)}
            </select>
            <select value={facultyFilter} onChange={e => { setFacultyFilter(e.target.value); setOfferPage(1); }}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All Faculty</option>
              {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <Button icon={RefreshCw} size="sm" variant="secondary" onClick={fetchOfferings}>Refresh</Button>
            <Button icon={Plus} size="sm" onClick={() => { setOfferingForm(emptyOffering); setAddOffering(true); }}>New Offering</Button>
          </div>
          <Table columns={offerCols} data={offerings} loading={loadingOff} emptyMessage="No offerings found." />
          <Pagination page={offerPage} pageSize={PAGE_SIZE} total={offerTotal} onPageChange={setOfferPage} />
        </>
      )}

      {tab === 'courses' && (
        <>
          <div className="flex gap-2 items-center">
            <input value={courseSearch} onChange={e => setCourseSearch(e.target.value)} placeholder="Search courses…"
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
            <Button icon={Plus} size="sm" onClick={() => { setCourseForm(emptyCourse); setAddCourse(true); }}>New Course</Button>
          </div>
          <Table columns={courseCols} data={courses} loading={loadingCourse} emptyMessage="No courses found." />
        </>
      )}

      {/* Add/Edit Offering Modal */}
      <Modal isOpen={addOffering || Boolean(editOffering)} onClose={() => { setAddOffering(false); setEditOffering(null); }} title={editOffering ? 'Edit Offering' : 'New Offering'} size="md">
        <div className="space-y-3">
          <OfferingForm form={offeringForm} setForm={setOfferingForm} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setAddOffering(false); setEditOffering(null); }}>Cancel</Button>
            <Button onClick={saveOffering} loading={actionLoading}>{editOffering ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Course Modal */}
      <Modal isOpen={addCourse || Boolean(editCourse)} onClose={() => { setAddCourse(false); setEditCourse(null); }} title={editCourse ? 'Edit Course' : 'New Course'} size="md">
        <div className="space-y-3">
          <CourseForm form={courseForm} setForm={setCourseForm} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setAddCourse(false); setEditCourse(null); }}>Cancel</Button>
            <Button onClick={saveCourse} loading={actionLoading}>{editCourse ? 'Update' : 'Create'}</Button>
          </div>
        </div>
      </Modal>

      {/* Enrolled Students Modal */}
      <Modal isOpen={Boolean(studentsModal)} onClose={() => setStudentsModal(null)} title={`Students — ${studentsModal?.course_code}`} size="md">
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {enrolledStudents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No enrolled students.</p>
          ) : enrolledStudents.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <div className="text-xs font-semibold">{e.student?.name}</div>
                <div className="text-[11px] font-mono text-slate-400">{e.student?.roll_no}</div>
              </div>
              <Badge status={e.status}>{e.status}</Badge>
            </div>
          ))}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Delete Offering"
        message={`Delete the offering for ${deleteTarget?.course_code}? This cannot be undone if no enrollments exist.`}
        confirmText="Delete" isDanger onConfirm={deleteOffering} onCancel={() => setDeleteTarget(null)} loading={actionLoading} />
    </div>
  );
};

export default HODCoursesOfferings;
