/**
 * MaaSetu — phone + OTP form (the only place the prototype signs anyone in).
 *
 * Kept in one component so a real SMS provider can replace it later without
 * touching a single screen. In development the Auth emulator issues the verification
 * code, so the on-screen demo code is only a hint when the emulator is offline; the
 * real code is the one the emulator logs for this phone number.
 */
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DEMO_OTP,
  confirmOtp,
  isValidPhone,
  latestEmulatorCode,
  normalizePhone,
  resolveProfile,
  sendOtp,
  startDemoSession,
  type OtpChallenge,
} from '../services/authService';
import { homePathFor, useSession } from '../context/SessionContext';
import { Button, Card, Notice, inputClass, labelClass } from './ui';
import { PhoneIcon } from './icons';

type AccountKind = 'worker' | 'mother';

interface PhoneAuthProps {
  kind: AccountKind;
  initialPhone?: string;
}

type ErrorKey =
  | 'invalidPhone'
  | 'sendFailed'
  | 'verifyFailed'
  | 'workerNotFound'
  | 'motherNotFound'
  | null;

export function PhoneAuth({ kind, initialPhone = '' }: PhoneAuthProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useSession();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OtpChallenge | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey>(null);

  const refreshCodeHint = (normalizedPhone: string) => {
    void latestEmulatorCode(normalizedPhone).then((code) => setCodeHint(code));
  };

  const sendCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!isValidPhone(phone)) {
      setError('invalidPhone');
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await sendOtp(phone);
      if (!result) {
        setError('sendFailed');
        setBusy(false);
        return;
      }
      setConfirmation(result);
      setOffline(false);
      setCodeHint(null);

      // Dev only: the emulator issued a real code for this number; show it.
      // Normalization here matches the rest of the app so it works for 10-digit numbers too.
      refreshCodeHint(normalizePhone(phone));

      setStep('code');
    } catch (caught) {
      console.warn('MaaSetu: emulator OTP unavailable, using the demo code', caught);
      // Dev fallback: the demo code still works if the Auth emulator is down.
      setConfirmation(null);
      setOffline(true);
      setCodeHint(null);
      setStep('code');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (code.trim().length < 4) {
      setError('verifyFailed');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (confirmation) {
        await confirmOtp(confirmation, code);
      } else if (!startDemoSession(phone, code)) {
        setError('verifyFailed');
        setBusy(false);
        return;
      }

      const profile = await resolveProfile(phone);
      if (!profile) {
        setError(kind === 'mother' ? 'motherNotFound' : 'workerNotFound');
        setBusy(false);
        return;
      }

      refresh();
      void navigate(homePathFor(profile), { replace: true });
    } catch (caught) {
      console.error('MaaSetu: OTP verification failed', caught);
      setError('verifyFailed');
    } finally {
      setBusy(false);
    }
  };

  const errorMessage =
    error === 'invalidPhone'
      ? t('auth.errorInvalidPhone')
      : error === 'sendFailed'
        ? t('auth.errorSend')
        : error === 'verifyFailed'
          ? t('auth.errorCode')
          : error === 'workerNotFound'
            ? t('auth.errorWorkerNotFound')
            : error === 'motherNotFound'
              ? t('auth.errorMotherNotFound')
              : null;

  if (step === 'phone') {
    return (
      <form onSubmit={(event) => void sendCode(event)} className="space-y-3">
        <Card>
          <label htmlFor="auth-phone" className={labelClass}>
            {t('auth.phoneLabel')}
          </label>
          <div className="relative">
            <PhoneIcon className="pointer-events-none absolute top-4 left-3 h-5 w-5 text-slate-400" />
            <input
              id="auth-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              className={`${inputClass} pl-10`}
            />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {kind === 'mother' ? t('auth.motherPhoneHint') : t('auth.workerPhoneHint')}
          </p>
        </Card>

        {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}

        <Button type="submit" full disabled={busy}>
          {busy ? t('auth.sending') : t('auth.sendCode')}
        </Button>

        <Notice tone="info">{t('auth.demoNote', { code: DEMO_OTP })}</Notice>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => void verifyCode(event)} className="space-y-3">
      <Card>
        <p className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          {t('auth.codeSentTo')}
        </p>
        <p className="text-lg font-bold text-slate-900">{phone}</p>

        <label htmlFor="auth-code" className={`${labelClass} mt-3`}>
          {t('auth.codeLabel')}
        </label>
        <input
          id="auth-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          className={`${inputClass} text-center text-2xl tracking-[0.4em]`}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" full disabled={busy}>
            {busy ? t('auth.verifying') : t('auth.verify')}
          </Button>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setStep('phone');
              setCode('');
              setError(null);
            }}
          >
            {t('auth.changeNumber')}
          </Button>
          <Button variant="ghost" onClick={() => void sendCode()} disabled={busy}>
            {t('auth.resend')}
          </Button>
        </div>
      </Card>

      {offline ? <Notice tone="warn">{t('auth.offlineHint')}</Notice> : null}
      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
      {codeHint ? (
        <Notice tone="info">{t('auth.codeHint', { code: codeHint })}</Notice>
      ) : (
        <Notice tone="info">{t('auth.demoNote', { code: DEMO_OTP })}</Notice>
      )}
    </form>
  );
}
