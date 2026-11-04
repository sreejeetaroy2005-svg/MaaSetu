/**
 * MaaSetu — show a mother's offline QR summary.
 *
 * The code carries her name, home village and the milestones recorded as done,
 * with dates. It never carries visit notes or anything about her health, and it
 * is readable with no connection at all.
 */
import { useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ConnectionNote } from '../components/ConnectionBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlock';
import { Card, Notice } from '../components/ui';
import { QrIcon } from '../components/icons';
import { useSession } from '../context/SessionContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { loadMotherCard, type MotherCardBundle } from '../offline/repo';
import { formatDate } from '../utils/date';
import { buildQrSummary, encodeQrSummary, milestoneLabelKey, type QrSummary } from '../utils/qr';

export default function ShareQrPage() {
  const { motherId } = useParams<{ motherId: string }>();
  const { t, i18n } = useTranslation();
  const { worker } = useSession();
  const role = worker?.role ?? 'asha';

  const { data, loading, error, reload } = useAsyncData<MotherCardBundle | null>(
    async () => (motherId ? loadMotherCard(motherId) : null),
    [motherId],
  );

  const [summary, setSummary] = useState<QrSummary | null>(null);
  const [code, setCode] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!data) return;
    const next = buildQrSummary(data.mother, data.card, data.villageName);
    const nextCode = encodeQrSummary(next);
    setSummary(next);
    setCode(nextCode);
    setImageFailed(false);
    void toDataURL(nextCode, { margin: 1, width: 720, errorCorrectionLevel: 'M' })
      .then((url) => setImage(url))
      .catch((caught: unknown) => {
        console.error('MaaSetu: could not draw the QR code', caught);
        setImageFailed(true);
      });
  }, [data]);

  return (
    <AppShell
      backTo={motherId ? `/${role}/mothers/${motherId}` : `/${role}`}
      title={t('qr.title')}
      subtitle={data?.mother.name}
    >
      {loading ? <LoadingState label={t('shared.loading')} /> : null}
      {error ? <ErrorState onRetry={reload} /> : null}

      {!loading && !error && !data ? (
        <EmptyState
          icon={<QrIcon className="h-6 w-6" />}
          title={t('journey.missingTitle')}
          body={t('journey.missingBody')}
        />
      ) : null}

      {data && summary ? (
        <>
          <Card>
            <p className="text-base leading-relaxed text-slate-700">{t('qr.subtitle')}</p>
            <ConnectionNote />

            <div className="mt-3 flex justify-center rounded-2xl border border-slate-200 bg-white p-3">
              {image ? (
                <img src={image} alt={t('qr.codeAlt')} className="h-64 w-64" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-slate-600">
                  {imageFailed ? t('qr.qrFailed') : t('shared.loading')}
                </div>
              )}
            </div>

            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {t('qr.motherLabel')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">{summary.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {t('qr.villageLabel')}
                </dt>
                <dd className="text-base font-semibold text-slate-900">{summary.village}</dd>
              </div>
            </dl>

            <h2 className="mt-4 text-base font-bold text-slate-900">{t('qr.milestones')}</h2>
            {summary.milestones.length === 0 ? (
              <p className="mt-1 text-base text-slate-600">{t('qr.none')}</p>
            ) : (
              <ul className="mt-2 space-y-1">
                {summary.milestones.map((milestone) => {
                  const key = milestoneLabelKey(milestone.templateId);
                  return (
                    <li
                      key={milestone.templateId}
                      className="flex justify-between gap-2 text-base text-slate-800"
                    >
                      <span className="min-w-0 truncate">{key ? t(key) : milestone.templateId}</span>
                      <span className="shrink-0 font-semibold">
                        {formatDate(milestone.date, i18n.language)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('qr.contains')}</p>
          </Card>

          <Notice tone="info" className="mt-3">
            {t('qr.offlineShare')}
          </Notice>

          <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-bold text-slate-700">
              {t('qr.codeText')}
            </summary>
            <textarea
              readOnly
              value={code}
              rows={4}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-2 w-full rounded-xl border-2 border-slate-200 bg-slate-50 p-2 font-mono text-xs break-all text-slate-800"
            />
          </details>

          <Link
            to="/scan"
            className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-700 px-4 text-base font-bold text-brand-800"
          >
            <QrIcon className="h-5 w-5" />
            {t('qr.openScanner')}
          </Link>
        </>
      ) : null}
    </AppShell>
  );
}
