import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Briefcase, Info, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Input from '../../components/shared/Input';
import Button from '../../components/shared/Button';
import api from '../../api/client';

const RegisterFaculty = () => {
  const { registerFaculty } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designation: 'Assistant Professor',
    department: '',
  });
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const { data } = await api.get('/academics/departments/');
        const list = data.results || data || [];
        setDepartments(list);
        if (list.length > 0) {
          setFormData((prev) => ({ ...prev, department: list[0].id }));
        }
      } catch {}
    };
    fetchDepts();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registerFaculty(formData);
      toast.info('Faculty registered! Awaiting HOD approval before you can access faculty features.');
      navigate('/login');
    } catch (err) {
      setError(err.normalizedMessage || 'Registration failed.');
      toast.error(err.normalizedMessage || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-200 mb-3">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Faculty Registration</h2>
        <p className="mt-1 text-xs text-slate-500">Register to manage course offerings and enrollment requests</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-200/50 rounded-3xl border border-slate-100">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-4 flex items-start gap-2.5 text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <span>
              <strong>Note:</strong> Newly registered faculty accounts require approval by the Head of
              Department (HOD) before faculty features are activated.
            </span>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <Input
              label="Full Name"
              name="name"
              icon={User}
              required
              value={formData.name}
              onChange={handleChange}
              placeholder="Dr. Eleanor Vance"
            />

            <Input
              label="Email address"
              name="email"
              type="email"
              icon={Mail}
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="eleanor@college.edu"
            />

            <Input
              label="Password"
              name="password"
              type="password"
              icon={Lock}
              required
              value={formData.password}
              onChange={handleChange}
              placeholder="Min. 8 characters"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Designation</label>
                <select
                  name="designation"
                  value={formData.designation}
                  onChange={handleChange}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Assistant Professor">Assistant Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Professor">Professor</option>
                  <option value="Lecturer">Lecturer</option>
                  <option value="Visiting Faculty">Visiting Faculty</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                <select
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button type="submit" className="w-full mt-2" loading={loading} size="lg">
              Submit Faculty Registration
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterFaculty;
