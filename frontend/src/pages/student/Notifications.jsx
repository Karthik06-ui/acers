import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import Spinner from '../../components/shared/Spinner';
import { useToast } from '../../context/ToastContext';

const NotificationsPage = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/');
      setNotifications(data.results || data || []);
    } catch {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await api.post(`/notifications/${id}/read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      toast.success('Marked as read.');
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read.');
    } catch {}
  };

  const filtered =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notifications</h2>
          <p className="text-xs text-slate-500">
            System announcements, status alerts, and enrollment approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Unread
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            onClick={handleMarkAllRead}
            disabled={!notifications.some((n) => !n.is_read)}
          >
            Mark all read
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" className="text-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          description="You will receive alerts here when your requests are updated or course actions take place."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition flex items-start justify-between gap-4 ${
                !n.is_read
                  ? 'bg-indigo-50/50 border-indigo-100 shadow-sm'
                  : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="space-y-1">
                <p className={`text-xs text-slate-800 ${!n.is_read ? 'font-bold' : ''}`}>
                  {n.message}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{new Date(n.created_at).toLocaleString()}</span>
                  {!n.is_read && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase">
                      New
                    </span>
                  )}
                </div>
              </div>

              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  title="Mark as read"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white transition"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
