import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EntryShell } from '../components/EntryShell';
import { buttonClass } from '../components/ui';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <EntryShell title={t('notFound.heading')}>
      <p className="text-base leading-relaxed text-slate-700">{t('notFound.body')}</p>
      <Link to="/" className={buttonClass('primary', 'mt-4 w-full')}>
        {t('notFound.back')}
      </Link>
    </EntryShell>
  );
}
