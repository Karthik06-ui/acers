import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import { LogOut, RefreshCw } from 'lucide-react';

const MyEnrollments = () => {
  const toast = useToast();
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/enrollments/my/');
      setEnrollments(data.results || data || []);
    } catch (err) {
      console.error('Failed to load student enrollments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, []);

  const handleWithdrawConfirm = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      await api.post(`/enrollments/${withdrawTarget.id}/withdraw/`);
      toast.success(
        `Successfully withdrawn from ${withdrawTarget.offering?.course_code || 'course'}.`
      );
      setWithdrawTarget(null);
      fetchEnrollments();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to withdraw from course.');
    } finally {
      setWithdrawing(false);
    }
  };

  const columns = [
    {
      header: 'Course Code & Name',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            {row.offering?.course_code}
          </span>
          <div className="font-semibold text-slate-800 text-xs mt-1">
            {row.offering?.course_name}
          </div>
          <span className="text-[11px] text-slate-400">
            {row.offering?.credits} Credits
          </span>
        </div>
      ),
    },
    {
      header: 'Faculty Instructor',
      render: (row) => <span className="text-xs">{row.offering?.faculty_name || 'TBA'}</span>,
    },
    {
      header: 'Enrolled Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.enrollment_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Grade Points',
      render: (row) => (
        <span className="text-xs font-bold text-slate-700">
          {row.grade_points !== null && row.grade_points !== undefined
            ? parseFloat(row.grade_points).toFixed(2)
            : '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) =>
        row.status === 'Active' ? (
          <Button
            variant="danger"
            size="sm"
            icon={LogOut}
            onClick={() => setWithdrawTarget(row)}
          >
            Withdraw
          </Button>
        ) : (
          <span className="text-xs text-slate-400 italic">No action</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Course Enrollments</h2>
          <p className="text-xs text-slate-500">
            Manage your active course registrations and view completion grade history.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchEnrollments} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        columns={columns}
        data={enrollments}
        loading={loading}
        emptyMessage="You have no current or past course enrollments."
      />

      {/* Confirm Withdrawal Modal */}
      <ConfirmDialog
        isOpen={Boolean(withdrawTarget)}
        title="Withdraw from Course"
        message={`Are you sure you want to withdraw from ${
          withdrawTarget?.offering?.course_code
        } (${withdrawTarget?.offering?.course_name})? This will free up your seat and update your status to Withdrawn.`}
        confirmText="Confirm Withdrawal"
        isDanger={true}
        loading={withdrawing}
        onConfirm={handleWithdrawConfirm}
        onCancel={() => setWithdrawTarget(null)}
      />
    </div>
  );
};

export default MyEnrollments;
