import { Navigate, Route, Routes } from 'react-router-dom';
import AdminDashboard from './Dashboard.jsx';
import Users from './Users.jsx';
import { ApplicationsList, ApplicationDetail } from './Applications.jsx';
import Technicians from './Technicians.jsx';
import { Categories, Services } from './Catalogue.jsx';
import Quotations from './Quotations.jsx';
import Reviews from './Reviews.jsx';
import Reports from './Reports.jsx';
import Settings from './Settings.jsx';
import AuditLogs from './AuditLogs.jsx';
import BookingsListPage from '../shared/BookingsListPage.jsx';
import BookingDetailPage from '../shared/BookingDetailPage.jsx';
import PaymentsListPage from '../shared/PaymentsListPage.jsx';
import NotificationsPage from '../shared/NotificationsPage.jsx';
import ProfilePage from '../shared/ProfilePage.jsx';

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<Users />} />
      <Route path="applications" element={<ApplicationsList />} />
      <Route path="applications/:id" element={<ApplicationDetail />} />
      <Route path="technicians" element={<Technicians />} />
      <Route path="categories" element={<Categories />} />
      <Route path="services" element={<Services />} />
      <Route path="bookings" element={<BookingsListPage role="ADMIN" title="Bookings" subtitle="All bookings. Open one to assign a technician or cancel it." detailPath={(id) => `/admin/bookings/${id}`} />} />
      <Route path="bookings/:id" element={<BookingDetailPage backTo="/admin/bookings" />} />
      <Route path="quotations" element={<Quotations />} />
      <Route path="payments" element={<PaymentsListPage role="ADMIN" subtitle="All payment attempts, including declined ones." bookingPath={(id) => `/admin/bookings/${id}`} />} />
      <Route path="reviews" element={<Reviews />} />
      <Route path="reports" element={<Reports />} />
      <Route path="settings" element={<Settings />} />
      <Route path="audit-logs" element={<AuditLogs />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
