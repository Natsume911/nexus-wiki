import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { SearchPalette } from '@/components/search/SearchPalette';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { KeyboardShortcuts } from '@/components/editor/KeyboardShortcuts';
import { HomePage } from '@/routes/HomePage';
import { SpacePage } from '@/routes/SpacePage';
import { NotFoundPage } from '@/routes/NotFoundPage';
import { useT } from '@/i18n';

const PagePage = lazy(() => import('@/routes/PagePage').then(m => ({ default: m.PagePage })));
const AdminPage = lazy(() => import('@/routes/AdminPage').then(m => ({ default: m.AdminPage })));
const GraphPage = lazy(() => import('@/routes/GraphPage').then(m => ({ default: m.GraphPage })));
import { LandingPage } from '@/components/landing/LandingPage';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useSocket } from '@/hooks/useSocket';
import { ShieldOff } from 'lucide-react';

function AccessDeniedPage() {
  const t = useT();
  const { accessDeniedMessage } = useAuthStore();
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center">
      <div className="text-center max-w-md p-8">
        <div className="h-16 w-16 rounded-2xl bg-red-400/10 text-red-400 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-display font-bold text-text-primary mb-3">{t('access.denied')}</h1>
        <p className="text-text-muted mb-6">
          {accessDeniedMessage || t('access.deniedMessage')}
        </p>
        <p className="text-xs text-text-muted">{t('access.contactAdmin')}</p>
      </div>
    </div>
  );
}

function App() {
  const t = useT();
  const { fetchUser, loading, accessDenied } = useAuthStore();
  // Initialize theme on mount
  useThemeStore();
  // Initialize Socket.io connection
  useSocket();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Show access denied page if user is not active
  if (!loading && accessDenied) {
    return (
      <ErrorBoundary>
        <AccessDeniedPage />
        <ToastProvider />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={
          <AppLayout>
            <HomePage />
          </AppLayout>
        } />
        <Route path="/:spaceSlug" element={
          <AppLayout>
            <SpacePage />
          </AppLayout>
        } />
        <Route path="/:spaceSlug/graph" element={
          <AppLayout>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-text-muted">{t('app.loading')}</div>}>
              <GraphPage />
            </Suspense>
          </AppLayout>
        } />
        <Route path="/:spaceSlug/:pageSlug" element={
          <AppLayout>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-text-muted">{t('app.loading')}</div>}>
              <PagePage />
            </Suspense>
          </AppLayout>
        } />
        <Route path="/admin" element={
          <AppLayout>
            <Suspense fallback={<div className="flex items-center justify-center h-full text-text-muted">{t('app.loading')}</div>}>
              <AdminPage />
            </Suspense>
          </AppLayout>
        } />
        <Route path="/welcome" element={<LandingPage />} />
        <Route path="*" element={
          <AppLayout>
            <NotFoundPage />
          </AppLayout>
        } />
      </Routes>
      <SearchPalette />
      <KeyboardShortcuts />
      <ToastProvider />
    </ErrorBoundary>
  );
}

export default App;
