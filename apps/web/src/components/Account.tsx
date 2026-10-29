import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabaseClient';

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function getProfile() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { user } = session;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (!ignore) {
        if (error) {
          console.warn(error);
        } else if (data) {
          setUsername(data.full_name);
          setAvatarUrl(data.avatar_url);
        }
        setLoading(false);
      }
    }

    getProfile();

    return () => {
      ignore = true;
    };
  }, [session]);

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSupabaseConfigured || !supabase) {
      alert('Supabase가 설정되지 않아 프로필을 수정할 수 없습니다.');
      return;
    }

    setLoading(true);
    const { user } = session;
    const updates = {
      id: user.id,
      full_name: username,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert(updates);
    alert(error ? error.message : '프로필이 수정되었습니다.');
    setLoading(false);
  }

  return (
    <form onSubmit={updateProfile} className="card" style={{ display: 'grid', gap: 12, padding: 20 }}>
      <label>
        이메일
        <input className="input-field" type="text" value={session.user.email ?? ''} disabled style={{ width: '100%', marginTop: 6 }} />
      </label>
      <label>
        이름
        <input
          className="input-field"
          type="text"
          required
          value={username || ''}
          onChange={(event) => setUsername(event.target.value)}
          style={{ width: '100%', marginTop: 6 }}
        />
      </label>
      <button className="text-button primary" type="submit" disabled={loading}>
        {loading ? '불러오는 중...' : '수정하기'}
      </button>
      <button className="text-button" type="button" onClick={() => supabase?.auth.signOut()}>
        로그아웃
      </button>
    </form>
  );
}
