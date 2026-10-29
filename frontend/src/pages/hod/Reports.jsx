import React, { useState, useEffect } from 'react';
import { Download, FileText, Filter, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/shared/Button';
import Spinner from '../../components/shared/Spinner';

const HODReports = () => {
  const toast = useToast();
  const [reportType, setReportType] = useState('enrollment-by-course');
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);

  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [dRes, sRes] = await Promise.all([
          api.get('/academics/departments/'),
          api.get('/academics/semesters/'),
        ]);
        setDepartments(dRes.data.results || dRes.data || []);
        setSemesters(sRes.data.results || sRes.data || []);
      } catch {}
    };
    fetchMeta();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      let url = `/hod/reports/?type=${reportType}&format=json`;
      if (selectedDept) url += `&department=${selectedDept}`;
      if (selectedSem) url += `&semester=${selectedSem}`;

      const res = await api.get(url);
      setData(res.data.results || []);
    } catch {
      toast.error('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDept, selectedSem]);

  const handleDownloadCSV = () => {
    let url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/hod/reports/?type=${reportType}&format=csv`;
    if (selectedDept) url += `&department=${selectedDept}`;
    if (selectedSem) url += `&semester=${selectedSem}`;

    const token = localStorage.getItem('access_token');
    // Fetch CSV with auth token
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${reportType}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success(`Downloaded ${reportType}.csv!`);
      })
      .catch(() => toast.error('Failed to export CSV.'));
  };

  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Department Analytics & Reports</h2>
          <p className="text-xs text-slate-500">
            Export official course enrollment, faculty load, and student academic summary reports.
          </p>
        </div>

        <Button icon={Download} size="sm" onClick={handleDownloadCSV} disabled={data.length === 0}>
          Export CSV
        </Button>
      </div>

      {/* Report Controls */}
      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
            Report Type
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="enrollment-by-course">Enrollment by Course Offering</option>
            <option value="enrollment-by-department">Enrollment by Department</option>
            <option value="faculty-load">Faculty Teaching Load</option>
            <option value="student-academic-summary">Student Academic Summary</option>
            <option value="pending-requests">Pending Requests Ledger</option>
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
            Department
          </label>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
            Semester
          </label>
          <select
            value={selectedSem}
            onChange={(e) => setSelectedSem(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.academic_year} {s.semester_name}
              </option>
            ))}
          </select>
        </div>

        <div className="self-end">
          <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchReport} loading={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Data Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-100 text-xs text-slate-400">
          No records match the current report filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
            <thead className="bg-slate-50 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-5 py-3.5 whitespace-nowrap">
                    {h.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  {headers.map((h) => (
                    <td key={h} className="px-5 py-3.5 whitespace-nowrap text-slate-700 font-medium">
                      {String(row[h] !== null && row[h] !== undefined ? row[h] : '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HODReports;
