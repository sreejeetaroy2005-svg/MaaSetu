import { lazy, Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { UpdatePrompt } from './components/UpdatePrompt';
import { RequireMother, RequireWorker, SignedOutOnly } from './components/RequireSession';
import { SessionProvider } from './context/SessionContext';
import NotFound from './pages/NotFound';
import StartAuthPage from './pages/StartAuthPage';
import StartChoicePage from './pages/StartChoicePage';
import WelcomeScreen from './pages/WelcomeScreen';

/**
 * Rarely used screens are split out of the first bundle and loaded on demand —
 * on a 2G connection the first screen matters most. Every chunk is precached by
 * the service worker, so a split screen still opens with no connection.
 */
const WorkerHome = lazy(() => import('./pages/WorkerHome'));
const JourneyCardPage = lazy(() => import('./pages/JourneyCardPage'));
const HandoverConsentPage = lazy(() => import('./pages/HandoverConsentPage'));
const MotherHome = lazy(() => import('./pages/MotherHome'));
const RegisterMotherPage = lazy(() => import('./pages/RegisterMotherPage'));
const NotificationInbox = lazy(() => import('./pages/NotificationInbox'));
const WhatsAppPreviewPage = lazy(() => import('./pages/WhatsAppPreviewPage'));
const ShareQrPage = lazy(() => import('./pages/ShareQrPage'));
const ScanQrPage = lazy(() => import('./pages/ScanQrPage'));
const SmsPreviewPage = lazy(() => import('./pages/SmsPreviewPage'));

/** Skeleton while a split screen arrives — never a blank screen. */
function RouteSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-slate-50 px-4 pt-4">
        <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = `${t('app.name')} · ${t('app.tagline')}`;
  }, [t, i18n.language]);

  return (
    <SessionProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteSkeleton />}>
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
              path="/asha/mothers/:motherId/qr"
              element={
                <RequireWorker role="asha">
                  <ShareQrPage />
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
            <Route
              path="/anm/mothers/:motherId/qr"
              element={
                <RequireWorker role="anm">
                  <ShareQrPage />
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
            <Route
              path="/scan"
              element={
                <RequireWorker>
                  <ScanQrPage />
                </RequireWorker>
              }
            />
            <Route
              path="/sms-preview"
              element={
                <RequireWorker>
                  <SmsPreviewPage />
                </RequireWorker>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <UpdatePrompt />
      </BrowserRouter>
    </SessionProvider>
  );
}
