import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import { RefreshCw } from 'lucide-react';

const MyRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/enrollments/requests/');
      setRequests(data.results || data || []);
    } catch (err) {
      console.error('Failed to load student requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const columns = [
    {
      header: 'Course',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
            {row.offering?.course_code}
          </span>
          <div className="font-semibold text-slate-800 text-xs mt-1">
            {row.offering?.course_name}
          </div>
        </div>
      ),
    },
    {
      header: 'Faculty Instructor',
      render: (row) => <span className="text-xs">{row.offering?.faculty_name || 'TBA'}</span>,
    },
    {
      header: 'Semester',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row.offering?.academic_year} {row.offering?.semester_name}
        </span>
      ),
    },
    {
      header: 'Requested Date',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {new Date(row.request_date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Faculty Remarks / History',
      render: (row) => (
        <span className="text-xs text-slate-600 italic">
          {row.remarks ? `"${row.remarks}"` : <span className="text-slate-400">—</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Enrollment Requests</h2>
          <p className="text-xs text-slate-500">
            Track status updates and faculty review remarks for submitted course requests.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchRequests} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        columns={columns}
        data={requests}
        loading={loading}
        emptyMessage="You have not submitted any course enrollment requests yet."
      />
    </div>
  );
};

export default MyRequests;
