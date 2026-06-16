const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 내 알림 목록
router.get('/', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .table('notifications')
    .select('*')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Notifications fetch error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
  res.json(data);
});

// 알림 읽음 처리
router.patch('/:id/read', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .table('notifications')
    .update({ is_read: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id);

  if (error) {
    logger.error('Notification read update error:', error.message);
    return res.status(500).json({ error: 'Failed to update notification' });
  }
  res.json({ success: true });
});

// 모든 알림 읽음 처리
router.patch('/read-all', authenticateToken, async (req, res) => {
  await supabase
    .table('notifications')
    .update({ is_read: true })
    .eq('user_id', req.user.id)
    .eq('is_read', false);

  res.json({ success: true });
});

module.exports = router;