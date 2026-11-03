import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import { EntryShell } from '../components/EntryShell';
import { PhoneAuth } from '../components/PhoneAuth';
import { Button, Card, Notice, inputClass, labelClass } from '../components/ui';
import { useVillages } from '../hooks/useVillages';
import { isValidPhone, normalizePhone } from '../services/authService';
import { phoneAlreadyUsed, registerWorker } from '../services/journeyService';
import type { Language } from '../data/model';

type AccountKind = 'worker' | 'mother';
type WorkerRoleChoice = 'asha' | 'anm';

/** Self-registration is audited as the device, not as an existing worker. */
const SELF_REGISTRATION_ACTOR = { id: 'self:registration', role: 'system' as const };

function WorkerRegisterForm({ onRegistered }: { onRegistered: (phone: string) => void }) {
  const { t } = useTranslation();
  const villages = useVillages();

  const [name, setName] = useState('');
  const [role, setRole] = useState<WorkerRoleChoice>('asha');
  const [village, setVillage] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      name: name.trim().length < 2,
      village: village.length === 0,
      phone: !isValidPhone(phone),
    };
    setErrors(nextErrors);
    setSaveFailed(false);
    if (nextErrors.name || nextErrors.village || nextErrors.phone) return;

    setSaving(true);
    try {
      const normalized = normalizePhone(phone);
      if (await phoneAlreadyUsed(normalized)) {
        setErrors({ phoneUsed: true });
        setSaving(false);
        return;
      }
      await registerWorker(
        {
          name,
          role,
          village,
          phone: normalized,
          language: 'en' as Language,
        },
        SELF_REGISTRATION_ACTOR,
      );
      onRegistered(normalized);
    } catch (caught) {
      console.error('MaaSetu: worker registration failed', caught);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-3">
      <Card>
        <label htmlFor="worker-name" className={labelClass}>
          {t('auth.nameLabel')}
        </label>
        <input
          id="worker-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('auth.namePlaceholder')}
          className={inputClass}
        />
        {errors.name ? <Notice tone="error" className="mt-2">{t('auth.errorName')}</Notice> : null}

        <p className={`${labelClass} mt-4`}>{t('auth.roleLabel')}</p>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(['asha', 'anm'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={role === option}
              onClick={() => setRole(option)}
              className={[
                'min-h-12 rounded-xl border-2 px-3 text-base font-bold',
                role === option
                  ? 'border-brand-700 bg-brand-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800',
              ].join(' ')}
            >
              {t(`role.${option}`)}
            </button>
          ))}
        </div>

        <label htmlFor="worker-village" className={`${labelClass} mt-4`}>
          {t('auth.villageLabel')}
        </label>
        <select
          id="worker-village"
          value={village}
          onChange={(event) => setVillage(event.target.value)}
          className={inputClass}
        >
          <option value="">{t('auth.villagePlaceholder')}</option>
          {villages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {errors.village ? (
          <Notice tone="error" className="mt-2">{t('auth.errorVillage')}</Notice>
        ) : null}

        <label htmlFor="worker-phone" className={`${labelClass} mt-4`}>
          {t('auth.phoneLabel')}
        </label>
        <input
          id="worker-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={t('auth.phonePlaceholder')}
          className={inputClass}
        />
        {errors.phone ? (
          <Notice tone="error" className="mt-2">{t('auth.errorInvalidPhone')}</Notice>
        ) : null}
        {errors.phoneUsed ? (
          <Notice tone="error" className="mt-2">{t('auth.errorPhoneUsed')}</Notice>
        ) : null}
      </Card>

      {saveFailed ? <Notice tone="error">{t('auth.errorRegister')}</Notice> : null}

      <Button type="submit" full disabled={saving}>
        {saving ? t('shared.saving') : t('auth.registerSubmit')}
      </Button>
      <p className="text-center text-sm leading-relaxed text-slate-600">{t('auth.registerHint')}</p>
    </form>
  );
}

/** Login or register for one kind of account. */
export default function StartAuthPage() {
  const { t } = useTranslation();
  const { type } = useParams<{ type: string }>();

  const kind: AccountKind | null =
    type === 'worker' ? 'worker' : type === 'mother' ? 'mother' : null;

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [registeredPhone, setRegisteredPhone] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);

  if (!kind) return <Navigate to="/start" replace />;

  return (
    <EntryShell
      backTo="/start"
      title={kind === 'worker' ? t('auth.workerTitle') : t('auth.motherTitle')}
      subtitle={kind === 'worker' ? t('auth.workerSubtitle') : t('auth.motherSubtitle')}
    >
      {kind === 'worker' ? (
        <div role="tablist" aria-label={t('auth.tabsLabel')} className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200 p-1">
          {(['login', 'register'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={[
                'min-h-12 rounded-xl text-base font-bold',
                tab === option ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-700',
              ].join(' ')}
            >
              {t(`auth.tab.${option}`)}
            </button>
          ))}
        </div>
      ) : null}

      {justRegistered ? (
        <Notice tone="success" className="mb-3">
          {t('auth.registeredNotice')}
        </Notice>
      ) : null}

      {kind === 'worker' && tab === 'register' ? (
        <WorkerRegisterForm
          onRegistered={(phone) => {
            setRegisteredPhone(phone);
            setJustRegistered(true);
            setTab('login');
          }}
        />
      ) : (
        <>
          <PhoneAuth key={`${kind}-${registeredPhone}`} kind={kind} initialPhone={registeredPhone} />
          {kind === 'mother' ? (
            <p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm leading-relaxed text-slate-700">
              {t('auth.motherRegisterNote')}
            </p>
          ) : null}
        </>
      )}
    </EntryShell>
  );
}
