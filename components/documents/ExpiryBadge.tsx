import React from 'react';

interface ExpiryBadgeProps {
  expiryDate: string | null;
}

export default function ExpiryBadge({ expiryDate }: ExpiryBadgeProps) {
  if (!expiryDate) return null;

  const expiry = new Date(expiryDate);
  const now = new Date();
  
  // Set times to midnight for accurate day calculation
  now.setHours(0, 0, 0, 0);
  
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Expired
      </span>
    );
  }

  if (diffDays <= 30) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Expires in {diffDays} {diffDays === 1 ? 'day' : 'days'}
      </span>
    );
  }

  if (diffDays <= 90) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Expiring Soon
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      Valid
    </span>
  );
}
