import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Lock, Mail, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';

const Login = () => {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name || user.email}!`);

      // Determine redirect path
      const from = location.state?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      if (user.role === 'STUDENT') {
        navigate('/student');
      } else if (user.role === 'FACULTY') {
        if (user.pending_approval || user.faculty_profile?.approval_status === 'Pending') {
          navigate('/pending-approval');
        } else {
          navigate('/faculty');
        }
      } else if (user.role === 'HOD') {
        navigate('/hod');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.normalizedMessage || 'Invalid email or password.');
      toast.error(err.normalizedMessage || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (demoEmail, demoPassword = 'Demo@1234') => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-3">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in to SEAP-CES</h2>
        <p className="mt-1 text-xs text-slate-500">Course Registration & Enrollment System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-100">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              icon={Mail}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@demo.com"
            />

            <Input
              label="Password"
              type="password"
              icon={Lock}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Button type="submit" className="w-full mt-2" loading={loading} size="lg">
              Sign In
            </Button>
          </form>

          {/* Seed demo quick-fill helper buttons */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-3">
              Quick Fill Seeded Accounts (Demo@1234)
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => fillCredentials('s001@demo.com')}
                className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
              >
                <div className="font-semibold text-slate-800">Student</div>
                <div className="text-[10px] text-slate-400 truncate">s001@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('alice@demo.com')}
                className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
              >
                <div className="font-semibold text-slate-800">Faculty (Approved)</div>
                <div className="text-[10px] text-slate-400 truncate">alice@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('dave@demo.com')}
                className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
              >
                <div className="font-semibold text-slate-800">Faculty (Pending)</div>
                <div className="text-[10px] text-slate-400 truncate">dave@demo.com</div>
              </button>
              <button
                type="button"
                onClick={() => fillCredentials('hod@demo.com')}
                className="p-2 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition"
              >
                <div className="font-semibold text-slate-800">HOD Admin</div>
                <div className="text-[10px] text-slate-400 truncate">hod@demo.com</div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-slate-500 space-y-1">
            <p>
              New Student?{' '}
              <Link to="/register/student" className="font-semibold text-indigo-600 hover:underline">
                Register as Student
              </Link>
            </p>
            <p>
              New Faculty?{' '}
              <Link to="/register/faculty" className="font-semibold text-indigo-600 hover:underline">
                Register as Faculty
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
