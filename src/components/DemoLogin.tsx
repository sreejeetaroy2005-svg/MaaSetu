import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { homePathFor, useSession } from '../context/SessionContext';
import { useVillages } from '../hooks/useVillages';
import { resolveProfile, startDemoSession } from '../services/authService';
import { listAllMothers, listAllUsers } from '../services/journeyService';
import { Notice } from './ui';

interface Account { id: string; name: string; phone: string; village: string; role: string; }

export function DemoLogin({ kind }: { kind: 'worker' | 'mother' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useSession();
  const villages = useVillages();
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [signInFailed, setSignInFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (kind === 'worker') {
          const users = await listAllUsers();
          if (!cancelled) setAccounts(users.map((u) => ({ id: u.id, name: u.name, phone: u.phone, village: u.village, role: u.role })));
        } else {
          const mothers = await listAllMothers();
          if (!cancelled) setAccounts(mothers.filter((m) => Boolean(m.phone)).map((m) => ({ id: m.id, name: m.name, phone: m.phone, village: m.village, role: 'mother' })));
        }
      } catch (error) {
        console.error('MaaSetu: could not load demo accounts', error);
        if (!cancelled) setLoadFailed(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [kind]);

  const villageName = (id: string) => villages.find((v) => v.id === id)?.name ?? id;

  const signIn = async (account: Account) => {
    setBusyId(account.id);
    setSignInFailed(false);
    try {
      if (!startDemoSession(account.phone)) throw new Error('demo session not allowed');
      const profile = await resolveProfile(account.phone);
      if (!profile) throw new Error('no profile for this account');
      refresh();
      void navigate(homePathFor(profile), { replace: true });
    } catch (error) {
      console.error('MaaSetu: demo sign-in failed', error);
      setSignInFailed(true);
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <Notice tone="info">{t('demoLogin.note', { defaultValue: 'Demo login with synthetic data. Tap a person to continue. No real accounts, no code.' })}</Notice>
      {loadFailed ? <Notice tone="error">{t('demoLogin.loadFailed', { defaultValue: 'Could not load the demo accounts. Check your connection and try again.' })}</Notice> : null}
      {accounts && accounts.length === 0 ? <Notice tone="warn">{t('demoLogin.empty', { defaultValue: 'No demo accounts yet. Go back to the welcome screen and press "Load demo data" first.' })}</Notice> : null}
      {accounts === null && !loadFailed ? <p className="text-base text-slate-600">{t('shared.loading', { defaultValue: 'Loading…' })}</p> : null}
      {signInFailed ? <Notice tone="error">{t('demoLogin.signInFailed', { defaultValue: 'Could not sign in as this person. Please try again.' })}</Notice> : null}
      <ul className="space-y-2">
        {(accounts ?? []).map((account) => (
          <li key={account.id}>
            <button type="button" disabled={busyId !== null} onClick={() => void signIn(account)}
              className="flex min-h-14 w-full flex-col items-start rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-left disabled:opacity-60">
              <span className="text-lg font-bold text-slate-900">{account.name}</span>
              <span className="text-base text-slate-600">
                {account.role === 'mother' ? t('role.mother', { defaultValue: 'Mother' }) : t(`role.${account.role}`, { defaultValue: account.role.toUpperCase() })}
                {' · '}{villageName(account.village)}
                {busyId === account.id ? ` · ${t('demoLogin.signingIn', { defaultValue: 'Signing in…' })}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
