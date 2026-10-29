import React, { useState, useEffect } from 'react';
import { Check, X, Filter, RefreshCw, Eye, AlertCircle } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Pagination from '../../components/shared/Pagination';

const FacultyRequests = () => {
  const toast = useToast();
  const [requests, setRequests] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [offeringFilter, setOfferingFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Detail Drawer / Modal
  const [selectedReq, setSelectedReq] = useState(null);

  // Action (Approve / Reject) State
  const [actionTarget, setActionTarget] = useState(null); // { req, type: 'approve' | 'reject' }
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Load faculty's offerings for filtering
  useEffect(() => {
    const fetchOfferings = async () => {
      try {
        const { data } = await api.get('/academics/offerings/');
        setOfferings(data.results || data || []);
      } catch {}
    };
    fetchOfferings();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      let url = `/faculty/requests/?page=${page}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (offeringFilter) url += `&offering=${offeringFilter}`;

      const { data } = await api.get(url);
      setRequests(data.results || data || []);
      setTotalCount(data.count || (data.results ? data.results.length : 0));
    } catch (err) {
      toast.error('Failed to load enrollment requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, statusFilter, offeringFilter]);

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    setActionError('');

    if (actionTarget.type === 'reject' && !remarks.trim()) {
      setActionError('Remarks are mandatory when rejecting an enrollment request.');
      return;
    }

    setActionLoading(true);
    try {
      const url = `/faculty/requests/${actionTarget.req.id}/${actionTarget.type}/`;
      await api.post(url, { remarks });
      toast.success(
        `Request #${actionTarget.req.id} ${
          actionTarget.type === 'approve' ? 'approved' : 'rejected'
        } successfully!`
      );
      setActionTarget(null);
      setRemarks('');
      if (selectedReq?.id === actionTarget.req.id) {
        setSelectedReq(null);
      }
      fetchRequests();
    } catch (err) {
      const msg = err.normalizedMessage || `Failed to ${actionTarget.type} request.`;
      setActionError(msg);
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      header: 'Student Details',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{row.student?.name}</div>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            Roll: {row.student?.roll_no} • Year {row.student?.year}
          </div>
        </div>
      ),
    },
    {
      header: 'Course Code & Name',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
            {row.offering?.course_code}
          </span>
          <div className="text-xs text-slate-700 font-semibold mt-1">
            {row.offering?.course_name}
          </div>
        </div>
      ),
    },
    {
      header: 'Student CGPA',
      render: (row) => (
        <span className="text-xs font-bold text-slate-800">
          {row.student?.cgpa ? parseFloat(row.student.cgpa).toFixed(2) : '0.00'}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Requested Date',
      render: (row) => (
        <span className="text-xs text-slate-400">
          {new Date(row.request_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={() => setSelectedReq(row)}
            title="View Details"
          >
            Details
          </Button>

          {row.status === 'Pending' && (
            <>
              <Button
                size="sm"
                variant="success"
                icon={Check}
                onClick={() => {
                  setActionTarget({ req: row, type: 'approve' });
                  setRemarks('');
                  setActionError('');
                }}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                icon={X}
                onClick={() => {
                  setActionTarget({ req: row, type: 'reject' });
                  setRemarks('');
                  setActionError('');
                }}
              >
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Student Enrollment Requests</h2>
          <p className="text-xs text-slate-500">
            Review student applications for your assigned course offerings.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>

          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchRequests} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      <Table
        columns={columns}
        data={requests}
        loading={loading}
        emptyMessage="No enrollment requests found matching the selected filters."
      />

      <Pagination
        currentPage={page}
        totalCount={totalCount}
        pageSize={10}
        onPageChange={(p) => setPage(p)}
      />

      {/* Student Info Detail Drawer / Modal */}
      {selectedReq && (
        <Modal
          isOpen={Boolean(selectedReq)}
          onClose={() => setSelectedReq(null)}
          title={`Enrollment Request #${selectedReq.id} — Student Dossier`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Student Full Name</span>
                <span className="font-bold text-slate-900 text-sm">{selectedReq.student?.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Roll Number</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {selectedReq.student?.roll_no}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Department</span>
                <span className="font-semibold text-slate-800">
                  {selectedReq.student?.department_name ||
                    selectedReq.student?.department_code ||
                    'General'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Academic Year</span>
                <span className="font-semibold text-slate-800">Year {selectedReq.student?.year}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Cumulative CGPA</span>
                <span className="font-black text-indigo-700 text-base">
                  {selectedReq.student?.cgpa ? parseFloat(selectedReq.student.cgpa).toFixed(2) : '0.00'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase">Request Status</span>
                <div className="mt-0.5">
                  <Badge status={selectedReq.status} />
                </div>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-800 block">Requested Course Offering</span>
              <p className="text-slate-600">
                {selectedReq.offering?.course_code} - {selectedReq.offering?.course_name} (
                {selectedReq.offering?.credits} Credits)
              </p>
              <p className="text-[11px] text-slate-400">
                Term: {selectedReq.offering?.academic_year} {selectedReq.offering?.semester_name}
              </p>
            </div>

            {selectedReq.remarks && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                <span className="font-bold block text-[11px]">Faculty Review Remarks:</span>
                <p className="italic mt-0.5">{selectedReq.remarks}</p>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
              <Button variant="secondary" size="sm" onClick={() => setSelectedReq(null)}>
                Close
              </Button>

              {selectedReq.status === 'Pending' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setActionTarget({ req: selectedReq, type: 'reject' });
                      setRemarks('');
                      setActionError('');
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => {
                      setActionTarget({ req: selectedReq, type: 'approve' });
                      setRemarks('');
                      setActionError('');
                    }}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Action Approval / Rejection Confirmation Modal with Error Feedback */}
      {actionTarget && (
        <Modal
          isOpen={Boolean(actionTarget)}
          onClose={() => setActionTarget(null)}
          title={`${actionTarget.type === 'approve' ? 'Approve' : 'Reject'} Request #${
            actionTarget.req.id
          }`}
          size="sm"
        >
          <form onSubmit={handleActionSubmit} className="space-y-4">
            {actionError && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-700 border border-slate-100">
              <p>
                <strong>Student:</strong> {actionTarget.req.student?.name} (
                {actionTarget.req.student?.roll_no})
              </p>
              <p>
                <strong>Course:</strong> {actionTarget.req.offering?.course_code} -{' '}
                {actionTarget.req.offering?.course_name}
              </p>
            </div>

            <Input
              label={
                actionTarget.type === 'reject'
                  ? 'Rejection Remarks (Mandatory)'
                  : 'Approval Remarks (Optional)'
              }
              required={actionTarget.type === 'reject'}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={
                actionTarget.type === 'reject'
                  ? 'Explain why this request is rejected (e.g. course full, prerequisites)'
                  : 'Optional note for student'
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
                Confirm {actionTarget.type === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default FacultyRequests;
