const express = require('express');
const { supabase, createAuthenticateToken } = require('../middleware/auth');

function createNotificationsRouter(client) {
  const router = express.Router();
  router.use(createAuthenticateToken(client));

  router.get('/', async (req, res) => {
    try {
      const { data, error } = await client.from('notifications')
        .select('*').eq('user_id', req.user.id)
        .order('created_at', { ascending: false }).limit(50);
      if (error) return res.status(500).json({ error: '알림을 불러오지 못했습니다.' });
      res.json(data || []);
    } catch {
      res.status(500).json({ error: '알림을 불러오지 못했습니다.' });
    }
  });

  router.patch('/:id/read', async (req, res) => {
    try {
      const { data, error } = await client.from('notifications')
        .update({ is_read: true }).eq('id', req.params.id)
        .eq('user_id', req.user.id).select('id');
      if (error) return res.status(500).json({ error: '알림을 읽음 처리하지 못했습니다.' });
      if (!data?.length) return res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: '알림을 읽음 처리하지 못했습니다.' });
    }
  });

  router.patch('/read-all', async (req, res) => {
    try {
      const { error } = await client.from('notifications')
        .update({ is_read: true }).eq('user_id', req.user.id).eq('is_read', false);
      if (error) return res.status(500).json({ error: '모든 알림을 읽음 처리하지 못했습니다.' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: '모든 알림을 읽음 처리하지 못했습니다.' });
    }
  });
  return router;
}

module.exports = createNotificationsRouter(supabase);
module.exports.createNotificationsRouter = createNotificationsRouter;
