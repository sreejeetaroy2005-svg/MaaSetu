/**
 * MaaSetu — "Update available".
 *
 * The service worker precaches the whole app; when a new build is waiting, the
 * person is told in one line and chooses when to reload. Nothing reloads under
 * her while she is entering a visit.
 */
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { CloseIcon, RefreshIcon } from './icons';

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Check for a new build hourly while the app stays open.
      window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[480px] p-3">
      <div className="flex items-start gap-3 rounded-2xl border-2 border-brand-700 bg-white p-3 shadow-lg">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-800">
          <RefreshIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base leading-snug font-bold text-slate-900">{t('update.available')}</p>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand-700 px-4 text-sm font-bold text-white"
          >
            {t('update.reload')}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label={t('update.later')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
