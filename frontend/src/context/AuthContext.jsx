import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('access_token'));
  const [loading, setLoading] = useState(true);

  // Load user profile on initial mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('access_token');
      const storedUser = localStorage.getItem('user_info');
      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Refresh user profile details from /auth/me/
          const { data } = await api.get('/auth/me/');
          setUser(data);
          localStorage.setItem('user_info', JSON.stringify(data));
        } catch (err) {
          console.warn('Initial session check failed, using stored user info', err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);

    // Build user object from login response
    const userInfo = {
      email,
      role: data.role,
      name: data.name,
      status: data.status,
      pending_approval: Boolean(data.pending_approval),
    };

    setUser(userInfo);
    setToken(data.access);
    localStorage.setItem('user_info', JSON.stringify(userInfo));

    // Try fetching full profile
    try {
      const meResp = await api.get('/auth/me/');
      setUser(meResp.data);
      localStorage.setItem('user_info', JSON.stringify(meResp.data));
      return meResp.data;
    } catch {
      return userInfo;
    }
  };

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) {
      try {
        await api.post('/auth/logout/', { refresh });
      } catch (err) {
        console.warn('Logout API error:', err);
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    setUser(null);
    setToken(null);
  };

  const registerStudent = async (formData) => {
    return api.post('/auth/register/student/', formData);
  };

  const registerFaculty = async (formData) => {
    return api.post('/auth/register/faculty/', formData);
  };

  const refreshProfile = async () => {
    const { data } = await api.get('/auth/me/');
    setUser(data);
    localStorage.setItem('user_info', JSON.stringify(data));
    return data;
  };

  const role = user?.role;
  const isPendingFaculty =
    role === 'FACULTY' &&
    (user?.pending_approval ||
      user?.faculty_profile?.approval_status === 'Pending' ||
      user?.approval_status === 'Pending');

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        loading,
        isPendingFaculty,
        login,
        logout,
        registerStudent,
        registerFaculty,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
