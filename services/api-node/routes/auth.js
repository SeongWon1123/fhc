const express = require('express');
const router = express.Router();
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

// 카카오 OAuth 토큰 교환
router.post('/kakao', async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'Kakao access_token required' });
  }

  try {
    // 1. 카카오 사용자 정보 조회
    const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const kakaoUser = await kakaoRes.json();
    const { id: kakaoId, kakao_account } = kakaoUser;
    const email = kakao_account?.email || `${kakaoId}@kakao.com`;
    const name = kakao_account?.profile?.nickname || '카카오유저';

    // 2. Supabase Auth로 로그인/회원가입
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'kakao',
      token: access_token,
    });

    if (error) throw error;

    // 3. 프로필이 없으면 생성
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email || email,
          full_name: name,
          role: 'user',
        });
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

// 이메일 로그인
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    logger.error('Login error:', err.message);
    res.status(401).json({ error: 'Login failed' });
  }
});

// 이메일 회원가입
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
      },
    });

    if (error) throw error;

    // 프로필 생성
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name,
        role: 'user',
      });
    }

    res.json(data);
  } catch (err) {
    logger.error('Registration error:', err.message);
    res.status(400).json({ error: 'Registration failed' });
  }
});

module.exports = router;