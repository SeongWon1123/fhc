const express = require('express');
const { supabase, createAuthenticateToken } = require('../middleware/auth');

function createRealtimeRouter(client) {
  const router = express.Router();

  // FastAPI owns mutations. This endpoint only publishes persisted state.
  router.post('/trigger-update', createAuthenticateToken(client), async (req, res) => {
    const { bookingId } = req.body || {};
    if (typeof bookingId !== 'string' || !bookingId.trim()) {
      return res.status(400).json({ error: 'bookingId required' });
    }

    try {
      const { data: booking, error } = await client
        .from('bookings')
        .select('id, user_id, coach_id, status')
        .eq('id', bookingId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: 'Failed to load booking' });
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (req.user.id !== booking.user_id && req.user.id !== booking.coach_id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const io = req.app.get('io');
      const update = { bookingId: booking.id, status: booking.status };
      if (io) {
        io.to(`user_${booking.user_id}`)
          .to(`coach_${booking.coach_id}`)
          .emit('booking_updated', update);
      }
      res.json({ success: true, ...update });
    } catch {
      res.status(500).json({ error: 'Failed to load booking' });
    }
  });
  return router;
}

module.exports = createRealtimeRouter(supabase);
module.exports.createRealtimeRouter = createRealtimeRouter;
