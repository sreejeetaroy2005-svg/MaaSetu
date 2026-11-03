/**
 * MaaSetu — shared UI primitives.
 *
 * One look everywhere: rounded white cards on a calm neutral background, a
 * single teal brand colour and one amber accent. Every control is at least
 * 48px tall and every label is at least 16px so the app stays usable on a
 * low-end phone held at arm's length.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-800',
  secondary: 'border-2 border-brand-700 bg-white text-brand-800 hover:bg-brand-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-700',
  ghost: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
};

const BUTTON_BASE =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700';

export function buttonClass(variant: ButtonVariant = 'primary', extra = ''): string {
  return `${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  full?: boolean;
}

export function Button({ variant = 'primary', full = false, className = '', ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      {...props}
      className={buttonClass(variant, `${full ? 'w-full' : ''} ${className}`)}
    />
  );
}

/** White rounded card used for every block of content. */
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export const inputClass =
  'mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none';

export const labelClass = 'block text-base font-semibold text-slate-800';

type NoticeTone = 'info' | 'warn' | 'error' | 'success';

const NOTICE_TONES: Record<NoticeTone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  success: 'border-brand-300 bg-brand-50 text-brand-900',
};

/** Inline message block (validation, errors, explanations). */
export function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-xl border-2 px-4 py-3 text-base leading-relaxed font-semibold ${NOTICE_TONES[tone]} ${className}`}
    >
      {children}
    </p>
  );
}

/** Section heading used inside screens. */
export function SectionTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-xl font-bold text-slate-900 ${className}`}>{children}</h2>
  );
}

/** Native select styled like every other input. */
export const selectClass = inputClass;
