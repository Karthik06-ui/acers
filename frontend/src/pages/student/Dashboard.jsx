import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Send,
  Award,
  CheckSquare,
  Clock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import api from '../../api/client';
import Badge from '../../components/shared/Badge';
import Spinner from '../../components/shared/Spinner';

const StudentDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/student/dashboard/');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load student dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  const {
    profile,
    cgpa,
    credits_earned,
    active_count,
    pending_requests,
    recent_status_changes = [],
    active_courses = [],
  } = data || {};

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 p-6 sm:p-8 text-white shadow-xl shadow-indigo-100">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-indigo-100 mb-3 border border-white/10">
            <span>Roll No: {profile?.roll_no}</span>
            <span>•</span>
            <span>Year {profile?.year}</span>
            <span>•</span>
            <span>{profile?.department || 'Department Student'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {profile?.name}!
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-indigo-100 max-w-xl">
            Track your semester registrations, academic performance, and enroll in available course
            offerings.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/student/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 shadow-sm transition"
            >
              <BookOpen className="w-4 h-4" /> Browse Courses
            </Link>
            <Link
              to="/student/requests"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md px-4 py-2 text-xs font-bold text-white border border-white/20 transition"
            >
              <Send className="w-4 h-4" /> My Requests ({pending_requests})
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{cgpa || '0.00'}</div>
            <div className="text-xs font-medium text-slate-400">Cumulative CGPA</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{credits_earned || 0}</div>
            <div className="text-xs font-medium text-slate-400">Credits Earned</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{active_count || 0}</div>
            <div className="text-xs font-medium text-slate-400">Active Courses</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800">{pending_requests || 0}</div>
            <div className="text-xs font-medium text-slate-400">Pending Requests</div>
          </div>
        </div>
      </div>

      {/* Main Content: Active Courses & Recent Status Changes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Courses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Enrolled Courses ({active_courses.length})
            </h3>
            <Link
              to="/student/enrollments"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {active_courses.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
              <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No active course enrollments yet.</p>
              <Link
                to="/student/courses"
                className="mt-3 inline-block text-xs font-bold text-indigo-600 hover:underline"
              >
                Browse available course offerings →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {active_courses.map((c) => (
                <div
                  key={c.enrollment_id}
                  className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {c.course_code}
                    </span>
                    <Badge status="Active" />
                  </div>
                  <h4 className="mt-2 text-sm font-semibold text-slate-800 line-clamp-1">
                    {c.course_name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">Faculty: {c.faculty}</p>
                  <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{c.credits} Credits</span>
                    <span>{c.semester}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Updates */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Request Activity
            </h3>
            <Link
              to="/student/requests"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              History <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-3">
            {recent_status_changes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No recent activity.</p>
            ) : (
              recent_status_changes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 pb-3 border-b border-slate-50 last:border-none last:pb-0"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-800">{item.course_code}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(item.updated_at).toLocaleDateString()}
                    </div>
                    {item.remarks && (
                      <div className="text-[10px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded-lg">
                        "{item.remarks}"
                      </div>
                    )}
                  </div>
                  <Badge status={item.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
