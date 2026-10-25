import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoIcon } from './icons';

/** Loading: a translated label plus skeleton rows so the screen never jumps. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite">
      <p className="text-base font-semibold text-slate-700">{label}</p>
      <div className="mt-3 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

/** Error: says what happened and offers a retry; never blames the user. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
      <h2 className="text-lg font-bold text-amber-900">{t('shared.errorTitle')}</h2>
      <p className="mt-1 text-base leading-relaxed text-amber-900">{t('shared.errorBody')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 min-h-12 rounded-xl border-2 border-amber-700 bg-white px-5 text-base font-bold text-amber-900"
      >
        {t('shared.retry')}
      </button>
    </div>
  );
}

/** Empty: explains what will appear here and offers the next action. */
export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
      {icon ? <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">{icon}</div> : null}
      <p className="text-lg font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-base leading-relaxed text-slate-600">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Amber note used wherever content is still a clinical placeholder. */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed font-semibold text-amber-900">
      <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
