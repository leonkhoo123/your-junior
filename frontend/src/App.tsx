import { ThemeProvider } from './components/theme-provider'
import { Route, Routes, useNavigate } from "react-router-dom";
import { SonnerToastCustom } from './components/custom/soonerToast';
import { useEffect, lazy, Suspense, useRef, useState } from 'react';
import { AuthGate } from './components/auth/AuthGate';
import { VerificationScreen } from './components/auth/VerificationScreen';
import { getSetupStatus } from './api/api-auth';

const HomePage = lazy(() => import('./pages/HomePage'));
const IndexPage = lazy(() => import('./pages/IndexPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));

function AppLoadingFallback() {
  return <VerificationScreen subtitle="Loading..." />;
}

function App() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    const handleAuthUnauthorized = () => {
      if (window.location.pathname !== '/login') {
        void navigateRef.current('/login', { replace: true });
      }
    };
    window.addEventListener('auth:unauthorized', handleAuthUnauthorized);
    return () => { window.removeEventListener('auth:unauthorized', handleAuthUnauthorized); };
  }, []);

  useEffect(() => {
    if (window.location.pathname === '/setup') {
      setSetupChecked(true);
      return;
    }
    getSetupStatus()
      .then((res) => {
        if (res.setup_required) {
          void navigateRef.current('/setup', { replace: true });
        }
      })
      .catch(() => undefined)
      .finally(() => { setSetupChecked(true); });
  }, []);

  if (!setupChecked) {
    return <AppLoadingFallback />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Suspense fallback={<AppLoadingFallback />}>
        <Routes>
          <Route element={<IndexPage />} path="/" />
          <Route element={<SetupPage />} path="/setup" />
          <Route element={<AuthGate />}>
            <Route path="/home">
              <Route index element={<HomePage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
          </Route>
          <Route element={<LoginPage />} path="/login" />
        </Routes>
      </Suspense>
      <SonnerToastCustom />
    </ThemeProvider>
  )
}

export default App
