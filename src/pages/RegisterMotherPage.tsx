import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState } from '../components/StateBlock';
import { Button, Card, Notice, inputClass, labelClass } from '../components/ui';
import { useSession } from '../context/SessionContext';
import type { Language } from '../data/model';
import { useVillages } from '../hooks/useVillages';
import { isValidPhone, normalizePhone } from '../services/authService';
import { phoneAlreadyUsed, registerMother } from '../services/journeyService';
import { LANGUAGES, type LanguageCode } from '../i18n';

/**
 * Register a mother: name, phone, village, preferred language and expected
 * delivery month. Her phone is what she later signs in with, so an ASHA must
 * record it here.
 */
export default function RegisterMotherPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worker, actor } = useSession();
  const villages = useVillages();
  const role = worker?.role ?? 'asha';
  const base = `/${role}`;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState(worker?.village ?? '');
  const [language, setLanguage] = useState<Language>('mr');
  const [month, setMonth] = useState('');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = {
      name: name.trim().length < 2,
      phone: !isValidPhone(phone),
      village: village.length === 0,
      month: month.length === 0,
    };
    setErrors(nextErrors);
    setSaveFailed(false);
    if (nextErrors.name || nextErrors.phone || nextErrors.village || nextErrors.month) return;

    setSaving(true);
    try {
      const normalized = normalizePhone(phone);
      if (await phoneAlreadyUsed(normalized)) {
        setErrors({ phoneUsed: true });
        return;
      }
      const { mother } = await registerMother(
        { name, phone: normalized, village, language, expectedDeliveryMonth: month },
        actor ?? { id: worker?.id ?? '', role },
      );
      void navigate(`${base}/mothers/${mother.id}`, { replace: true });
    } catch (caught) {
      console.error('MaaSetu: register mother failed', caught);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell backTo={base} title={t('register.title')} subtitle={t('register.subtitle')}>
      {!worker ? (
        <EmptyState title={t('journey.noAccessTitle')} body={t('journey.noAccessBody')} />
      ) : (
        <form onSubmit={(event) => void submit(event)} className="space-y-3">
          <Card>
            <label htmlFor="mother-name" className={labelClass}>
              {t('register.name')}
            </label>
            <input
              id="mother-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('register.namePlaceholder')}
              autoComplete="off"
              className={inputClass}
            />
            {errors.name ? (
              <Notice tone="error" className="mt-2">{t('register.errorName')}</Notice>
            ) : null}

            <label htmlFor="mother-phone" className={`${labelClass} mt-4`}>
              {t('register.phone')}
            </label>
            <input
              id="mother-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              className={inputClass}
            />
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('register.phoneHint')}</p>
            {errors.phone ? (
              <Notice tone="error" className="mt-2">{t('register.errorPhone')}</Notice>
            ) : null}
            {errors.phoneUsed ? (
              <Notice tone="error" className="mt-2">{t('register.errorPhoneUsed')}</Notice>
            ) : null}

            <label htmlFor="mother-village" className={`${labelClass} mt-4`}>
              {t('register.village')}
            </label>
            <select
              id="mother-village"
              value={village}
              onChange={(event) => setVillage(event.target.value)}
              className={inputClass}
            >
              <option value="">{t('register.villagePlaceholder')}</option>
              {villages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            {errors.village ? (
              <Notice tone="error" className="mt-2">{t('register.errorVillage')}</Notice>
            ) : null}

            <label htmlFor="mother-language" className={`${labelClass} mt-4`}>
              {t('register.language')}
            </label>
            <select
              id="mother-language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className={inputClass}
            >
              {LANGUAGES.map((code: LanguageCode) => (
                <option key={code} value={code}>
                  {t(`language.${code}`)}
                </option>
              ))}
            </select>

            <label htmlFor="mother-month" className={`${labelClass} mt-4`}>
              {t('register.deliveryMonth')}
            </label>
            <input
              id="mother-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={inputClass}
            />
            {errors.month ? (
              <Notice tone="error" className="mt-2">{t('register.errorMonth')}</Notice>
            ) : null}
          </Card>

          <Notice tone="info">{t('register.hint')}</Notice>
          {saveFailed ? <Notice tone="error">{t('register.errorSave')}</Notice> : null}

          <Button type="submit" full disabled={saving}>
            {saving ? t('shared.saving') : t('register.submit')}
          </Button>
        </form>
      )}
    </AppShell>
  );
}
