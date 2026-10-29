import React from 'react';

const Badge = ({ status, variant, children, className = '' }) => {
  const normalized = (status || variant || '').toLowerCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  if (normalized.includes('pending') || normalized === 'upcoming' || normalized === 'amber') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (
    normalized.includes('approved') ||
    normalized.includes('active') ||
    normalized === 'open' ||
    normalized === 'green'
  ) {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (
    normalized.includes('rejected') ||
    normalized.includes('suspended') ||
    normalized === 'cancelled' ||
    normalized === 'closed' ||
    normalized === 'red'
  ) {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (
    normalized.includes('withdrawn') ||
    normalized.includes('inactive') ||
    normalized === 'archived' ||
    normalized === 'gray'
  ) {
    styles = 'bg-slate-100 text-slate-600 border-slate-300';
  } else if (normalized.includes('completed') || normalized === 'blue') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
      {children || status}
    </span>
  );
};

export default Badge;
