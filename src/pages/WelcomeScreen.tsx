import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EntryShell } from '../components/EntryShell';
import { ArrowRightIcon, HeartIcon } from '../components/icons';
import { buttonClass } from '../components/ui';
import { demoMode } from '../services/firebase';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const isDemo = demoMode;
  const [demoLoaded, setDemoLoaded] = useState(false);

  // Load demo data once when component mounts in demo mode
  useEffect(() => {
    if (isDemo && !demoLoaded) {
      import('../services/journeyService').then((module) => {
        module.loadDemoData().then(() => {
          setDemoLoaded(true);
        });
      });
    }
  }, [isDemo, demoLoaded]);

  return (
    <EntryShell center>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <HeartIcon className="h-9 w-9" />
        </span>

        <h1 className="mt-5 text-4xl leading-tight font-extrabold text-slate-900">
          {t('app.name')}
        </h1>
        <p className="mt-1 text-xl leading-snug font-semibold text-brand-800">
          {t('app.tagline')}
        </p>
        <p className="mt-4 max-w-[26rem] text-base leading-relaxed text-slate-700">
          {t('welcome.explanation')}
        </p>
      </div>

      <Link to="/start" className={buttonClass('primary', 'mt-6 w-full min-h-14 text-lg')}>
        {t('welcome.start')}
        <ArrowRightIcon className="h-6 w-6" />
      </Link>

      {isDemo && !demoLoaded && (
        <button
          onClick={() => {
            if (!confirm(t('demo.loadConfirm'))) return;
            import('../services/journeyService').then((module) => {
              module.loadDemoData().then(() => {
                setDemoLoaded(true);
              });
            });
          }}
          className={buttonClass('secondary', 'mt-4 w-full min-h-14 text-lg')}
        >
          {t('demo.load')}
        </button>
      )}

      <p className="mt-3 text-center text-sm font-semibold text-slate-600">
        {t('welcome.demoNote')}
      </p>
    </EntryShell>
  );
}