import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  RequireMother,
  RequireWorker,
  SignedOutOnly,
} from './components/RequireSession';
import { SessionProvider } from './context/SessionContext';
import HandoverConsentPage from './pages/HandoverConsentPage';
import JourneyCardPage from './pages/JourneyCardPage';
import MotherHome from './pages/MotherHome';
import NotFound from './pages/NotFound';
import NotificationInbox from './pages/NotificationInbox';
import RegisterMotherPage from './pages/RegisterMotherPage';
import StartAuthPage from './pages/StartAuthPage';
import StartChoicePage from './pages/StartChoicePage';
import WelcomeScreen from './pages/WelcomeScreen';
import WhatsAppPreviewPage from './pages/WhatsAppPreviewPage';
import WorkerHome from './pages/WorkerHome';

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `${t('app.name')} · ${t('app.tagline')}`;
  }, [t, i18n.language]);

  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          {/* Entry flow: only for visitors without a session */}
          <Route
            path="/"
            element={
              <SignedOutOnly>
                <WelcomeScreen />
              </SignedOutOnly>
            }
          />
          <Route
            path="/start"
            element={
              <SignedOutOnly>
                <StartChoicePage />
              </SignedOutOnly>
            }
          />
          <Route
            path="/start/:type"
            element={
              <SignedOutOnly>
                <StartAuthPage />
              </SignedOutOnly>
            }
          />

          {/* ASHA / ANM areas */}
          <Route
            path="/asha"
            element={
              <RequireWorker role="asha">
                <WorkerHome />
              </RequireWorker>
            }
          />
          <Route
            path="/asha/register"
            element={
              <RequireWorker role="asha">
                <RegisterMotherPage />
              </RequireWorker>
            }
          />
          <Route
            path="/asha/mothers/:motherId"
            element={
              <RequireWorker role="asha">
                <JourneyCardPage />
              </RequireWorker>
            }
          />
          <Route
            path="/asha/mothers/:motherId/handover"
            element={
              <RequireWorker role="asha">
                <HandoverConsentPage />
              </RequireWorker>
            }
          />

          <Route
            path="/anm"
            element={
              <RequireWorker role="anm">
                <WorkerHome />
              </RequireWorker>
            }
          />
          <Route
            path="/anm/register"
            element={
              <RequireWorker role="anm">
                <RegisterMotherPage />
              </RequireWorker>
            }
          />
          <Route
            path="/anm/mothers/:motherId"
            element={
              <RequireWorker role="anm">
                <JourneyCardPage />
              </RequireWorker>
            }
          />
          <Route
            path="/anm/mothers/:motherId/handover"
            element={
              <RequireWorker role="anm">
                <HandoverConsentPage />
              </RequireWorker>
            }
          />

          {/* Mother area */}
          <Route
            path="/mother"
            element={
              <RequireMother>
                <MotherHome />
              </RequireMother>
            }
          />

          {/* Worker tools */}
          <Route
            path="/notifications"
            element={
              <RequireWorker>
                <NotificationInbox />
              </RequireWorker>
            }
          />
          <Route
            path="/whatsapp-preview"
            element={
              <RequireWorker>
                <WhatsAppPreviewPage />
              </RequireWorker>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
