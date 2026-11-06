import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { StoreLayout } from './components/layout';
import { ToastProvider } from './components/ui';
import { AuthProvider, RequireAuth, StoreProvider } from './context';
import { Account, Admin, CreateStore, StoreSelect } from './pages/account';
import { ActivityPage } from './pages/activity';
import { CustomerDetail, CustomersList } from './pages/customers';
import { Docs } from './pages/docs';
import { LicenseDetail, LicensesList } from './pages/licenses';
import { Overview } from './pages/overview';
import { ProductDetail, ProductNew, ProductsList } from './pages/products';
import { AuthComplete, Landing, Login, NotFound, Redeem } from './pages/public';
import { SalesPage } from './pages/sales';
import { SettingsPage } from './pages/settings';
import { PurchasesPage, ShopPage, ShopProductPage } from './pages/shop';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    if (this.state.error) {
      return (
        <div className="center-page" style={{ minHeight: '100vh' }}>
          <div className="panel auth-card stack">
            <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
            <p className="muted" style={{ margin: 0 }}>An unexpected error occurred in the dashboard. Reloading usually fixes it.</p>
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function StoreRoutes() {
  return (
    <StoreProvider>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="products/new" element={<ProductNew />} />
          <Route path="products/:productId" element={<ProductDetail />} />
          <Route path="licenses" element={<LicensesList />} />
          <Route path="licenses/:licenseId" element={<LicenseDetail />} />
          <Route path="customers" element={<CustomersList />} />
          <Route path="customers/:customerId" element={<CustomerDetail />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/complete" element={<AuthComplete />} />
              <Route path="/redeem" element={<Redeem />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/store/:slug" element={<ShopPage />} />
              <Route path="/store/:slug/:productId" element={<ShopProductPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/app" element={<StoreSelect />} />
                <Route path="/app/stores/new" element={<CreateStore />} />
                <Route path="/app/account" element={<Account />} />
                <Route path="/purchases" element={<PurchasesPage />} />
                <Route path="/app/s/:storeId/*" element={<StoreRoutes />} />
                <Route path="/admin" element={<Admin />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
