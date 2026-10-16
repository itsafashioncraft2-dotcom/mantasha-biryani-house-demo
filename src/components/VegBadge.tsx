import React from 'react';

interface VegBadgeProps {
  isVeg: boolean;
  size?: 'sm' | 'md';
}

export const VegBadge: React.FC<VegBadgeProps> = ({ isVeg, size = 'sm' }) => {
  const containerSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  if (isVeg) {
    return (
      <span
        title="Vegetarian"
        aria-label="Vegetarian"
        className={`inline-flex items-center justify-center border border-emerald-700 bg-white rounded-xs p-0.5 shrink-0 ${containerSize}`}
      >
        <span className={`rounded-full bg-emerald-700 ${dotSize}`} />
      </span>
    );
  }

  return (
    <span
      title="Non-Vegetarian"
      aria-label="Non-Vegetarian"
      className={`inline-flex items-center justify-center border border-rose-800 bg-white rounded-xs p-0.5 shrink-0 ${containerSize}`}
    >
      <span className={`rounded-full bg-rose-800 ${dotSize}`} />
    </span>
  );
};
