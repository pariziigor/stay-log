import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'emerald';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}) => {
  const baseStyles =
    'relative inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
  };

  const variantStyles = {
    primary:
      'bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/40 hover:from-brand-500 hover:to-brand-600 focus:ring-brand-500 border border-brand-500/20',
    secondary:
      'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-sm hover:shadow hover:border-slate-300 focus:ring-slate-300',
    emerald:
      'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/35 focus:ring-emerald-400 border border-emerald-400/20',
    danger:
      'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25 hover:shadow-lg hover:shadow-rose-500/40 focus:ring-rose-500 border border-rose-500/20',
    ghost:
      'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 focus:ring-slate-300',
    outline:
      'border-2 border-brand-600 text-brand-600 hover:bg-brand-50/50 focus:ring-brand-500',
  };

  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </motion.button>
  );
};
