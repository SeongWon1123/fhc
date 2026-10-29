const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function createAuthenticateToken(client) {
  return async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    try {
      const { data: { user }, error } = await client.auth.getUser(token);
      if (error || !user?.id) return res.status(403).json({ error: 'Invalid token' });
      req.user = user;
      next();
    } catch {
      return res.status(403).json({ error: 'Token verification failed' });
    }
  };
}

module.exports = {
  authenticateToken: createAuthenticateToken(supabase),
  createAuthenticateToken,
  supabase,
};
