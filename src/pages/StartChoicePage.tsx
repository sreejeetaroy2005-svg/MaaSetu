import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntryShell } from '../components/EntryShell';
import { ChevronRightIcon, HealthWorkerIcon, HeartIcon } from '../components/icons';

/** Two big choices: a health worker or a mother/family member. */
export default function StartChoicePage() {
  const { t } = useTranslation();

  const choices = [
    {
      to: '/start/worker',
      icon: <HealthWorkerIcon className="h-8 w-8" />,
      title: t('start.workerTitle'),
      body: t('start.workerBody'),
    },
    {
      to: '/start/mother',
      icon: <HeartIcon className="h-8 w-8" />,
      title: t('start.motherTitle'),
      body: t('start.motherBody'),
    },
  ];

  return (
    <EntryShell backTo="/" title={t('start.title')} subtitle={t('start.subtitle')}>
      <ul className="space-y-4">
        {choices.map((choice) => (
          <li key={choice.to}>
            <Link
              to={choice.to}
              className="flex min-h-28 items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm active:border-brand-600"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-800">
                {choice.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg leading-snug font-bold text-slate-900">
                  {choice.title}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-600">
                  {choice.body}
                </span>
              </span>
              <ChevronRightIcon className="h-6 w-6 shrink-0 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
    </EntryShell>
  );
}
