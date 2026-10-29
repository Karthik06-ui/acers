import React, { useState } from 'react';
import { User, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';
import api from '../../api/client';

const HODProfile = () => {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.patch('/auth/me/', { name });
      await refreshProfile();
      toast.success('Profile updated successfully!');
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
      await api.patch('/auth/me/', { old_password: oldPassword, new_password: newPassword });
      toast.success('Password changed successfully!');
      setOldPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.normalizedMessage || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">HOD Profile</h2>
        <p className="text-xs text-slate-500 mt-1">Manage your account settings.</p>
      </div>

      {/* Profile Info Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="text-indigo-600" size={24} />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-lg">{user?.name || 'HOD'}</p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Mail size={12} /> {user?.email}
            </p>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold">
              HOD / Administrator
            </span>
          </div>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <Input
            label="Full Name"
            id="hod-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={User}
            required
          />
          <Button type="submit" loading={savingProfile} className="w-full">
            Save Changes
          </Button>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Lock size={16} className="text-indigo-500" /> Change Password
        </h3>
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <Input
            label="Current Password"
            id="hod-old-password"
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            icon={Lock}
            required
          />
          <Input
            label="New Password"
            id="hod-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            icon={Lock}
            required
          />
          <Button type="submit" variant="secondary" loading={savingPassword} className="w-full">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default HODProfile;
