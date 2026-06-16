const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// WebSocket은 index.js에서 Socket.IO로 직접 처리됩니다.
// 이 파일은 REST API로 예약 상태 변경을 트리거하기 위한 엔드포인트입니다.

router.post('/trigger-update', authenticateToken, async (req, res) => {
  const { bookingId, status, userId, coachId } = req.body;

  if (!bookingId || !status) {
    return res.status(400).json({ error: 'bookingId and status required' });
  }

  // Socket.IO 인스턴스를 app에서 가져와서 이벤트 emit
  const io = req.app.get('io');
  if (io) {
    if (userId) {
      io.to(`user_${userId}`).emit('booking_updated', { bookingId, status });
    }
    if (coachId) {
      io.to(`coach_${coachId}`).emit('booking_updated', { bookingId, status });
    }
  }

  res.json({ success: true, bookingId, status });
});

module.exports = router;