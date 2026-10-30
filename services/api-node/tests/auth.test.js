const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.SUPABASE_URL = 'https://auth-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'auth-test-service';
process.env.SUPABASE_ANON_KEY = 'auth-test-anon';
const { createAuthRouter } = require('../routes/auth');

function request(router, url, body) {
  return new Promise((resolve, reject) => {
    const req = { method: 'POST', url, body, headers: {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); },
    };
    router.handle(req, res, (error) => reject(error || new Error('Route did not respond')));
  });
}

function fixture(fetchKakao = async () => ({
  ok: true, json: async () => ({ id: 123, kakao_account: {} }),
})) {
  const clients = [];
  const reads = [];
  const inserts = [];
  const pending = [];
  const state = { insertError: null, profileError: null, concurrent: false };
  const router = createAuthRouter((url, key, options) => {
    assert.equal(url, process.env.SUPABASE_URL);
    assert.deepEqual(options, { auth: { persistSession: false, autoRefreshToken: false } });
    const client = { key, session: null };
    const signIn = async ({ provider, token }) => {
      assert.equal(provider, 'kakao');
      client.session = token;
      if (state.concurrent) {
        await new Promise((resolve) => {
          pending.push(resolve);
          if (pending.length === 2) pending.forEach((release) => release());
        });
      }
      return {
        data: { user: { id: client.session }, session: { access_token: client.session } },
        error: null,
      };
    };
    client.auth = {
      signInWithIdToken: signIn,
    };
    client.from = (table) => {
      assert.equal(table, 'profiles');
      assert.equal(client, clients[0]);
      assert.equal(client.session, null);
      return {
        select(columns) { assert.equal(columns, 'id'); return this; },
        eq(column, id) { assert.equal(column, 'id'); reads.push(id); return this; },
        async maybeSingle() { return { data: null, error: state.profileError }; },
        async insert(row) { inserts.push(row); return { error: state.insertError }; },
      };
    };
    clients.push(client);
    return client;
  }, fetchKakao);
  return { router, clients, reads, inserts, state };
}

test('concurrent Kakao logins use a fresh isolated auth client per request', { timeout: 3000 }, async () => {
  const f = fixture();
  f.state.concurrent = true;
  const results = await Promise.all(['alice', 'bob'].map((access_token) => (
    request(f.router, '/kakao', { access_token })
  )));
  assert.deepEqual(results.map(({ body }) => body.user.id), ['alice', 'bob']);
  assert.equal(f.clients.length, 3);
  assert.notEqual(f.clients[1], f.clients[2]);
  assert.deepEqual(f.clients.map(({ session }) => session), [null, 'alice', 'bob']);
  assert.deepEqual(f.clients.map(({ key }) => key), [
    'auth-test-service', 'auth-test-anon', 'auth-test-anon',
  ]);
});

test('Kakao profiles use only the separate service client and returned identity', async () => {
  const f = fixture();
  const kakao = await request(f.router, '/kakao', { access_token: 'kakao', id: 'forged' });
  assert.deepEqual(kakao, {
    status: 200, body: { access_token: 'kakao', refresh_token: undefined, user: { id: 'kakao' } },
  });
  assert.deepEqual(f.reads, ['kakao']);
  assert.deepEqual(f.inserts.map(({ id }) => id), ['kakao']);
  assert.equal(f.inserts[0].email, '123@kakao.com');
  assert.equal(f.clients.length, 2);
  assert.equal(f.clients[0].session, null);
});

test('auth falls back to the service key without sharing the profile client', async (t) => {
  const previous = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_ANON_KEY;
  t.after(() => { process.env.SUPABASE_ANON_KEY = previous; });
  const f = fixture();
  assert.equal((await request(f.router, '/kakao', { access_token: 'test' })).status, 200);
  assert.equal(f.clients[1].key, 'auth-test-service');
  assert.notEqual(f.clients[0], f.clients[1]);
  assert.equal(f.clients[0].session, null);
});

for (const response of [
  { ok: false, json() { assert.fail('Must not parse a failed Kakao response'); } },
  { ok: true, json: async () => ({ kakao_account: {} }) },
  { ok: true, json: async () => null },
]) {
  test(`Kakao rejects ${response.ok ? 'missing user id' : 'non-ok response'} before Supabase auth`, async () => {
    const f = fixture(async () => response);
    assert.deepEqual(await request(f.router, '/kakao', { access_token: 'invalid' }), {
      status: 401, body: { error: 'Authentication failed' },
    });
    assert.equal(f.clients.length, 1);
    assert.equal(f.clients[0].session, null);
    assert.deepEqual(f.reads, []);
    assert.deepEqual(f.inserts, []);
  });
}

test('email login and registration are not handled by the auth router', async () => {
  const f = fixture();
  for (const url of ['/login', '/register']) {
    await assert.rejects(request(f.router, url, {
      email: 'new', password: 'test-only', full_name: 'Test',
    }), {
      message: 'Route did not respond',
    });
  }
  assert.equal(f.clients.length, 1);
  assert.deepEqual(f.reads, []);
  assert.deepEqual(f.inserts, []);
});

test('Kakao nicknames with reserved words fall back to the default name', async () => {
  const f = fixture(async () => ({
    ok: true, json: async () => ({ id: 7, kakao_account: { profile: { nickname: '핏커넥트 공식' } } }),
  }));
  assert.equal((await request(f.router, '/kakao', { access_token: 'test-only' })).status, 200);
  assert.equal(f.inserts[0].full_name, '카카오유저');
});

test('profile failures never return successful authentication', async () => {
  const f = fixture();
  f.state.insertError = { message: 'test insert failure' };
  assert.equal((await request(f.router, '/kakao', { access_token: 'test' })).status, 500);
  f.state.profileError = { message: 'test lookup failure' };
  assert.equal((await request(f.router, '/kakao', { access_token: 'test' })).status, 500);
  assert.equal(f.inserts.length, 1);
});
