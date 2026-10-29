import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Send,
  CheckSquare,
  Award,
  User,
  Bell,
  Layers,
  FileText,
  ShieldCheck,
  X,
  Users,
  BookMarked,
  ClipboardList,
  Building2,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ isOpen, onClose }) => {
  const { role } = useAuth();

  const studentLinks = [
    { name: 'Dashboard', to: '/student', icon: LayoutDashboard },
    { name: 'Browse Courses', to: '/student/courses', icon: BookOpen },
    { name: 'My Requests', to: '/student/requests', icon: Send },
    { name: 'My Enrollments', to: '/student/enrollments', icon: CheckSquare },
    { name: 'Academic Record', to: '/student/academic-record', icon: Award },
    { name: 'Profile', to: '/student/profile', icon: User },
    { name: 'Notifications', to: '/student/notifications', icon: Bell },
  ];

  const facultyLinks = [
    { name: 'Dashboard', to: '/faculty', icon: LayoutDashboard },
    { name: 'Requests', to: '/faculty/requests', icon: Send },
    { name: 'My Courses', to: '/faculty/courses', icon: Layers },
    { name: 'Profile', to: '/faculty/profile', icon: User },
    { name: 'Notifications', to: '/faculty/notifications', icon: Bell },
  ];

  const hodLinks = [
    { name: 'Dashboard', to: '/hod', icon: LayoutDashboard },
    { name: 'Faculty', to: '/hod/faculty', icon: Users },
    { name: 'Students', to: '/hod/students', icon: GraduationCap },
    { name: 'Courses & Offerings', to: '/hod/courses', icon: BookMarked },
    { name: 'Enrollments', to: '/hod/enrollments', icon: ClipboardList },
    { name: 'Depts & Semesters', to: '/hod/departments', icon: Building2 },
    { name: 'Academic Records', to: '/hod/academic-records', icon: Award },
    { name: 'Reports', to: '/hod/reports', icon: BarChart3 },
    { name: 'Audit Logs', to: '/hod/audit-logs', icon: ShieldCheck },
    { name: 'Profile', to: '/hod/profile', icon: User },
    { name: 'Notifications', to: '/hod/notifications', icon: Bell },
  ];

  const links =
    role === 'STUDENT'
      ? studentLinks
      : role === 'FACULTY'
      ? facultyLinks
      : hodLinks;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 border-r border-slate-200/80 bg-white transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-100">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-slate-900">SEAP-CES</span>
              <span className="block text-[10px] text-indigo-600 font-semibold tracking-wider uppercase">
                {role} Portal
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {links.map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.to === '/student' || item.to === '/faculty' || item.to === '/hod'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* System info footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 text-[11px] text-slate-400">
          <p className="font-medium text-slate-600">SEAP-CES v1.0</p>
          <p>Academic Course Registration</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
