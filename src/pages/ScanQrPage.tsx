/**
 * MaaSetu — read a QR summary on a phone with no connection.
 *
 * A scanned code is shown as "Offline summary, not yet verified" until it has
 * been checked against the server. Verification never changes anything: it
 * only compares the code with the record.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '../components/AppShell';
import { ConnectionNote } from '../components/ConnectionBadge';
import { Card, Notice } from '../components/ui';
import { AlertIcon, CheckIcon, QrIcon, ShieldIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { useNetwork } from '../hooks/useOffline';
import { loadWorkspace } from '../offline/repo';
import { formatDate } from '../utils/date';
import {
  decodeQrSummary,
  milestoneLabelKey,
  summaryMatchesServer,
  type QrSummary,
} from '../utils/qr';

type Verification = 'idle' | 'checking' | 'verified' | 'mismatch' | 'offline';

export default function ScanQrPage() {
  const { t, i18n } = useTranslation();
  const { worker } = useSession();
  const role = worker?.role ?? 'asha';
  const network = useNetwork();

  const [input, setInput] = useState('');
  const [summary, setSummary] = useState<QrSummary | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [verification, setVerification] = useState<Verification>('idle');

  const read = () => {
    const decoded = decodeQrSummary(input);
    setSummary(decoded);
    setInvalid(!decoded);
    setVerification('idle');
  };

  const verify = async () => {
    if (!summary) return;
    if (network.status === 'offline') {
      setVerification('offline');
      return;
    }
    setVerification('checking');
    try {
      const workspace = await loadWorkspace();
      const mother = workspace.mothers.find((item) => item.id === summary.motherId) ?? null;
      const card = workspace.cards.find((item) => item.motherId === summary.motherId) ?? null;
      setVerification(summaryMatchesServer(summary, mother, card) ? 'verified' : 'mismatch');
    } catch {
      setVerification('offline');
    }
  };

  return (
    <AppShell backTo={`/${role}`} title={t('qr.scanTitle')} subtitle={t('qr.scanSubtitle')}>
      <Card>
        <p className="text-base leading-relaxed text-slate-700">{t('qr.scanBody')}</p>
        <ConnectionNote />

        <label htmlFor="qr-input" className="mt-3 block text-sm font-bold text-slate-800">
          {t('qr.scanPlaceholder')}
        </label>
        <textarea
          id="qr-input"
          rows={4}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="MaaSetu…"
          className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white p-2 font-mono text-xs break-all text-slate-900"
        />
        <button
          type="button"
          onClick={read}
          disabled={input.trim().length === 0}
          className="mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 px-4 text-base font-bold text-white disabled:opacity-50"
        >
          <QrIcon className="h-5 w-5" />
          {t('qr.scanButton')}
        </button>

        {invalid ? (
          <Notice tone="error" className="mt-3">
            {t('qr.invalid')}
          </Notice>
        ) : null}
      </Card>

      {summary ? (
        <section className="mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-900">
            <AlertIcon className="h-5 w-5 shrink-0" />
            {verification === 'verified' ? t('qr.verifiedTitle') : t('qr.summaryTitle')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            {verification === 'verified' ? t('qr.verifiedBody') : t('qr.summaryBody')}
          </p>

          <dl className="mt-3 space-y-1">
            <div>
              <dt className="text-xs font-bold tracking-wide text-amber-900/80 uppercase">{t('qr.motherLabel')}</dt>
              <dd className="text-lg font-bold text-slate-900">{summary.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-amber-900/80 uppercase">{t('qr.villageLabel')}</dt>
              <dd className="text-base font-semibold text-slate-900">{summary.village}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold tracking-wide text-amber-900/80 uppercase">{t('qr.issuedAt')}</dt>
              <dd className="text-sm text-slate-800">{formatDate(summary.issuedAt.slice(0, 10), i18n.language)}</dd>
            </div>
          </dl>

          <h3 className="mt-3 text-base font-bold text-slate-900">{t('qr.milestones')}</h3>
          {summary.milestones.length === 0 ? (
            <p className="text-sm text-slate-700">{t('qr.none')}</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {summary.milestones.map((milestone) => {
                const key = milestoneLabelKey(milestone.templateId);
                return (
                  <li key={milestone.templateId} className="flex justify-between gap-2 text-base text-slate-900">
                    <span className="min-w-0 truncate">{key ? t(key) : milestone.templateId}</span>
                    <span className="shrink-0 font-semibold">{formatDate(milestone.date, i18n.language)}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {verification === 'verified' ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-white p-2 text-sm font-bold text-emerald-800">
              <CheckIcon className="h-4 w-4 shrink-0" />
              {t('qr.verifiedShort')}
            </p>
          ) : verification === 'mismatch' ? (
            <p className="mt-3 rounded-xl bg-white p-3 text-sm font-semibold text-red-800">
              {t('qr.mismatchTitle')} {t('qr.mismatchBody')}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void verify()}
                disabled={verification === 'checking'}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-700 bg-white px-4 text-base font-bold text-amber-900 disabled:opacity-60"
              >
                <ShieldIcon className="h-5 w-5" />
                {verification === 'checking' ? t('shared.loading') : t('qr.verify')}
              </button>
              {verification === 'offline' ? (
                <p className="mt-2 text-sm font-semibold text-amber-900">{t('qr.verifyOffline')}</p>
              ) : null}
            </>
          )}
          <p className="mt-3 text-xs leading-relaxed text-slate-700">{t('qr.contains')}</p>
        </section>
      ) : null}
    </AppShell>
  );
}
