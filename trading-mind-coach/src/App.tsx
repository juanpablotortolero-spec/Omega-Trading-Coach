import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { getTradingPlan } from './lib/api';
import Login from './components/Login';
import MainLayout from './components/MainLayout';

const Bienvenida = lazy(() => import('./pages/Bienvenida'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TradingPlan = lazy(() => import('./pages/TradingPlan'));
const JournalEntry = lazy(() => import('./pages/JournalEntry'));
const Historial = lazy(() => import('./pages/Historial'));
const Estadisticas = lazy(() => import('./pages/Estadisticas'));
const Social = lazy(() => import('./pages/Social'));
const SharedEntry = lazy(() => import('./pages/SharedEntry'));
const Agoras = lazy(() => import('./pages/Agoras'));
const AgoraDetail = lazy(() => import('./pages/AgoraDetail'));
const Perfil = lazy(() => import('./pages/Perfil'));
const Buzon = lazy(() => import('./pages/Buzon'));
const Conexiones = lazy(() => import('./pages/Conexiones'));

function RouteFallback() {
  return <div className="skeleton skeleton-table" style={{ margin: '24px 0' }} />;
}

function App() {
  const { session, loading } = useAuth();
  const [planStatus, setPlanStatus] = useState<'loading' | 'missing' | 'ready'>('loading');

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setPlanStatus('loading');
    getTradingPlan(session.user.id).then((plan) => {
      if (cancelled) return;
      setPlanStatus(plan ? 'ready' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading) {
    return (
      <div className="auth-shell">
        <p className="eyebrow">Cargando…</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (planStatus === 'loading') {
    return (
      <div className="auth-shell">
        <p className="eyebrow">Cargando…</p>
      </div>
    );
  }

  if (planStatus === 'missing') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Bienvenida onComplete={() => setPlanStatus('ready')} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/manual-operativo" element={<TradingPlan />} />
          <Route path="/journal/nuevo" element={<JournalEntry />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/social" element={<Social />} />
          <Route path="/social/entrada/:id" element={<SharedEntry />} />
          <Route path="/agoras" element={<Agoras />} />
          <Route path="/agoras/:agoraId" element={<AgoraDetail />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/buzon" element={<Buzon />} />
          <Route path="/conexiones" element={<Conexiones />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
