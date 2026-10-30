const assert = require('node:assert/strict');
const { test } = require('node:test');
const { once } = require('node:events');
const { createServer } = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
// Node 20 (the BFF runtime image) has no global WebSocket; ws ships with socket.io.
const WebSocket = globalThis.WebSocket ?? require('ws');

// Only bootstrap configuration; every auth/database call uses the injected client.
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'realtime-test-only';
const { configureRealtime } = require('../realtime');
const { createRealtimeRouter } = require('../routes/realtime');

const ids = {
  member: '00000000-0000-4000-8000-000000000001',
  coach: '00000000-0000-4000-8000-000000000002',
  outsider: '00000000-0000-4000-8000-000000000003',
  otherCoach: '00000000-0000-4000-8000-000000000004',
};
const bookingId = '00000000-0000-4000-8000-000000000010';
const otherBookingId = '00000000-0000-4000-8000-000000000011';

async function fixture(t) {
  const bookings = new Map([
    [bookingId, { id: bookingId, user_id: ids.member, coach_id: ids.coach, status: 'confirmed' }],
    [otherBookingId, {
      id: otherBookingId, user_id: ids.outsider, coach_id: ids.otherCoach, status: 'pending',
    }],
  ]);
  const profiles = new Map(Object.values(ids).map((id) => [
    id, { role: [ids.coach, ids.otherCoach].includes(id) ? 'coach' : 'user' },
  ]));
  const calls = [];
  const client = {
    auth: {
      async getUser(token) {
        calls.push(['getUser', token]);
        if (token === 'throw') throw new Error('Auth unavailable');
        const id = ids[token];
        return {
          // A claimed metadata role must never grant a coach room.
          data: { user: id ? { id, user_metadata: { role: 'coach' } } : null },
          error: id ? null : { message: 'Invalid token' },
        };
      },
    },
    from(table) {
      assert.ok(['profiles', 'bookings'].includes(table));
      return {
        select(columns) {
          assert.equal(columns, table === 'profiles' ? 'role' : 'id, user_id, coach_id, status');
          return this;
        },
        eq(column, id) {
          assert.equal(column, 'id');
          this.id = id;
          calls.push([table, id]);
          return this;
        },
        async maybeSingle() {
          if (table === 'profiles') {
            const profile = profiles.get(this.id);
            if (profile instanceof Error) throw profile;
            return {
              data: profile?.error ? null : profile || null,
              error: profile?.error || null,
            };
          }
          if (this.id === 'db-error') return { data: null, error: { message: 'Unavailable' } };
          if (this.id === 'db-throw') throw new Error('Database unavailable');
          return { data: bookings.get(this.id) || null, error: null };
        },
      };
    },
  };
  const app = express();
  const server = createServer(app);
  const io = new Server(server);
  configureRealtime(io, client);
  app.use(express.json());
  app.set('io', io);
  app.use('/api/realtime', createRealtimeRouter(client));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => io.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    calls, bookings, profiles, io,
    async post(token, body) {
      const response = await fetch(`${base}/api/realtime/trigger-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    async connect(auth) {
      // Engine.IO v4 + Socket.IO default namespace over the real WebSocket wire.
      // No client library or server-handler mocking is needed.
      const ws = new WebSocket(`${base.replace('http:', 'ws:')}/socket.io/?EIO=4&transport=websocket`);
      t.after(() => ws.close());
      const queue = [];
      const waiters = [];
      const updates = [];
      function receive(predicate) {
        const index = queue.findIndex(predicate);
        if (index !== -1) return Promise.resolve(queue.splice(index, 1)[0]);
        return new Promise((resolve, reject) => {
          const waiter = { predicate, resolve, timer: null };
          waiter.timer = setTimeout(() => {
            waiters.splice(waiters.indexOf(waiter), 1);
            reject(new Error('Expected Socket.IO packet was not received'));
          }, 3000);
          waiters.push(waiter);
        });
      }
      ws.addEventListener('message', ({ data }) => {
        if (data === '2') return ws.send('3');
        if (data.startsWith('42')) {
          const [event, payload] = JSON.parse(data.slice(2));
          if (event === 'booking_updated') updates.push(payload);
        }
        const index = waiters.findIndex(({ predicate }) => predicate(data));
        if (index === -1) return queue.push(data);
        const waiter = waiters.splice(index, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(data);
      });
      await receive((packet) => packet.startsWith('0'));
      ws.send(`40${JSON.stringify(auth)}`);
      const result = await receive((packet) => packet.startsWith('40') || packet.startsWith('44'));
      let ackId = 0;
      return {
        updates,
        error: result.startsWith('44') ? JSON.parse(result.slice(2)) : null,
        emit(event, payload) { ws.send(`42${JSON.stringify([event, payload])}`); },
        async join(event, id) {
          const current = ackId++;
          const reply = receive((packet) => packet.startsWith(`43${current}[`));
          ws.send(`42${current}${JSON.stringify([event, id])}`);
          return JSON.parse((await reply).slice(`43${current}`.length))[0];
        },
      };
    },
  };
}

test('Socket.IO rejects missing, malformed, invalid and failed token verification', async (t) => {
  const f = await fixture(t);
  for (const auth of [{}, { token: '' }, { token: 7 }, { token: 'invalid' }, { token: 'throw' }]) {
    const socket = await f.connect(auth);
    assert.ok(socket.error);
  }
  assert.deepEqual(f.calls, [['getUser', 'invalid'], ['getUser', 'throw']]);
});

test('verified rooms reject arbitrary IDs and metadata roles; client broadcasts are inert', async (t) => {
  const f = await fixture(t);
  const member = await f.connect({ token: 'member' });
  const coach = await f.connect({ token: 'coach' });
  const outsider = await f.connect({ token: 'outsider' });
  for (const socket of [member, coach, outsider]) assert.equal(socket.error, null);

  assert.deepEqual(await member.join('join_user_room', ids.member), { success: true });
  assert.deepEqual(await coach.join('join_coach_room', ids.coach), { success: true });
  assert.deepEqual(await outsider.join('join_user_room', ids.member), { success: false });
  assert.deepEqual(await outsider.join('join_coach_room', ids.coach), { success: false });
  assert.deepEqual(await outsider.join('join_coach_room', ids.outsider), { success: false });
  outsider.emit('booking_status_update', {
    bookingId, status: 'cancelled', userId: ids.member, coachId: ids.coach,
  });
  // Acknowledgements are ordered barriers, not timing-based negative assertions.
  await outsider.join('join_user_room', ids.outsider);
  await member.join('join_user_room', ids.member);
  await coach.join('join_user_room', ids.coach);
  assert.deepEqual([member.updates, coach.updates, outsider.updates], [[], [], []]);

  assert.equal((await f.post('member', { bookingId })).status, 200);
  await member.join('join_user_room', ids.member);
  await coach.join('join_user_room', ids.coach);
  await outsider.join('join_user_room', ids.outsider);
  const expected = [{ bookingId, status: 'confirmed' }];
  assert.deepEqual(member.updates, expected);
  assert.deepEqual(coach.updates, expected);
  assert.deepEqual(outsider.updates, []);
});

test('profile lookup fails closed and missing profiles never gain coach access', async (t) => {
  const f = await fixture(t);
  f.profiles.set(ids.coach, { error: { message: 'Profile unavailable' } });
  assert.ok((await f.connect({ token: 'coach' })).error);
  f.profiles.set(ids.coach, new Error('Profile lookup failed'));
  assert.ok((await f.connect({ token: 'coach' })).error);
  f.profiles.delete(ids.coach);
  const socket = await f.connect({ token: 'coach' });
  assert.equal(socket.error, null);
  assert.deepEqual(await socket.join('join_coach_room', ids.coach), { success: false });
  assert.deepEqual(await socket.join('join_user_room', ids.coach), { success: true });
});

test('HTTP publishes only persisted state and recipients for either participant', async (t) => {
  const f = await fixture(t);
  const member = await f.connect({ token: 'member' });
  const coach = await f.connect({ token: 'coach' });
  const outsider = await f.connect({ token: 'outsider' });
  const otherCoach = await f.connect({ token: 'otherCoach' });
  const response = await f.post('coach', {
    bookingId, status: 'cancelled', userId: ids.outsider, coachId: ids.otherCoach,
  });
  assert.deepEqual(response, {
    status: 200, body: { success: true, bookingId, status: 'confirmed' },
  });
  for (const [socket, id] of [
    [member, ids.member], [coach, ids.coach], [outsider, ids.outsider], [otherCoach, ids.otherCoach],
  ]) await socket.join('join_user_room', id);
  assert.deepEqual(member.updates, [{ bookingId, status: 'confirmed' }]);
  assert.deepEqual(coach.updates, member.updates);
  assert.deepEqual(outsider.updates, []);
  assert.deepEqual(otherCoach.updates, []);
  assert.equal(f.bookings.get(bookingId).status, 'confirmed');

  // A later persisted state is read anew; no request-provided status is required.
  f.bookings.get(bookingId).status = 'completed';
  assert.equal((await f.post('member', { bookingId })).body.status, 'completed');
  await coach.join('join_user_room', ids.coach);
  assert.deepEqual(coach.updates[1], { bookingId, status: 'completed' });
});

test('HTTP rejects unauthenticated, cross-booking, missing and failed reads without publishing', async (t) => {
  const f = await fixture(t);
  const member = await f.connect({ token: 'member' });
  const outsider = await f.connect({ token: 'outsider' });
  for (const [token, body, status] of [
    [null, { bookingId }, 401],
    ['invalid', { bookingId }, 403],
    ['throw', { bookingId }, 403],
    ['member', {}, 400],
    ['member', { bookingId: {} }, 400],
    ['member', { bookingId: 'missing' }, 404],
    ['member', { bookingId: 'db-error' }, 500],
    ['member', { bookingId: 'db-throw' }, 500],
    ['outsider', { bookingId, userId: ids.outsider }, 403],
    ['member', { bookingId: otherBookingId, userId: ids.member, coachId: ids.coach }, 403],
  ]) {
    assert.equal((await f.post(token, body)).status, status);
  }
  await member.join('join_user_room', ids.member);
  await outsider.join('join_user_room', ids.outsider);
  assert.deepEqual(member.updates, []);
  assert.deepEqual(outsider.updates, []);
});
