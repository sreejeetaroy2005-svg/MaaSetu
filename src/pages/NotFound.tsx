import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">{t('notFound.heading')}</h1>
      <button
        type="button"
        onClick={() => void navigate('/')}
        className="mt-4 min-h-14 rounded-2xl border-2 border-brand-700 bg-white px-6 text-base font-semibold text-brand-700"
      >
        {t('notFound.back')}
      </button>
    </div>
  );
}
