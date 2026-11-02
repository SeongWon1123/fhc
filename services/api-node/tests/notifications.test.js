const assert = require('node:assert/strict');
const { test } = require('node:test');

process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'notifications-test-only';
const { createNotificationsRouter } = require('../routes/notifications');

function fixture() {
  const rows = [
    { id: 'foreign', user_id: 'coach', is_read: false, created_at: '2026-10-29T00:00:00Z' },
    ...Array.from({ length: 52 }, (_, index) => ({
      id: `notice-${index}`, user_id: 'member', is_read: index === 0,
      created_at: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
    })),
  ];
  const state = { rows, error: false, throws: false };
  const client = {
    auth: {
      async getUser(token) {
        return {
          data: { user: ['member', 'coach'].includes(token) ? { id: token } : null },
          error: null,
        };
      },
    },
    from(table) {
      assert.equal(table, 'notifications');
      const filters = [];
      let change;
      let selected = false;
      let ordering;
      let limit;
      return {
        select() { selected = true; return this; },
        update(value) { change = value; return this; },
        eq(key, value) { filters.push([key, value]); return this; },
        order(key, options) { ordering = [key, options]; return this; },
        limit(value) { limit = value; return this; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (state.throws) throw new Error('Database unavailable');
            if (state.error) return { data: null, error: { message: 'Database unavailable' } };
            let matched = rows.filter((row) => filters.every(([key, value]) => row[key] === value));
            if (ordering) {
              const [key, { ascending }] = ordering;
              matched.sort((a, b) => ascending ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]));
            }
            if (limit !== undefined) matched = matched.slice(0, limit);
            if (change) matched.forEach((row) => Object.assign(row, change));
            return { data: selected ? matched.map((row) => ({ ...row })) : null, error: null };
          }).then(resolve, reject);
        },
      };
    },
  };
  const router = createNotificationsRouter(client);
  // Exercise the real Express router and authentication without a listening server.
  function request(method, url, token = 'member') {
    return new Promise((resolve, reject) => {
      const req = {
        method, url, headers: token ? { authorization: `Bearer ${token}` } : {},
      };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(body) { resolve({ status: this.statusCode, body }); },
      };
      router.handle(req, res, (error) => reject(error || new Error('Route did not respond')));
    });
  }
  return { state, request };
}

test('GET returns only own newest 50 notifications', async () => {
  // Given: interleaved owners and more than 50 notifications.
  const f = fixture();
  // When: the member reads their inbox.
  const response = await f.request('GET', '/');
  // Then: ownership, ordering and limit all constrain the response.
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 50);
  assert.ok(response.body.every((row) => row.user_id === 'member'));
  assert.equal(response.body[0].id, 'notice-51');
  assert.equal(response.body[49].id, 'notice-2');
});

test('read updates the owned notification and returns success', async () => {
  // Given: an unread notification belonging to the authenticated member.
  const f = fixture();
  // When: it is marked as read.
  const response = await f.request('PATCH', '/notice-1/read');
  // Then: the actual updated rows determine success.
  assert.deepEqual(response, { status: 200, body: { success: true } });
  assert.equal(f.state.rows.find((row) => row.id === 'notice-1').is_read, true);
  assert.equal(f.state.rows.find((row) => row.id === 'notice-2').is_read, false);
});

for (const id of ['foreign', 'missing']) {
  test(`read returns 404 without modifying an unowned or missing notification: ${id}`, async () => {
    // Given: an ID the member does not own.
    const f = fixture();
    const before = structuredClone(f.state.rows);
    // When: the member attempts to mark it read.
    const response = await f.request('PATCH', `/${id}/read`);
    // Then: no row changes and existence is not disclosed.
    assert.equal(response.status, 404);
    assert.deepEqual(f.state.rows, before);
  });
}

test('read-all updates only the authenticated owner', async () => {
  // Given: unread notifications belonging to multiple users.
  const f = fixture();
  // When: the member marks all read.
  const response = await f.request('PATCH', '/read-all');
  // Then: only their unread rows change.
  assert.deepEqual(response, { status: 200, body: { success: true } });
  assert.ok(f.state.rows.filter((row) => row.user_id === 'member').every((row) => row.is_read));
  assert.equal(f.state.rows.find((row) => row.id === 'foreign').is_read, false);
});

for (const path of ['/', '/notice-1/read', '/read-all']) {
  for (const failure of ['error', 'throws']) {
    test(`${path} returns 500 when database ${failure}`, async () => {
      // Given: a failed database operation.
      const f = fixture();
      f.state[failure] = true;
      const before = structuredClone(f.state.rows);
      // When: the authenticated request reaches the failed store.
      const response = await f.request(path === '/' ? 'GET' : 'PATCH', path);
      // Then: failure never becomes success and data is unchanged.
      assert.equal(response.status, 500);
      assert.deepEqual(f.state.rows, before);
    });
  }
  for (const [token, status] of [[null, 401], ['invalid', 403]]) {
    test(`${path} rejects ${token || 'missing'} credentials`, async () => {
      // Given: missing or invalid credentials.
      const f = fixture();
      const before = structuredClone(f.state.rows);
      // When: the protected route is requested.
      const response = await f.request(path === '/' ? 'GET' : 'PATCH', path, token);
      // Then: authentication blocks access before any mutation.
      assert.equal(response.status, status);
      assert.deepEqual(f.state.rows, before);
    });
  }
}
