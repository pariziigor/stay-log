import React from 'react';
import { cn } from '../../utils/cn';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'brand' | 'emerald' | 'amber' | 'rose' | 'slate' | 'violet' | 'cyan';
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'brand',
  size = 'md',
  dot = false,
  className,
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  const variantStyles = {
    brand: 'bg-brand-50 text-brand-700 border-brand-200/60',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    violet: 'bg-purple-50 text-purple-700 border-purple-200/60',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
  };

  const dotColors = {
    brand: 'bg-brand-500',
    emerald: 'bg-emerald-500 animate-pulse',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-400',
    violet: 'bg-purple-500',
    cyan: 'bg-cyan-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border shadow-2xs transition-colors',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
};
