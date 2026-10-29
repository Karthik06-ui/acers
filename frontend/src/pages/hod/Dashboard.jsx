import React, { useState, useEffect } from 'react';
import { Users, BookOpen, Layers, CheckSquare, Clock, ShieldCheck, AlertCircle, GraduationCap } from 'lucide-react';
import api from '../../api/client';
import Badge from '../../components/shared/Badge';
import Spinner from '../../components/shared/Spinner';
import Table from '../../components/shared/Table';

// Recharts loaded lazily to keep bundle light
let BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell;
try {
  const r = require('recharts');
  ({ BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } = r);
} catch {
  BarChart = null;
}

const DEPT_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
    <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center shrink-0`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <div className="text-2xl font-black text-slate-900">{value ?? 0}</div>
      <div className="text-xs font-medium text-slate-400">{label}</div>
    </div>
  </div>
);

const HODDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/hod/dashboard/');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load HOD dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Spinner size="lg" className="text-indigo-600" /></div>;
  }

  const {
    totals = {},
    pending_faculty_approvals = 0,
    courses_at_capacity = [],
    last_10_audit_entries = [],
    enrollment_by_course = [],
    enrollment_by_department = [],
    pending_requests_count = 0,
  } = data || {};

  const auditColumns = [
    { header: 'Time', render: (r) => <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleString()}</span> },
    { header: 'Actor', render: (r) => <span className="font-semibold text-xs">{r.actor_email}</span> },
    { header: 'Action', render: (r) => <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{r.action}</span> },
    { header: 'Target', render: (r) => <span className="text-xs text-slate-500">{r.target_type} #{r.target_id}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <h2 className="text-2xl font-extrabold tracking-tight">HOD Administration</h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-300">
          Department-wide oversight — enrollments, capacity, faculty, and audit trail.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Students" value={totals.students} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={GraduationCap} label="Faculty Members" value={totals.faculty} color="bg-emerald-50 text-emerald-600" />
        <StatCard icon={BookOpen} label="Courses" value={totals.courses} color="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckSquare} label="Active Enrollments" value={totals.active_enrollments} color="bg-purple-50 text-purple-600" />
        <StatCard icon={Clock} label="Pending Faculty Approvals" value={pending_faculty_approvals} color="bg-amber-50 text-amber-600" />
        <StatCard icon={AlertCircle} label="Pending Requests" value={pending_requests_count} color="bg-rose-50 text-rose-600" />
        <StatCard icon={Layers} label="Offerings at Capacity" value={courses_at_capacity.length} color="bg-orange-50 text-orange-600" />
        <StatCard icon={ShieldCheck} label="Audit Events" value={last_10_audit_entries.length ? '10+' : 0} color="bg-slate-100 text-slate-600" />
      </div>

      {/* Charts */}
      {BarChart && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {enrollment_by_course.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Enrollments by Course</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enrollment_by_course} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="course_code" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Enrolled']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {enrollment_by_course.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {enrollment_by_department.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Enrollments by Department</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enrollment_by_department} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="dept_code" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [v, 'Enrolled']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {enrollment_by_department.map((_, i) => (
                      <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Courses at Capacity */}
      {courses_at_capacity.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Offerings at Maximum Capacity ({courses_at_capacity.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courses_at_capacity.map((c, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">{c.course_code}</span>
                  <Badge status="Closed">Full</Badge>
                </div>
                <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{c.course_name}</h4>
                <p className="text-[11px] text-slate-400">{c.faculty}</p>
                <div className="text-xs font-bold text-rose-600">{c.active_enrolled} / {c.capacity} seats</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Audit */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Recent Admin Activity</h3>
        <Table columns={auditColumns} data={last_10_audit_entries} emptyMessage="No audit entries yet." />
      </div>
    </div>
  );
};

export default HODDashboard;
