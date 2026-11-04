/**
 * MaaSetu — demo-only account switcher.
 *
 * Kept behind one button in the header so a demo can move between the seed
 * ASHA, ANM and mothers without retyping phone numbers. It is not part of the
 * care workflow and grants nothing a normal sign-in would not.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../context/SessionContext';
import { useVillages } from '../hooks/useVillages';
import { demoSignIn } from '../services/authService';
import { listAllMothers, listAllUsers } from '../services/journeyService';
import { simulateHandoverAge } from '../services/handoverService';
import type { Mother, User } from '../data/model';
import { useNetwork } from '../hooks/useOffline';
import { setSimulatedOffline } from '../offline/network';
import { ClockIcon, CloseIcon, HeartIcon, HealthWorkerIcon, MenuIcon, WifiOffIcon } from './icons';

interface DemoData {
  workers: User[];
  mothers: Mother[];
}

export function DemoTools() {
  const { t } = useTranslation();
  const { role, worker, mother, refresh } = useSession();
  const villages = useVillages();
  const network = useNetwork();

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DemoData | null>(null);
  const [busyPhone, setBusyPhone] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyTime, setBusyTime] = useState(false);
  const [timeDone, setTimeDone] = useState<{ aged: number; created: number } | null>(null);
  const [timeFailed, setTimeFailed] = useState(false);

  const villageName = (id: string) => villages.find((village) => village.id === id)?.name ?? id;

  const openMenu = () => {
    setOpen(true);
    setFailed(false);
    setTimeFailed(false);
    if (!data) {
      void Promise.all([listAllUsers(), listAllMothers()])
        .then(([workers, mothers]) => setData({ workers, mothers }))
        .catch((error: unknown) => {
          console.error('MaaSetu: could not load demo accounts', error);
          setFailed(true);
        });
    }
  };

  const signInAs = async (phone: string) => {
    setBusyPhone(phone);
    setFailed(false);
    const ok = await demoSignIn(phone);
    setBusyPhone(null);
    if (!ok) {
      setFailed(true);
      return;
    }
    setOpen(false);
    refresh();
  };

  /** Demo only: age pending requests so the overdue state can be shown live. */
  const simulateTime = async () => {
    setBusyTime(true);
    setTimeFailed(false);
    try {
      const result = await simulateHandoverAge();
      setTimeDone({ aged: result.aged, created: result.created });
    } catch (error) {
      console.error('MaaSetu: could not simulate time', error);
      setTimeFailed(true);
    } finally {
      setBusyTime(false);
    }
  };

  const currentId = worker?.id ?? mother?.id;
  const currentRole = role;

  return (
    <>
      <button
        type="button"
        onClick={openMenu}
        aria-label={t('demo.open')}
        className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-white/40 text-white"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 px-4 py-6">
          <div className="mx-auto w-full max-w-[22rem] rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-slate-900">{t('demo.title')}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('demo.close')}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
              >
                <CloseIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('demo.hint')}</p>

            <h3 className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
              {t('demo.network')}
            </h3>
            <button
              type="button"
              onClick={() => setSimulatedOffline(!network.simulated)}
              aria-pressed={network.simulated}
              className={[
                'mt-2 flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left',
                network.simulated
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              ].join(' ')}
            >
              <WifiOffIcon className="h-5 w-5 shrink-0 text-slate-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-slate-900">
                  {t('demo.simulateOffline')}
                </span>
                <span className="block text-sm text-slate-600">
                  {network.simulated ? t('demo.simulateOn') : t('demo.simulateOff')}
                </span>
              </span>
            </button>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t('demo.simulateOfflineHint')}
            </p>

            <h3 className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
              {t('demo.time')}
            </h3>
            <button
              type="button"
              onClick={() => void simulateTime()}
              disabled={busyTime || network.status === 'offline'}
              className="mt-2 flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 text-left hover:bg-slate-50 disabled:opacity-60"
            >
              <ClockIcon className="h-5 w-5 shrink-0 text-slate-700" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-slate-900">
                  {busyTime ? t('shared.saving') : t('demo.simulateTime')}
                </span>
                <span className="block text-sm text-slate-600">{t('demo.simulateTimeHint')}</span>
              </span>
            </button>
            {timeDone ? (
              <p
                role="status"
                className="mt-1 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-900"
              >
                {t('demo.simulateTimeDone', { aged: timeDone.aged, created: timeDone.created })}
              </p>
            ) : null}
            {timeFailed ? (
              <p role="alert" className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {t('demo.simulateTimeError')}
              </p>
            ) : null}

            {failed ? (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
                {t('demo.error')}
              </p>
            ) : null}

            {!data ? (
              <p className="mt-4 text-base text-slate-600">{t('shared.loading')}</p>
            ) : (
              <>
                <h3 className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {t('demo.workers')}
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.workers.map((item) => {
                    const active = currentRole !== 'mother' && currentId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void signInAs(item.phone)}
                          disabled={busyPhone !== null}
                          className={[
                            'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left',
                            active
                              ? 'border-brand-700 bg-brand-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <HealthWorkerIcon className="h-5 w-5 shrink-0 text-brand-700" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-bold text-slate-900">
                              {item.name}
                            </span>
                            <span className="block truncate text-sm text-slate-600">
                              {t(`role.${item.role}`)} · {villageName(item.village)}
                            </span>
                          </span>
                          {busyPhone === item.phone ? (
                            <span className="text-xs font-semibold text-brand-800">
                              {t('shared.loading')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <h3 className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {t('demo.mothers')}
                </h3>
                <ul className="mt-2 space-y-2">
                  {data.mothers.map((item) => {
                    const active = currentRole === 'mother' && currentId === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void signInAs(item.phone)}
                          disabled={busyPhone !== null}
                          className={[
                            'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 text-left',
                            active
                              ? 'border-brand-700 bg-brand-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <HeartIcon className="h-5 w-5 shrink-0 text-brand-700" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-bold text-slate-900">
                              {item.name}
                            </span>
                            <span className="block truncate text-sm text-slate-600">
                              {villageName(item.village)}
                            </span>
                          </span>
                          {busyPhone === item.phone ? (
                            <span className="text-xs font-semibold text-brand-800">
                              {t('shared.loading')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            <p className="mt-4 text-xs leading-relaxed text-slate-500">{t('demo.switchNote')}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
