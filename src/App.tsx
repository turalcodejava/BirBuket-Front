/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import React, { useEffect } from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Services from './components/Services';
import About from './components/About';
import PlantDoctor from './components/PlantDoctor';
import PlantDoctorReservation from './components/PlantDoctorReservation';
import PlantDoctorReservationSuccess from './components/PlantDoctorReservationSuccess';
import CustomBouquet from './components/CustomBouquet';
import Collections from './components/Collections';
import ProductDetail from './components/ProductDetail';
import Footer from './components/Footer';
import BouquetStudio from './components/BouquetStudio';
import LiveChatWidget from './components/LiveChatWidget';

import { AuthProvider } from './context/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ForgotPassword from './components/Auth/ForgotPassword';
import ResetPassword from './components/Auth/ResetPassword';
import AccountLayout from './components/Account/AccountLayout';
import ProfileInfo from './components/Account/ProfileInfo';
import OrderHistory from './components/Account/OrderHistory';
import FavoritesPage from './components/Account/FavoritesPage';
import DoctorRequestsPage from './components/Account/DoctorRequestsPage';
import CartPage from './components/CartPage';
import CheckoutPage from './components/CheckoutPage';
import CheckoutSuccess from './components/CheckoutSuccess';
import AdminDashboard from './components/Admin/AdminDashboard';
import AdminLayout from './components/Admin/AdminLayout';
import AdminOrders from './components/Admin/AdminOrders';
import AdminProducts from './components/Admin/AdminProducts';
import AdminCustomers from './components/Admin/AdminCustomers';
import AdminSettings from './components/Admin/AdminSettings';
import AdminLiveChat from './components/Admin/AdminLiveChat';
import AdminRenderManagement from './components/Admin/AdminRenderManagement';
import AdminClubManagement from './components/Admin/AdminClubManagement';
import AgronomistPanel from './components/Agronomist/AgronomistPanel';
import FloristPanel from './components/Florist/FloristPanel';
import CourierPanel from './components/Courier/CourierPanel';
import CourierTrackingPage from './components/Courier/CourierTrackingPage';
import CourierInvitePage from './components/Courier/CourierInvitePage';
import SupportPage from './components/SupportPage';
import BirBuketClub from './components/BirBuketClub';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';
import BrandLoading from './components/BrandLoading';
import { tokenImpliesRole } from './utils/jwtRoles';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }
  if (!token) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" />;

  let hasAdminRole = String(user?.role || '').toUpperCase().includes('ADMIN');
  if (!hasAdminRole && token) {
    hasAdminRole = tokenImpliesRole(token, 'ADMIN');
  }
  if (!hasAdminRole) return <Navigate to="/account" />;

  return <>{children}</>;
}

function AgronomistRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" />;

  let hasAgronomistRole = String(user?.role || '').toUpperCase().includes('AGRONOMIST');
  if (!hasAgronomistRole && token) {
    hasAgronomistRole = tokenImpliesRole(token, 'AGRONOMIST');
  }
  if (!hasAgronomistRole) return <Navigate to="/account" />;

  return <>{children}</>;
}

function FloristRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" />;

  let hasFloristRole = String(user?.role || '').toUpperCase().includes('FLORIST');
  if (!hasFloristRole && token) {
    hasFloristRole = tokenImpliesRole(token, 'FLORIST');
  }
  if (!hasFloristRole) return <Navigate to="/account" />;

  return <>{children}</>;
}

function CourierRoute({ children }: { children: React.ReactNode }) {
  const { token, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <BrandLoading />
      </div>
    );
  }

  if (!token) return <Navigate to="/login" />;

  let hasCourierRole = String(user?.role || '').toUpperCase().includes('COURIER');
  if (!hasCourierRole && token) {
    hasCourierRole = tokenImpliesRole(token, 'COURIER');
  }
  if (!hasCourierRole) return <Navigate to="/account" />;

  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Home() {
  return (
    <>
      <Hero />
      <Services />
      <CustomBouquet />
    </>
  );
}

