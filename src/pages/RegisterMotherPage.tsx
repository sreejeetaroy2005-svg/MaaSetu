import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ErrorState, LoadingState, PlaceholderNote } from '../components/StateBlock';
import { useSession } from '../context/SessionContext';
import type { Language, Role, User, Village } from '../data/model';
import { useAsyncData } from '../hooks/useAsyncData';
import { listVillages, listWorkersByRole, registerMother } from '../services/journeyService';
import { LANGUAGES, LANGUAGE_LABELS, type LanguageCode } from '../i18n';

type WorkerRole = Extract<Role, 'asha' | 'anm'>;

interface FormData {
  villages: Village[];
  worker: User | null;
}

/** Register a mother: name, village, preferred language, expected delivery month. */
export default function RegisterMotherPage({ role }: { role: WorkerRole }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workerIdFor, actorFor } = useSession();
  const selectedId = workerIdFor(role);

  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [language, setLanguage] = useState<Language>('mr');
  const [month, setMonth] = useState('');
  const [errors, setErrors] = useState<{ name?: boolean; village?: boolean; month?: boolean }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const { data, loading, error, reload } = useAsyncData<FormData>(async () => {
    const [villages, workers] = await Promise.all([listVillages(), listWorkersByRole(role)]);
    const worker = workers.find((w) => w.id === selectedId) ?? workers[0] ?? null;
    return { villages, worker };
  }, [role, selectedId]);

  // Pre-fill from the worker: her village and the language she uses.
  useEffect(() => {
    if (!data?.worker) return;
    setVillage((current) => current || data.worker!.village);
    setLanguage((current) => (current === 'mr' ? data.worker!.language : current));
  }, [data]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      name: name.trim().length < 2,
      village: village.length === 0,
      month: month.length === 0,
    };
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.village || nextErrors.month) return;

    setSaving(true);
    setSaveError(false);
    try {
      const { mother } = await registerMother(
        { name, village, language, expectedDeliveryMonth: month },
        actorFor(role),
      );
      void navigate(`/${role}/mothers/${mother.id}`);
    } catch (caught) {
      console.error('MaaSetu: register mother failed', caught);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell roleArea={role} backTo={`/${role}`} title={t('register.title')}>
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error ? (
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div>
            <label htmlFor="mother-name" className="block text-base font-semibold text-slate-800">
              {t('register.name')}
            </label>
            <input
              id="mother-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('register.namePlaceholder')}
              autoComplete="off"
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
            />
            {errors.name ? (
              <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {t('register.errorName')}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="mother-village" className="block text-base font-semibold text-slate-800">
              {t('register.village')}
            </label>
            <select
              id="mother-village"
              value={village}
              onChange={(event) => setVillage(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
            >
              <option value="">{t('register.villagePlaceholder')}</option>
              {(data?.villages ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.village ? (
              <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {t('register.errorVillage')}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="mother-language" className="block text-base font-semibold text-slate-800">
              {t('register.language')}
            </label>
            <select
              id="mother-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
            >
              {LANGUAGES.map((code: LanguageCode) => (
                <option key={code} value={code}>
                  {LANGUAGE_LABELS[code]} · {t(`language.${code}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="mother-month" className="block text-base font-semibold text-slate-800">
              {t('register.deliveryMonth')}
            </label>
            <input
              id="mother-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base"
            />
            {errors.month ? (
              <p role="alert" className="mt-1 text-sm font-semibold text-red-700">
                {t('register.errorMonth')}
              </p>
            ) : null}
          </div>

          <PlaceholderNote>{t('register.hint')}</PlaceholderNote>

          {saveError ? (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              {t('register.errorSave')}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="min-h-14 w-full rounded-2xl bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-60"
          >
            {saving ? t('shared.saving') : t('register.submit')}
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
