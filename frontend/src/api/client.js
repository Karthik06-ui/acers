import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let activeRequests = 0;
let wakeTimer = null;

const notifyWake = (state) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:server-status', { detail: state }));
  }
};

// Request interceptor to attach JWT access token
api.interceptors.request.use(
  (config) => {
    activeRequests++;
    if (activeRequests === 1) {
      clearTimeout(wakeTimer);
      wakeTimer = setTimeout(() => {
        if (activeRequests > 0) {
          notifyWake({
            waking: true,
            message: 'Server is waking up (Render free tier wakes in 30–60s)...',
          });
        }
      }, 3500);
    }

    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) clearTimeout(wakeTimer);
    return Promise.reject(error);
  }
);

// Response interceptor: refresh on 401 once, normalize error
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      clearTimeout(wakeTimer);
      notifyWake({ waking: false });
    }
    return response;
  },
  async (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      clearTimeout(wakeTimer);
    }

    const isNetworkOr503 = !error.response || [502, 503, 504].includes(error.response?.status);
    if (isNetworkOr503) {
      notifyWake({
        waking: true,
        error: true,
        message: 'Backend server is waking up from free-tier sleep. Please wait a moment...',
      });
    }

    const originalRequest = error.config;

    // Normalize error message
    let errorMessage = 'An unexpected error occurred.';
    if (isNetworkOr503 && !error.response) {
      errorMessage = 'Backend is waking up (Render free tier wakes in 30–60s). Please retry shortly.';
    } else if (error.response?.data) {
      const data = error.response.data;
      if (typeof data.detail === 'string' && data.detail) {
        errorMessage = data.detail;
      } else if (data.errors && typeof data.errors === 'object') {
        const firstKey = Object.keys(data.errors)[0];
        const firstVal = data.errors[firstKey];
        errorMessage = Array.isArray(firstVal) ? firstVal[0] : String(firstVal);
      } else if (typeof data === 'string') {
        errorMessage = data;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    error.normalizedMessage = errorMessage;

    // Handle 401 Unauthorized token refresh
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/login/')) {
      if (originalRequest.url.includes('/auth/refresh/')) {
        // Refresh token itself failed
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${baseURL}/auth/refresh/`, {
          refresh: refreshToken,
        });
        const newAccess = data.access;
        localStorage.setItem('access_token', newAccess);
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
        api.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        processQueue(null, newAccess);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