function AppContent() {
  const { pathname } = useLocation();
  const { token, user } = useAuth();
  const isAdminRoute = pathname.startsWith('/admin');
  const isAgronomistRoute = pathname.startsWith('/agronomist');
  const isFloristRoute = pathname.startsWith('/florist');
  /** WhatsApp ilə açılan tracking / invite — florist/kuryer token olsa da bu səhifələr bloklanmasın */
  const isPublicCourierDeepLink =
    pathname.startsWith('/courier/tracking') || pathname.startsWith('/courier/invite');
  const isCourierRoute = pathname.startsWith('/courier') && !isPublicCourierDeepLink;
  const roleText = String(user?.role || '').toUpperCase();
  let hasAdminRole = roleText.includes('ADMIN');
  let hasAgronomistRole = roleText.includes('AGRONOMIST');
  let hasFloristRole = roleText.includes('FLORIST');
  let hasCourierRole = roleText.includes('COURIER');

  if (token) {
    if (!hasAdminRole) hasAdminRole = tokenImpliesRole(token, 'ADMIN');
    if (!hasAgronomistRole) hasAgronomistRole = tokenImpliesRole(token, 'AGRONOMIST');
    if (!hasFloristRole) hasFloristRole = tokenImpliesRole(token, 'FLORIST');
    if (!hasCourierRole) hasCourierRole = tokenImpliesRole(token, 'COURIER');
  }

  // Agronomist users should only work on their dedicated panel.
  if (token && hasAgronomistRole && !hasAdminRole && !isAgronomistRoute && !isPublicCourierDeepLink) {
    return <Navigate to="/agronomist" replace />;
  }
  if (
    token &&
    hasFloristRole &&
    !hasAdminRole &&
    !hasAgronomistRole &&
    !isFloristRoute &&
    !isPublicCourierDeepLink
  ) {
    return <Navigate to="/florist" replace />;
  }
  /** Kuryer paneli ilə ictimai tracking eyni prefixdədir — tracking üçün məcburi yönləndirməni söndür */
  if (
    token &&
    hasCourierRole &&
    !hasAdminRole &&
    !hasAgronomistRole &&
    !hasFloristRole &&
    !isCourierRoute &&
    !isPublicCourierDeepLink
  ) {
    return <Navigate to="/courier" replace />;
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      {!isAdminRoute &&
        !isAgronomistRoute &&
        !isFloristRoute &&
        !isCourierRoute &&
        !isPublicCourierDeepLink && <Header />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/studio" element={<BouquetStudio />} />
          <Route path="/plant-doctor" element={<PlantDoctor />} />
          <Route path="/plant-doctor/reservation" element={<PlantDoctorReservation />} />
          <Route path="/plant-doctor/reservation/success" element={<PlantDoctorReservationSuccess />} />
          <Route path="/about" element={<About />} />
          <Route path="/birbuketclub" element={<BirBuketClub />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfUse />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/cart"
            element={
              <ProtectedRoute>
                <CartPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/success"
            element={<CheckoutSuccess />}
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProfileInfo />} />
            <Route path="orders" element={<OrderHistory />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="doctor-requests" element={<DoctorRequestsPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="live-chat" element={<AdminLiveChat />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="render-management" element={<AdminRenderManagement />} />
            <Route path="club-management" element={<AdminClubManagement />} />
          </Route>
          <Route
            path="/agronomist"
            element={
              <AgronomistRoute>
                <AgronomistPanel />
              </AgronomistRoute>
            }
          />
          <Route
            path="/florist"
            element={
              <FloristRoute>
                <FloristPanel />
              </FloristRoute>
            }
          />
          <Route
            path="/courier"
            element={
              <CourierRoute>
                <CourierPanel />
              </CourierRoute>
            }
          />
          <Route path="/courier/tracking" element={<CourierTrackingPage />} />
          <Route path="/courier/invite" element={<CourierInvitePage />} />
          {/* Fallback for other routes */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      {!isCourierRoute && !isPublicCourierDeepLink ? <LiveChatWidget /> : null}
      {!isAdminRoute &&
        !isAgronomistRoute &&
        !isFloristRoute &&
        !isCourierRoute &&
        !isPublicCourierDeepLink && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
