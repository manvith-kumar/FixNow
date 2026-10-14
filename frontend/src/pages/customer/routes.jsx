import { Navigate, Route, Routes } from 'react-router-dom';
import CustomerDashboard from './Dashboard.jsx';
import BookService from './BookService.jsx';
import Addresses from './Addresses.jsx';
import BookingsListPage from '../shared/BookingsListPage.jsx';
import BookingDetailPage from '../shared/BookingDetailPage.jsx';
import PaymentsListPage from '../shared/PaymentsListPage.jsx';
import MyReviewsPage from '../shared/MyReviewsPage.jsx';
import NotificationsPage from '../shared/NotificationsPage.jsx';
import ProfilePage from '../shared/ProfilePage.jsx';
import { LinkButton } from '../../components/ui/index.js';

export default function CustomerRoutes() {
  return (
    <Routes>
      <Route index element={<CustomerDashboard />} />
      <Route path="book" element={<BookService />} />
      <Route path="bookings" element={<BookingsListPage role="CUSTOMER" title="My bookings" subtitle="Every booking you have made, newest first." detailPath={(id) => `/customer/bookings/${id}`} actions={<LinkButton to="/customer/book" variant="primary">Book a service</LinkButton>} />} />
      <Route path="bookings/:id" element={<BookingDetailPage backTo="/customer/bookings" />} />
      <Route path="payments" element={<PaymentsListPage role="CUSTOMER" subtitle="Your payment history and receipts." bookingPath={(id) => `/customer/bookings/${id}`} />} />
      <Route path="addresses" element={<Addresses />} />
      <Route path="reviews" element={<MyReviewsPage role="CUSTOMER" />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/customer" replace />} />
    </Routes>
  );
}
