import React, { useState, useEffect } from 'react';
import { Award, BookOpen, CheckCircle, TrendingUp } from 'lucide-react';
import api from '../../api/client';
import Table from '../../components/shared/Table';
import Spinner from '../../components/shared/Spinner';

const AcademicRecord = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await api.get('/academic-record/');
        setData(res.data);
      } catch (err) {
        console.error('Failed to load academic records:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecord();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" className="text-indigo-600" />
      </div>
    );
  }

  const { student, records = [] } = data || {};

  const columns = [
    {
      header: 'Academic Term',
      render: (row) => (
        <span className="font-semibold text-slate-900 text-xs sm:text-sm">
          {row.academic_year} {row.semester_name}
        </span>
      ),
    },
    {
      header: 'Credits Registered',
      render: (row) => <span className="text-xs text-slate-700">{row.credits_registered}</span>,
    },
    {
      header: 'Credits Earned (GP ≥ 4)',
      render: (row) => (
        <span className="text-xs font-semibold text-emerald-600">{row.credits_earned}</span>
      ),
    },
    {
      header: 'Semester GPA (SGPA)',
      render: (row) => (
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
          {parseFloat(row.semester_gpa).toFixed(2)}
        </span>
      ),
    },
    {
      header: 'Cumulative CGPA',
      render: (row) => (
        <span className="text-xs font-bold text-slate-900">
          {parseFloat(row.cumulative_cgpa).toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Academic Performance Record</h2>
        <p className="text-xs text-slate-500">
          Official semester-by-semester Grade Point Average (GPA) and Cumulative CGPA ledger.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {student?.cgpa ? parseFloat(student.cgpa).toFixed(2) : '0.00'}
            </div>
            <div className="text-xs font-medium text-slate-400">Cumulative CGPA</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {student?.total_credits_earned || 0}
            </div>
            <div className="text-xs font-medium text-slate-400">Total Credits Earned</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{records.length}</div>
            <div className="text-xs font-medium text-slate-400">Semesters Recorded</div>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <Table
        columns={columns}
        data={records}
        emptyMessage="No completed academic semester records found yet."
      />
    </div>
  );
};

export default AcademicRecord;
