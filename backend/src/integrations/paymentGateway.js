// Payment provider seam. The booking/quotation modules only depend on this interface:
//   charge({ amount, currency, method, bookingId }) -> { status: 'SUCCESS'|'FAILED', reference, provider, isSimulated, failureReason? }
// To add a real provider (Razorpay, Stripe...) implement the same function and switch `activeGateway`.
// NO card numbers, CVVs or bank credentials are accepted or stored by this application.
import { transactionReference } from '../utils/ids.js';

export const DEMO_METHODS = ['DEMO_CARD', 'DEMO_UPI', 'DEMO_WALLET', 'DEMO_FAILING_CARD'];

export const simulatedGateway = {
  name: 'SIMULATED',
  async charge({ method }) {
    const reference = transactionReference();
    if (method === 'DEMO_FAILING_CARD') {
      return { status: 'FAILED', reference, provider: 'SIMULATED', isSimulated: true, failureReason: 'Simulated card was declined (demo failure method)' };
    }
    return { status: 'SUCCESS', reference, provider: 'SIMULATED', isSimulated: true };
  },
};
export const activeGateway = simulatedGateway;
