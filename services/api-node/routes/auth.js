const express = require('express');
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

// Service-role profile writes bypass the database trigger, so mirror its reserved-name rule
// (infra/supabase/init.sql protect_profile_assignment).
const RESERVED_NAME = /(운영|관리자|핏커넥트|fitconnect|admin|official|공식)/i;
const isAllowedName = (name) =>
  typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 30 && !RESERVED_NAME.test(name);

function createAuthRouter(clientFactory = createClient, fetchKakao = fetch) {
  const router = express.Router();
  const authOptions = { auth: { persistSession: false, autoRefreshToken: false } };
  const profiles = clientFactory(
    process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, authOptions
  );
  function requestClient() {
    return clientFactory(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      authOptions
    );
  }

  // 카카오 OAuth 토큰 교환
  router.post('/kakao', async (req, res) => {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'Kakao access_token required' });
    }

    try {
      // 1. 카카오 사용자 정보 조회
      const kakaoRes = await fetchKakao('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${access_token}` }
      });
      if (!kakaoRes.ok) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
      const kakaoUser = await kakaoRes.json();
      const { id: kakaoId, kakao_account } = kakaoUser || {};
      if (!kakaoId) {
        return res.status(401).json({ error: 'Authentication failed' });
      }
      const email = kakao_account?.email || `${kakaoId}@kakao.com`;
      const nickname = kakao_account?.profile?.nickname;
      const name = isAllowedName(nickname) ? nickname.trim() : '카카오유저';

      // 2. Supabase Auth로 로그인/회원가입
      const { data, error } = await requestClient().auth.signInWithIdToken({
        provider: 'kakao',
        token: access_token,
      });

      if (error) throw error;

      // 3. 프로필이 없으면 생성
      if (data.user) {
        const { data: profile, error: profileError } = await profiles
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        if (!profile) {
          const { error: insertError } = await profiles.from('profiles').insert({
            id: data.user.id,
            email: data.user.email || email,
            full_name: name,
            role: 'user',
          });
          if (insertError) throw insertError;
        }
      }

      res.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        user: data.user,
      });
    } catch (err) {
      logger.error('Kakao auth error:', err.message);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  return router;
}

module.exports = createAuthRouter();
module.exports.createAuthRouter = createAuthRouter;
