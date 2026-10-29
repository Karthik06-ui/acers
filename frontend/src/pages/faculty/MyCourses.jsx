import React, { useState, useEffect } from 'react';
import { Users, Award, Edit3, CheckCircle, RefreshCw, Layers } from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Table from '../../components/shared/Table';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Modal from '../../components/shared/Modal';
import Input from '../../components/shared/Input';
import Spinner from '../../components/shared/Spinner';

const MyCourses = () => {
  const toast = useToast();
  const [offerings, setOfferings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Enrolled Students Modal State
  const [activeOffering, setActiveOffering] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Mark Completed / Grade Modal State
  const [gradeTarget, setGradeTarget] = useState(null); // enrollment obj
  const [gradePoints, setGradePoints] = useState('');
  const [grading, setGrading] = useState(false);

  // Edit Capacity Modal State
  const [editOffering, setEditOffering] = useState(null);
  const [newCapacity, setNewCapacity] = useState('');
  const [newMinCgpa, setNewMinCgpa] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchOfferings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/faculty/dashboard/');
      setOfferings(res.data.offerings || []);
    } catch {
      toast.error('Failed to load course offerings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, []);

  const handleOpenStudents = async (offering) => {
    setActiveOffering(offering);
    setLoadingStudents(true);
    try {
      const { data } = await api.get(`/faculty/offerings/${offering.id}/students/`);
      setStudents(data.results || data || []);
    } catch {
      toast.error('Failed to load enrolled students.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    const gp = parseFloat(gradePoints);
    if (isNaN(gp) || gp < 0 || gp > 10) {
      toast.error('Grade points must be a number between 0.00 and 10.00.');
      return;
    }

    setGrading(true);
    try {
      await api.post(`/faculty/enrollments/${gradeTarget.id}/complete/`, {
        grade_points: gp.toFixed(2),
      });
      toast.success(
        `Grade points (${gp.toFixed(2)}) assigned to ${gradeTarget.student?.name}!`
      );
      setGradeTarget(null);
      setGradePoints('');

      // Refresh students modal list
      if (activeOffering) {
        handleOpenStudents(activeOffering);
      }
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to submit grade points.');
    } finally {
      setGrading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      if (newCapacity) {
        await api.patch(`/academics/offerings/${editOffering.id}/`, {
          capacity: parseInt(newCapacity, 10),
        });
      }
      toast.success('Course offering capacity updated successfully!');
      setEditOffering(null);
      fetchOfferings();
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to update offering details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const columns = [
    {
      header: 'Course Code & Name',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
            {row.course_code}
          </span>
          <div className="font-bold text-slate-900 text-xs sm:text-sm mt-1.5">
            {row.course_name}
          </div>
        </div>
      ),
    },
    {
      header: 'Academic Term',
      render: (row) => <span className="text-xs text-slate-500">{row.semester}</span>,
    },
    {
      header: 'Enrollment / Capacity',
      render: (row) => (
        <div>
          <span className="text-xs font-bold text-slate-800">
            {row.active_enrolled} / {row.capacity} Enrolled
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {row.seats_available} seats remaining
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => <Badge status={row.status} />,
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={Users}
            onClick={() => handleOpenStudents(row)}
          >
            Enrolled Students ({row.active_enrolled})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Edit3}
            onClick={() => {
              setEditOffering(row);
              setNewCapacity(row.capacity);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Course Offerings</h2>
          <p className="text-xs text-slate-500">
            Manage your taught offerings, update seat capacity, and grade student completions.
          </p>
        </div>
        <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchOfferings} loading={loading}>
          Refresh
        </Button>
      </div>

      <Table
        columns={columns}
        data={offerings}
        loading={loading}
        emptyMessage="You have no courses assigned for the active academic term."
      />

      {/* Enrolled Students Modal */}
      {activeOffering && (
        <Modal
          isOpen={Boolean(activeOffering)}
          onClose={() => setActiveOffering(null)}
          title={`Enrolled Students — ${activeOffering.course_code} (${activeOffering.course_name})`}
          size="lg"
        >
          <div className="space-y-4">
            {loadingStudents ? (
              <div className="py-12 text-center">
                <Spinner size="md" className="text-indigo-600 mb-2 inline-block" />
                <p className="text-xs text-slate-400">Loading student roster...</p>
              </div>
            ) : students.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                No students currently enrolled in this offering.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                  <thead className="bg-slate-50 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Roll No</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Department & Year</th>
                      <th className="px-4 py-3">Enrollment Status</th>
                      <th className="px-4 py-3">Grade Points</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {students.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {e.student?.roll_no}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{e.student?.name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {e.student?.department_code || 'CS'} • Yr {e.student?.year}
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={e.status} />
                        </td>
                        <td className="px-4 py-3 font-bold text-indigo-700">
                          {e.grade_points !== null && e.grade_points !== undefined
                            ? parseFloat(e.grade_points).toFixed(2)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant={e.status === 'Completed' ? 'secondary' : 'primary'}
                            icon={Award}
                            onClick={() => {
                              setGradeTarget(e);
                              setGradePoints(e.grade_points ? String(e.grade_points) : '');
                            }}
                          >
                            {e.status === 'Completed' ? 'Update Grade' : 'Grade / Complete'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setActiveOffering(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Grade Completion Modal */}
      {gradeTarget && (
        <Modal
          isOpen={Boolean(gradeTarget)}
          onClose={() => setGradeTarget(null)}
          title={`Assign Grade Points — ${gradeTarget.student?.name}`}
          size="sm"
        >
          <form onSubmit={handleGradeSubmit} className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600 border border-slate-100">
              <p>
                <strong>Student:</strong> {gradeTarget.student?.name} ({gradeTarget.student?.roll_no})
              </p>
              <p>
                <strong>Course:</strong> {gradeTarget.offering?.course_code}
              </p>
              <p className="text-[11px] text-slate-400">
                Note: Grade points ≥ 4.00 earn course credits towards student degree requirements.
              </p>
            </div>

            <Input
              label="Grade Points (0.00 – 10.00)"
              type="number"
              step="0.01"
              min="0"
              max="10"
              required
              value={gradePoints}
              onChange={(e) => setGradePoints(e.target.value)}
              placeholder="e.g. 8.50"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setGradeTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={grading} icon={CheckCircle}>
                Save Grade & Complete
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Capacity Modal */}
      {editOffering && (
        <Modal
          isOpen={Boolean(editOffering)}
          onClose={() => setEditOffering(null)}
          title={`Edit Offering Settings — ${editOffering.course_code}`}
          size="sm"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Input
              label="Offering Seat Capacity"
              type="number"
              min="1"
              required
              value={newCapacity}
              onChange={(e) => setNewCapacity(e.target.value)}
              helperText={`Current enrolled students: ${editOffering.active_enrolled}`}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditOffering(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={savingEdit}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default MyCourses;
