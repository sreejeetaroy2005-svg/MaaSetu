import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ROLE_PATH, RoleProvider, useRole } from './context/RoleContext';
import { SessionProvider } from './context/SessionContext';
import HandoverConsentPage from './pages/HandoverConsentPage';
import JourneyCardPage from './pages/JourneyCardPage';
import MotherHome from './pages/MotherHome';
import NotFound from './pages/NotFound';
import RegisterMotherPage from './pages/RegisterMotherPage';
import WorkerHome from './pages/WorkerHome';

/** `/` opens whichever role area the demo switcher last selected. */
function HomeRedirect() {
  const { role } = useRole();
  return <Navigate to={ROLE_PATH[role]} replace />;
}

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `${t('app.name')} · ${i18n.language.toUpperCase()}`;
  }, [t, i18n.language]);

  return (
    <RoleProvider>
      <SessionProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />

            <Route path="/asha" element={<WorkerHome role="asha" />} />
            <Route path="/asha/register" element={<RegisterMotherPage role="asha" />} />
            <Route path="/asha/mothers/:motherId" element={<JourneyCardPage role="asha" />} />
            <Route
              path="/asha/mothers/:motherId/handover"
              element={<HandoverConsentPage role="asha" />}
            />

            <Route path="/anm" element={<WorkerHome role="anm" />} />
            <Route path="/anm/register" element={<RegisterMotherPage role="anm" />} />
            <Route path="/anm/mothers/:motherId" element={<JourneyCardPage role="anm" />} />
            <Route
              path="/anm/mothers/:motherId/handover"
              element={<HandoverConsentPage role="anm" />}
            />

            <Route path="/mother" element={<MotherHome />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SessionProvider>
    </RoleProvider>
  );
}
