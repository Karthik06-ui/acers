import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Users,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Check,
  X,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Spinner from '../../components/shared/Spinner';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';

const FacultyDashboard = () => {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal State
  const [actionTarget, setActionTarget] = useState(null); // { req, type: 'approve' | 'reject' }
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/faculty/dashboard/');
      setData(res.data);
    } catch (err) {
      console.error('Failed to load faculty dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (actionTarget.type === 'reject' && !remarks.trim()) {
      toast.error('Remarks are required when rejecting a request.');
      return;
    }

    setActionLoading(true);
    try {
      const url = `/faculty/requests/${actionTarget.req.id}/${actionTarget.type}/`;
      await api.post(url, { remarks });
      toast.success(
        `Request #${actionTarget.req.id} ${
          actionTarget.type === 'approve' ? 'approved' : 'rejected'
        } successfully.`
      );
      setActionTarget(null);
      setRemarks('');
      fetchDashboard();
    } catch (err) {
      toast.error(err.normalizedMessage || `Failed to ${actionTarget.type} request.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  const {
    faculty,
    offerings_count = 0,
    active_students_count = 0,
    pending_requests_count = 0,
    offerings = [],
    recent_requests = [],
  } = data || {};

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-200 mb-2 border border-white/10">
              <span>{faculty?.designation}</span>
              <span>•</span>
              <span>{faculty?.department || 'Academic Faculty'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {faculty?.name}!
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              Manage your course offerings, review student requests, and grade completed enrollments.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              to="/faculty/requests"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-md shadow-indigo-900/50 transition"
            >
              Review Requests ({pending_requests_count})
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{offerings_count}</div>
            <div className="text-xs font-medium text-slate-400">Assigned Offerings</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{active_students_count}</div>
            <div className="text-xs font-medium text-slate-400">Total Enrolled Students</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{pending_requests_count}</div>
            <div className="text-xs font-medium text-slate-400">Pending Approvals</div>
          </div>
        </div>
      </div>

      {/* Offerings Seat Usage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Current Course Offerings & Seat Capacity
          </h3>
          <Link
            to="/faculty/courses"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Manage Courses <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {offerings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400">
            No course offerings assigned for this semester.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {offerings.map((o) => {
              const enrolled = o.active_enrolled || 0;
              const cap = o.capacity || 1;
              const percentage = Math.min(100, Math.round((enrolled / cap) * 100));

              return (
                <div
                  key={o.id}
                  className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {o.course_code}
                    </span>
                    <Badge status={o.status} />
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-800 line-clamp-1">{o.course_name}</h4>
                    <span className="text-[11px] text-slate-400">{o.semester}</span>
                  </div>

                  {/* Seat Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Seat Occupancy</span>
                      <span className="font-semibold text-slate-800">
                        {enrolled} / {cap} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          percentage >= 100
                            ? 'bg-rose-500'
                            : percentage >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-between items-center text-xs">
                    <span className="text-slate-400">Available:</span>
                    <span className="font-bold text-slate-700">
                      {o.seats_available !== undefined ? o.seats_available : cap - enrolled} seats
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending Requests Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Pending Student Enrollment Requests
          </h3>
          <Link
            to="/faculty/requests"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            All requests <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recent_requests.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-100 text-center text-xs text-slate-400 shadow-sm">
            No pending enrollment requests. You are all caught up!
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-6 py-3">Student Name & Roll No</th>
                  <th className="px-6 py-3">Course</th>
                  <th className="px-6 py-3">CGPA</th>
                  <th className="px-6 py-3">Submitted</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recent_requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5">
                      <div className="font-semibold text-slate-900">{r.student?.name}</div>
                      <div className="text-[11px] text-slate-400">{r.student?.roll_no}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {r.offering?.course_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-bold text-slate-800">
                        {r.student?.cgpa ? parseFloat(r.student.cgpa).toFixed(2) : '0.00'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-400 text-xs">
                      {new Date(r.request_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="success"
                        icon={Check}
                        onClick={() => setActionTarget({ req: r, type: 'approve' })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={X}
                        onClick={() => setActionTarget({ req: r, type: 'reject' })}
                      >
                        Reject
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {actionTarget && (
        <Modal
          isOpen={Boolean(actionTarget)}
          onClose={() => setActionTarget(null)}
          title={`${actionTarget.type === 'approve' ? 'Approve' : 'Reject'} Enrollment Request`}
          size="sm"
        >
          <form onSubmit={handleActionSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-100">
              <p>
                <strong>Student:</strong> {actionTarget.req.student?.name} (
                {actionTarget.req.student?.roll_no})
              </p>
              <p>
                <strong>Course:</strong> {actionTarget.req.offering?.course_code} -{' '}
                {actionTarget.req.offering?.course_name}
              </p>
              <p>
                <strong>Current CGPA:</strong>{' '}
                {actionTarget.req.student?.cgpa
                  ? parseFloat(actionTarget.req.student.cgpa).toFixed(2)
                  : '0.00'}
              </p>
            </div>

            <Input
              label={actionTarget.type === 'reject' ? 'Rejection Reason (Required)' : 'Optional Remarks'}
              required={actionTarget.type === 'reject'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                actionTarget.type === 'reject'
                  ? 'e.g. Ineligible or prerequisites not met'
                  : 'e.g. Welcome to class'
              }
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setActionTarget(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant={actionTarget.type === 'approve' ? 'primary' : 'danger'}
                loading={actionLoading}
              >
                Confirm {actionTarget.type === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default FacultyDashboard;
