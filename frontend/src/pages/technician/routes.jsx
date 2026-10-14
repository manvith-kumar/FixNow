import { Navigate, Route, Routes } from 'react-router-dom';
import TechnicianDashboard from './Dashboard.jsx';
import Application from './Application.jsx';
import AvailableJobs from './AvailableJobs.jsx';
import Availability from './Availability.jsx';
import Earnings from './Earnings.jsx';
import TechnicianProfile from './Profile.jsx';
import BookingsListPage from '../shared/BookingsListPage.jsx';
import BookingDetailPage from '../shared/BookingDetailPage.jsx';
import MyReviewsPage from '../shared/MyReviewsPage.jsx';
import NotificationsPage from '../shared/NotificationsPage.jsx';

export default function TechnicianRoutes() {
  return (
    <Routes>
      <Route index element={<TechnicianDashboard />} />
      <Route path="application" element={<Application />} />
      <Route path="jobs/available" element={<AvailableJobs />} />
      <Route path="jobs" element={<BookingsListPage role="TECHNICIAN" title="My jobs" subtitle="Jobs assigned to you." detailPath={(id) => `/technician/jobs/${id}`} />} />
      <Route path="jobs/:id" element={<BookingDetailPage backTo="/technician/jobs" backLabel="Back to my jobs" />} />
      <Route path="availability" element={<Availability />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="reviews" element={<MyReviewsPage role="TECHNICIAN" />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="profile" element={<TechnicianProfile />} />
      <Route path="*" element={<Navigate to="/technician" replace />} />
    </Routes>
  );
}
