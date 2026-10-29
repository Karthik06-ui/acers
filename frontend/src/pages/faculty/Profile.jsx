import React, { useState } from 'react';
import { User, Mail, Phone, Lock, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';
import Badge from '../../components/shared/Badge';
import api from '../../api/client';

const FacultyProfile = () => {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || user?.faculty_profile?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me/', { name, phone });
      await refreshProfile();
      toast.success('Faculty profile updated successfully!');
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toast.error('Both current and new password are required.');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/auth/me/', {
        old_password: oldPassword,
        password: newPassword,
      });
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const faculty = user?.faculty_profile || user;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Faculty Profile & Settings</h2>
        <p className="text-xs text-slate-500">
          Manage your personal information, phone number, and account credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Academic Credentials Card */}
        <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm space-y-4">
          <div className="text-center pb-4 border-b border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-extrabold text-xl flex items-center justify-center mx-auto mb-2 shadow-md shadow-indigo-100">
              {(faculty.name || user.email || 'F')[0].toUpperCase()}
            </div>
            <h3 className="font-bold text-sm text-slate-800">{faculty.name || user.email}</h3>
            <span className="text-xs text-slate-400">{user.email}</span>
            <div className="mt-2 flex justify-center gap-1">
              <Badge status={faculty.approval_status || 'Approved'} />
              <Badge status={faculty.account_status || 'Active'} />
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">Designation</span>
              <span className="font-semibold text-slate-700">{faculty.designation || 'Faculty'}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-400">Department</span>
              <span className="font-semibold text-slate-700">
                {faculty.department_name || faculty.department || 'General'}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-slate-400">System Role</span>
              <span className="font-bold text-indigo-600">FACULTY</span>
            </div>
          </div>
        </div>

        {/* Right Column: Editable Forms */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Edit Personal Information</h4>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Input
                label="Full Name"
                icon={User}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Phone Number"
                type="tel"
                icon={Phone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0199"
              />

              <div className="pt-2">
                <Button type="submit" size="sm" loading={savingProfile}>
                  Save Profile Details
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 mb-4">Change Account Password</h4>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                icon={Lock}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="••••••••"
              />

              <Input
                label="New Password"
                type="password"
                icon={Lock}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />

              <div className="pt-2">
                <Button type="submit" variant="secondary" size="sm" loading={savingPassword}>
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacultyProfile;
