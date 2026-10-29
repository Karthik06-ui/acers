import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { StudentLayout, FacultyLayout, HODLayout } from './components/layout/AppLayout';

// Auth & Error Pages
import Login from './pages/auth/Login';
import RegisterStudent from './pages/auth/RegisterStudent';
import RegisterFaculty from './pages/auth/RegisterFaculty';
import PendingApproval from './pages/auth/PendingApproval';
import Forbidden from './pages/errors/Forbidden';
import NotFound from './pages/errors/NotFound';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import Courses from './pages/student/Courses';
import MyRequests from './pages/student/MyRequests';
import MyEnrollments from './pages/student/MyEnrollments';
import AcademicRecord from './pages/student/AcademicRecord';
import StudentProfile from './pages/student/Profile';
import NotificationsPage from './pages/student/Notifications';

// Faculty Pages
import FacultyDashboard from './pages/faculty/Dashboard';
import FacultyRequests from './pages/faculty/Requests';
import FacultyCourses from './pages/faculty/MyCourses';
import FacultyProfile from './pages/faculty/Profile';

// HOD Pages
import HODDashboard from './pages/hod/Dashboard';
import HODFaculty from './pages/hod/Faculty';
import HODStudents from './pages/hod/Students';
import HODCoursesOfferings from './pages/hod/CoursesOfferings';
import HODEnrollments from './pages/hod/Enrollments';
import HODDeptSemesters from './pages/hod/DeptSemesters';
import HODAcademicRecords from './pages/hod/AcademicRecords';
import HODReports from './pages/hod/Reports';
import AuditLogs from './pages/hod/AuditLogs';
import HODProfile from './pages/hod/Profile';
import ServerWakeBanner from './components/shared/ServerWakeBanner';

// Role-based Root Redirect
const RootRedirect = () => {
  const { user, role, loading, isPendingFaculty } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isPendingFaculty) return <Navigate to="/pending-approval" replace />;
  if (role === 'STUDENT') return <Navigate to="/student" replace />;
  if (role === 'FACULTY') return <Navigate to="/faculty" replace />;
  if (role === 'HOD') return <Navigate to="/hod" replace />;
  return <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <>
      <ServerWakeBanner />
      <Routes>
      {/* Root Redirection */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register/student" element={<RegisterStudent />} />
      <Route path="/register/faculty" element={<RegisterFaculty />} />
      <Route path="/pending-approval" element={<PendingApproval />} />

      {/* Error Routes */}
      <Route path="/403" element={<Forbidden />} />

      {/* Student Portal Routes */}
      <Route
        path="/student"
        element={
          <ProtectedRoute allowedRoles={['STUDENT']}>
            <StudentLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="requests" element={<MyRequests />} />
        <Route path="enrollments" element={<MyEnrollments />} />
        <Route path="academic-record" element={<AcademicRecord />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* Faculty Portal Routes */}
      <Route
        path="/faculty"
        element={
          <ProtectedRoute allowedRoles={['FACULTY']}>
            <FacultyLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FacultyDashboard />} />
        <Route path="requests" element={<FacultyRequests />} />
        <Route path="courses" element={<FacultyCourses />} />
        <Route path="profile" element={<FacultyProfile />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* HOD Administration Routes */}
      <Route
        path="/hod"
        element={
          <ProtectedRoute allowedRoles={['HOD']}>
            <HODLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HODDashboard />} />
        <Route path="faculty" element={<HODFaculty />} />
        <Route path="students" element={<HODStudents />} />
        <Route path="courses" element={<HODCoursesOfferings />} />
        <Route path="enrollments" element={<HODEnrollments />} />
        <Route path="departments" element={<HODDeptSemesters />} />
        <Route path="academic-records" element={<HODAcademicRecords />} />
        <Route path="reports" element={<HODReports />} />
        <Route path="audit-logs" element={<AuditLogs />} />
        <Route path="profile" element={<HODProfile />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>

      {/* 404 Catch-All */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
};

export default App;
