import { describe, it, expect } from 'vitest';
import { cn } from '../utils/cn';

describe('Utility cn (clsx + tailwind-merge)', () => {
  it('combines simple class names', () => {
    expect(cn('btn', 'btn-primary')).toBe('btn btn-primary');
  });

  it('handles conditional class names properly', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('correctly resolves conflicting Tailwind CSS utility classes', () => {
    // tailwind-merge should keep the last conflicting class (px-4 overrides px-2)
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    expect(cn('bg-white text-black', 'bg-slate-900 text-white')).toBe('bg-slate-900 text-white');
  });

  it('handles falsy values, undefined, null and empty strings gracefully', () => {
    expect(cn('base', null, undefined, false, '', 'extra')).toBe('base extra');
  });

  it('handles arrays and objects correctly', () => {
    expect(cn(['foo', 'bar'], { baz: true, qux: false })).toBe('foo bar baz');
  });
});

