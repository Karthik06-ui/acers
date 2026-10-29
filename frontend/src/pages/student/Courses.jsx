import React, { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, Users, Award, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/shared/Badge';
import Button from '../../components/shared/Button';
import Input from '../../components/shared/Input';
import Modal from '../../components/shared/Modal';
import Spinner from '../../components/shared/Spinner';
import Pagination from '../../components/shared/Pagination';

const Courses = () => {
  const { user } = useAuth();
  const toast = useToast();

  const [offerings, setOfferings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);

  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedOffering, setSelectedOffering] = useState(null);
  const [enrollingId, setEnrollingId] = useState(null);

  // Fetch filter options and student's existing requests & enrollments
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [deptsRes, semsRes, reqsRes, enrsRes] = await Promise.all([
          api.get('/academics/departments/'),
          api.get('/academics/semesters/'),
          api.get('/enrollments/requests/'),
          api.get('/enrollments/my/'),
        ]);

        setDepartments(deptsRes.data.results || deptsRes.data || []);
        setSemesters(semsRes.data.results || semsRes.data || []);
        setMyRequests(reqsRes.data.results || reqsRes.data || []);
        setMyEnrollments(enrsRes.data.results || enrsRes.data || []);
      } catch (err) {
        console.error('Failed to load courses metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch course offerings
  const fetchOfferings = async () => {
    setLoading(true);
    try {
      let url = `/academics/offerings/?page=${page}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedDept) url += `&course__department=${selectedDept}`;
      if (selectedSem) url += `&semester=${selectedSem}`;

      const { data } = await api.get(url);
      setOfferings(data.results || data || []);
      setTotalCount(data.count || (data.results ? data.results.length : 0));
    } catch (err) {
      toast.error('Failed to load course offerings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, [page, selectedDept, selectedSem]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOfferings();
  };

  const studentCgpa = parseFloat(user?.student_profile?.cgpa ?? user?.cgpa ?? 0);

  // Helper to determine enrollment eligibility for an offering
  const getEligibility = (offering) => {
    const minCgpa = offering.course_details?.minimum_cgpa
      ? parseFloat(offering.course_details.minimum_cgpa)
      : null;

    // Check duplicate pending request
    const hasPending = myRequests.some(
      (r) => r.offering?.id === offering.id && r.status === 'Pending'
    );
    if (hasPending) {
      return { eligible: false, reason: 'Request Pending' };
    }

    // Check active enrollment
    const hasActive = myEnrollments.some(
      (e) => e.offering?.id === offering.id && e.status === 'Active'
    );
    if (hasActive) {
      return { eligible: false, reason: 'Already Enrolled' };
    }

    // Check capacity
    const seatsAvailable =
      offering.seats_available !== undefined
        ? offering.seats_available
        : offering.capacity - (offering.active_enrollment_count || 0);

    if (seatsAvailable <= 0) {
      return { eligible: false, reason: 'Course Full' };
    }

    // Check CGPA
    if (minCgpa !== null && studentCgpa < minCgpa) {
      return {
        eligible: false,
        reason: `Min CGPA ${minCgpa.toFixed(2)} Required (Yours: ${studentCgpa.toFixed(2)})`,
      };
    }

    return { eligible: true, reason: 'Eligible' };
  };

  const handleEnroll = async (offering) => {
    setEnrollingId(offering.id);
    try {
      const { data } = await api.post('/enrollments/requests/', { offering: offering.id });
      toast.success(
        `Enrollment request submitted for ${offering.course_code || offering.course_name}!`
      );
      setMyRequests((prev) => [data, ...prev]);
      if (selectedOffering?.id === offering.id) {
        setSelectedOffering(null);
      }
    } catch (err) {
      toast.error(err.normalizedMessage || 'Enrollment request failed.');
    } finally {
      setEnrollingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Available Courses</h2>
          <p className="text-xs text-slate-500">
            Browse active course offerings for the current registration term.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
          <div className="w-60">
            <Input
              icon={Search}
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="!py-2 text-xs"
            />
          </div>

          <select
            value={selectedDept}
            onChange={(e) => {
              setSelectedDept(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code}
              </option>
            ))}
          </select>

          <select
            value={selectedSem}
            onChange={(e) => {
              setSelectedSem(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Semesters</option>
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.academic_year} {s.semester_name}
              </option>
            ))}
          </select>

          <Button type="submit" size="sm">
            Search
          </Button>
        </form>
      </div>

      {/* Offerings Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      ) : offerings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white border border-slate-200/80">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800">No offerings match your criteria</h4>
          <p className="text-xs text-slate-400 mt-1">Try clearing filters or searching for another course.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offerings.map((offering) => {
            const code = offering.course_code || offering.course?.code;
            const name = offering.course_name || offering.course?.name;
            const credits = offering.credits || offering.course?.credits || 3;
            const facultyName = offering.faculty_name || offering.faculty?.name || 'TBA';
            const semesterStr =
              offering.semester_name ||
              (offering.semester ? `${offering.semester.academic_year} ${offering.semester.semester_name}` : '');
            const minCgpa = offering.course_details?.minimum_cgpa || offering.course?.minimum_cgpa;
            const seatsAvail =
              offering.seats_available !== undefined
                ? offering.seats_available
                : offering.capacity - (offering.active_enrollment_count || 0);

            const { eligible, reason } = getEligibility(offering);

            return (
              <div
                key={offering.id}
                className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg">
                      {code}
                    </span>
                    <Badge
                      status={seatsAvail > 0 ? 'Active' : 'Closed'}
                      className="!text-[10px]"
                    >
                      {seatsAvail > 0 ? `${seatsAvail} seats left` : 'Full'}
                    </Badge>
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-slate-900 line-clamp-1">{name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Faculty: {facultyName}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Credits</span>
                      <span className="font-semibold">{credits} Credits</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase">Min. CGPA</span>
                      <span className="font-semibold">
                        {minCgpa ? parseFloat(minCgpa).toFixed(2) : 'None'}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/50 flex justify-between text-[11px]">
                      <span className="text-slate-400">Term:</span>
                      <span className="font-medium text-slate-700">{semesterStr}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOffering(offering)}
                    className="text-xs font-semibold text-slate-600 hover:text-indigo-600 transition"
                  >
                    View Details
                  </button>

                  <Button
                    size="sm"
                    disabled={!eligible}
                    loading={enrollingId === offering.id}
                    onClick={() => handleEnroll(offering)}
                    variant={eligible ? 'primary' : 'secondary'}
                    title={!eligible ? reason : 'Submit enrollment request'}
                  >
                    {eligible ? 'Enroll' : reason}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalCount={totalCount}
        pageSize={10}
        onPageChange={(p) => setPage(p)}
      />

      {/* Offering Detail Modal */}
      {selectedOffering && (
        <Modal
          isOpen={Boolean(selectedOffering)}
          onClose={() => setSelectedOffering(null)}
          title={`Course Offering Details — ${selectedOffering.course_code || selectedOffering.course?.code}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {selectedOffering.course_name || selectedOffering.course?.name}
              </h4>
              <p className="text-slate-500 mt-1">
                Faculty Instructor: {selectedOffering.faculty_name || selectedOffering.faculty?.name}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 block">Course Credits</span>
                <span className="font-bold text-sm text-slate-800">
                  {selectedOffering.credits || selectedOffering.course?.credits || 3}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Min. Required CGPA</span>
                <span className="font-bold text-sm text-slate-800">
                  {selectedOffering.course_details?.minimum_cgpa ||
                  selectedOffering.course?.minimum_cgpa
                    ? parseFloat(
                        selectedOffering.course_details?.minimum_cgpa ||
                          selectedOffering.course?.minimum_cgpa
                      ).toFixed(2)
                    : 'No requirement'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Offering Capacity</span>
                <span className="font-bold text-sm text-slate-800">{selectedOffering.capacity} Seats</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Available Seats</span>
                <span className="font-bold text-sm text-emerald-600">
                  {selectedOffering.seats_available !== undefined
                    ? selectedOffering.seats_available
                    : selectedOffering.capacity - (selectedOffering.active_enrollment_count || 0)}
                </span>
              </div>
            </div>

            <div>
              <h5 className="font-bold text-slate-800 mb-1">Description / Syllabus Overview</h5>
              <p className="text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                {selectedOffering.course_details?.description ||
                  selectedOffering.course?.description ||
                  'No syllabus description provided for this course.'}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[11px]">
                {(() => {
                  const el = getEligibility(selectedOffering);
                  return (
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        el.eligible ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {el.eligible ? (
                        <CheckCircle className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      Status: {el.reason}
                    </span>
                  );
                })()}
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedOffering(null)}>
                  Close
                </Button>
                {(() => {
                  const el = getEligibility(selectedOffering);
                  return (
                    <Button
                      size="sm"
                      disabled={!el.eligible}
                      loading={enrollingId === selectedOffering.id}
                      onClick={() => handleEnroll(selectedOffering)}
                    >
                      Confirm Enrollment
                    </Button>
                  );
                })()}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Courses;
