import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RefreshCw, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/shared/Button';

const PendingApproval = () => {
  const { user, refreshProfile, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const updated = await refreshProfile();
      const isApproved =
        updated.faculty_profile?.approval_status === 'Approved' ||
        updated.approval_status === 'Approved';

      if (isApproved) {
        toast.success('Your faculty account has been approved!');
        navigate('/faculty');
      } else {
        toast.info('Account is still pending approval by HOD.');
      }
    } catch {
      toast.error('Could not refresh status. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 shadow-sm ring-8 ring-amber-50/50">
          <Clock className="w-8 h-8 animate-pulse" />
        </div>

        <h2 className="text-xl font-bold text-slate-900">Account Pending Approval</h2>
        <p className="mt-2 text-xs text-slate-500 leading-relaxed">
          Hello <strong>{user?.name || user?.email}</strong>. Your faculty registration has been
          received and is awaiting review and approval by the Head of Department (HOD).
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-left text-xs space-y-1.5 text-slate-600">
          <div className="flex justify-between">
            <span className="text-slate-400">Account Role:</span>
            <span className="font-semibold text-slate-700">Faculty</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Approval Status:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
              Pending
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Access:</span>
            <span className="text-rose-600 font-medium">Faculty portal features blocked</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            onClick={handleCheckStatus}
            loading={checking}
            icon={RefreshCw}
            className="w-full"
            size="lg"
          >
            Check Approval Status
          </Button>

          <Button
            variant="secondary"
            onClick={handleLogout}
            icon={LogOut}
            className="w-full"
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
