import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { CipherApiError, type MeDTO, type Permission, type StoreDTO } from '@cipher/shared';
import { api } from './lib';
import { ErrorState, PageLoader } from './components/ui';

/* ---------------------------------------------------------------- auth */

interface AuthState {
  me: MeDTO | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState>({ me: null, loading: true, refresh: async () => undefined, logout: async () => undefined });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch (e) {
      if (!(e instanceof CipherApiError && e.status === 401)) console.warn('Session check failed', e);
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <AuthCtx.Provider value={{ me, loading, refresh, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export function RequireAuth() {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageLoader />;
  if (!me) return <Navigate to={`/login?redirect=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Outlet />;
}

/* ---------------------------------------------------------------- store */

interface StoreState {
  store: StoreDTO;
  can: (p: Permission) => boolean;
  isOwner: boolean;
  reload: () => void;
}

const StoreCtx = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { storeId } = useParams();
  const [store, setStore] = useState<StoreDTO | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setError(null);
    api
      .store(storeId!)
      .then((s) => live && setStore(s))
      .catch((e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [storeId, tick]);
  if (error) {
    if (error instanceof CipherApiError && error.status === 404) return <Navigate to="/app" replace />;
    return <ErrorState error={error} onRetry={() => setTick((t) => t + 1)} />;
  }
  if (!store || store.id !== storeId) return <PageLoader />;
  const perms = new Set(store.permissions);
  return (
    <StoreCtx.Provider value={{ store, can: (p) => perms.has(p), isOwner: store.role === 'owner', reload: () => setTick((t) => t + 1) }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore(): StoreState {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
