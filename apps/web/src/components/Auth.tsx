import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabaseClient';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase 환경 변수가 설정되지 않았습니다.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      alert(error.message);
    } else {
      alert('로그인 링크를 보냈습니다. 이메일함을 확인해주세요.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: 'min(420px, 100%)', padding: 24 }}>
        <h1 className="page-title">핏커넥트 로그인</h1>
        <p className="page-description">Supabase 인증이 설정되면 이메일 로그인 링크로 접속합니다.</p>
        <form onSubmit={handleLogin}>
          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            <input
              className="input-field"
              type="email"
              placeholder="이메일 주소"
              value={email}
              required
              onChange={(event) => setEmail(event.target.value)}
            />
            <button className="text-button primary" disabled={loading} type="submit">
              {loading ? '전송 중...' : '로그인 링크 보내기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
