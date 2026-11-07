/**
 * MaaSetu — phone + OTP form (the only place the app signs anyone in).
 *
 * Production (VITE_USE_EMULATORS != 'true'):
 *   Uses RecaptchaVerifier (invisible) + signInWithPhoneNumber.
 *   No demo fallback. All Firestore requests carry a real Firebase Auth user.
 *
 * Emulator (VITE_USE_EMULATORS == 'true'):
 *   Shows a code hint from the emulator. If the emulator is unreachable,
 *   falls back to the demo code (dev only).
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
import { demoMode, usingEmulators } from '../services/firebase';
import { homePathFor, useSession } from '../context/SessionContext';
import { Button, Card, Notice, inputClass, labelClass } from './ui';
import { PhoneIcon } from './icons';
import { WORKERS, MOTHERS } from '../data/seedData';

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
  | 'unauthorizedDomain'
  | 'tooManyRequests'
  | null;

/** Map Firebase auth error codes to our error keys */
function classifyAuthError(error: unknown): ErrorKey {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code === 'auth/invalid-verification-code' || code === 'auth/code-expired') {
      return 'verifyFailed';
    }
    if (code === 'auth/invalid-phone-number' || code === 'auth/missing-phone-number') {
      return 'invalidPhone';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'unauthorizedDomain';
    }
    if (code === 'auth/too-many-requests' || code === 'auth/quota-exceeded') {
      return 'tooManyRequests';
    }
  }
  return null;
}

export function PhoneAuth({ kind, initialPhone = '' }: PhoneAuthProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh } = useSession();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState('');
  const [codeHint, setCodeHint] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OtpChallenge | null>(null);
  const [emulatorOffline, setEmulatorOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey>(null);

  const refreshCodeHint = (normalizedPhone: string) => {
    // Only fetch code hints when running against the emulator
    if (!usingEmulators) return;
    void latestEmulatorCode(normalizedPhone).then((c) => setCodeHint(c));
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
      setConfirmation(result);
      setEmulatorOffline(false);
      setCodeHint(null);

      if (usingEmulators) {
        // Emulator: show the code the emulator issued for this number
        refreshCodeHint(normalizePhone(phone));
      }

      setStep('code');
    } catch (caught) {
      if (usingEmulators) {
        // Dev fallback: the demo code still works if the Auth emulator is down.
        console.warn('MaaSetu: emulator OTP unavailable, using the demo code', caught);
        setConfirmation(null);
        setEmulatorOffline(true);
        setCodeHint(null);
        setStep('code');
      } else {
        // Production: surface the real error
        const classified = classifyAuthError(caught);
        setError(classified ?? 'sendFailed');
        console.error('MaaSetu: sendOtp failed', caught);
      }
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
      } else if (usingEmulators && startDemoSession(phone, code)) {
        // Emulator offline fallback accepted — session is set
      } else {
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
      const classified = classifyAuthError(caught);
      setError(classified ?? 'verifyFailed');
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
          ? t('auth.errorCode', { code: DEMO_OTP })
          : error === 'workerNotFound'
            ? t('auth.errorWorkerNotFound')
            : error === 'motherNotFound'
              ? t('auth.errorMotherNotFound')
              : error === 'unauthorizedDomain'
                ? t('auth.errorUnauthorizedDomain')
                : error === 'tooManyRequests'
                  ? t('auth.errorTooManyRequests')
                  : null;

  // Demo numbers shown when demoMode is true (hosted or local)
  const demoWorkerPhones = demoMode ? WORKERS.map((w) => `${w.phone} (${w.name})`) : [];
  const demoMotherPhones = demoMode ? MOTHERS.map((m) => `${m.phone} (${m.name})`) : [];
  const demoNumbers = kind === 'mother' ? demoMotherPhones : demoWorkerPhones;

  if (step === 'phone') {
    return (
      <>
        {/* Invisible reCAPTCHA container — required by Firebase phone auth in production */}
        <div id="recaptcha-container" />

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

          {demoMode ? (
            <Notice tone="info">
              {t('auth.demoNote', { code: DEMO_OTP })}
              {demoNumbers.length > 0 ? (
                <ul className="mt-1 list-disc pl-4 text-sm">
                  {demoNumbers.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </Notice>
          ) : null}
        </form>
      </>
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

      {usingEmulators && emulatorOffline ? (
        <Notice tone="warn">{t('auth.offlineHint', { code: DEMO_OTP })}</Notice>
      ) : null}
      {errorMessage ? <Notice tone="error">{errorMessage}</Notice> : null}
      {demoMode ? (
        codeHint ? (
          <Notice tone="info">{t('auth.codeHint', { code: codeHint })}</Notice>
        ) : (
          <Notice tone="info">{t('auth.demoNote', { code: DEMO_OTP })}</Notice>
        )
      ) : null}
    </form>
  );
}
