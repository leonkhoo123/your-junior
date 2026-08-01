import { useState, useEffect, Suspense, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { getSetupStatus, checkAuthStatus } from '@/api/api-auth';
import { VerificationScreen } from './VerificationScreen';

const MIN_VERIFY_MS = 400;

export function AuthGate() {
  const [status, setStatus] = useState<'verifying' | 'authenticated'>('verifying');
  const navigate = useNavigate();
  const navigatingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    navigatingRef.current = false;
    const startTime = Date.now();

    const finish = async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_VERIFY_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_VERIFY_MS - elapsed));
      }
    };

    void getSetupStatus()
      .then(async (setupRes) => {
        if (setupRes.setup_required) {
          await finish();
          if (!cancelled && !navigatingRef.current) {
            navigatingRef.current = true;
            void navigate('/setup', { replace: true });
          }
          return;
        }

        void checkAuthStatus()
          .then(async () => {
            await finish();
            if (!cancelled) setStatus('authenticated');
          })
          .catch(async () => {
            await finish();
            if (!cancelled && !navigatingRef.current) {
              navigatingRef.current = true;
              void navigate('/login', { replace: true });
            }
          });
      })
      .catch(async () => {
        await finish();
        if (!cancelled && !navigatingRef.current) {
          navigatingRef.current = true;
          void navigate('/login', { replace: true });
        }
      });

    return () => { cancelled = true; };
  }, [navigate]);

  if (status === 'verifying') {
    return <VerificationScreen />;
  }

  return (
    <Suspense fallback={<VerificationScreen subtitle="Loading..." />}>
      <Outlet />
    </Suspense>
  );
}
