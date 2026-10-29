import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

const Pagination = ({
  currentPage,
  page,
  totalCount,
  total,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  // Support both prop naming conventions
  const activePage = currentPage ?? page ?? 1;
  const activeTotal = totalCount ?? total ?? 0;
  const totalPages = Math.ceil(activeTotal / pageSize) || 1;
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 rounded-b-2xl sm:px-6 ${className}`}>
      <div className="text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{(activePage - 1) * pageSize + 1}</span> to{' '}
        <span className="font-semibold text-slate-700">{Math.min(activePage * pageSize, activeTotal)}</span> of{' '}
        <span className="font-semibold text-slate-700">{activeTotal}</span> results
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={activePage <= 1}
          onClick={() => onPageChange(activePage - 1)}
          icon={ChevronLeft}
        >
          Previous
        </Button>
        <span className="text-xs font-medium text-slate-600 px-2">
          Page {activePage} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={activePage >= totalPages}
          onClick={() => onPageChange(activePage + 1)}
          icon={ChevronRight}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
