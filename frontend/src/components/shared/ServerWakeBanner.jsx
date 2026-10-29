import React, { useState, useEffect } from 'react';
import { Loader2, Server, RefreshCw, X } from 'lucide-react';
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const ServerWakeBanner = () => {
  const [status, setStatus] = useState(null); // { waking: bool, message: string, error: bool }
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleStatus = (e) => {
      if (e.detail?.waking) {
        setDismissed(false);
        setStatus(e.detail);
      } else {
        setStatus(null);
      }
    };

    window.addEventListener('app:server-status', handleStatus);
    return () => window.removeEventListener('app:server-status', handleStatus);
  }, []);

  const handlePing = async () => {
    setChecking(true);
    try {
      const res = await axios.get(`${baseURL}/health/`, { timeout: 10000 });
      if (res.data?.status === 'ok') {
        setStatus(null);
      }
    } catch {
      // still waking up
    } finally {
      setChecking(false);
    }
  };

  if (!status?.waking || dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 shadow-md border-b border-amber-600 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between text-xs sm:text-sm font-medium">
        <div className="flex items-center gap-2">
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin text-slate-900 shrink-0" />
          ) : (
            <Server className="w-4 h-4 animate-pulse text-slate-900 shrink-0" />
          )}
          <span>
            {status.message || 'Connecting to server... On Render free-tier, first startup may take 30–60 seconds.'}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            onClick={handlePing}
            disabled={checking}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : 'Check Server'}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-900 hover:text-slate-950 p-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerWakeBanner;

