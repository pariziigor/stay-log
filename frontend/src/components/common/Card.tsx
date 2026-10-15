import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface CardProps extends HTMLMotionProps<'div'> {
  hoverable?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  glow = false,
  children,
  className,
  ...props
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -3, transition: { duration: 0.2 } } : undefined}
      className={cn(
        'relative bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-xs transition-shadow duration-300',
        hoverable && 'hover:shadow-md hover:border-slate-300/90',
        glow && 'hover:shadow-glow hover:border-brand-400/50',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};
