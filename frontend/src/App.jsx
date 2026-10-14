import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { GuestRoute, ProtectedRoute } from './routes/ProtectedRoute.jsx';
import { LoadingState } from './components/ui/index.js';
import { loginTarget, registerTarget } from './utils/postAuth.js';

import Home from './pages/public/Home.jsx';
import Services from './pages/public/Services.jsx';
import ServiceDetails from './pages/public/ServiceDetails.jsx';
import { HowItWorks, About, Contact, Privacy, Terms } from './pages/public/Static.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import { ForgotPassword, ResetPassword } from './pages/auth/Recovery.jsx';
import { Unauthorized, NotFound, ServerError } from './pages/errors/ErrorPages.jsx';

// Role areas are code-split so visitors only download what they use.
const CustomerRoutes = lazy(() => import('./pages/customer/routes.jsx'));
const TechnicianRoutes = lazy(() => import('./pages/technician/routes.jsx'));
const AdminRoutes = lazy(() => import('./pages/admin/routes.jsx'));
const area = (El) => <Suspense fallback={<LoadingState />}><El /></Suspense>;

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="services/:id" element={<ServiceDetails />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="about" element={<About />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="login" element={<GuestRoute target={loginTarget}><Login /></GuestRoute>} />
        <Route path="register" element={<GuestRoute target={registerTarget}><Register /></GuestRoute>} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="unauthorized" element={<Unauthorized />} />
        <Route path="server-error" element={<ServerError />} />
      </Route>

      <Route element={<ProtectedRoute roles={['CUSTOMER']} />}>
        <Route element={<DashboardLayout />}><Route path="customer/*" element={area(CustomerRoutes)} /></Route>
      </Route>
      <Route element={<ProtectedRoute roles={['TECHNICIAN']} />}>
        <Route element={<DashboardLayout />}><Route path="technician/*" element={area(TechnicianRoutes)} /></Route>
      </Route>
      <Route element={<ProtectedRoute roles={['ADMIN']} />}>
        <Route element={<DashboardLayout />}><Route path="admin/*" element={area(AdminRoutes)} /></Route>
      </Route>

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
    </Routes>
  );
}
