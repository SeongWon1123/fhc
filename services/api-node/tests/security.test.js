const assert = require('node:assert/strict');
const { test } = require('node:test');
const { IncomingMessage, ServerResponse } = require('node:http');
const { Socket } = require('node:net');

process.env.ENVIRONMENT = 'production';
process.env.SUPABASE_URL = 'https://security-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'security-test-service';
process.env.JWT_SECRET = 'security-test-secret';
process.env.ALLOWED_ORIGINS = 'https://app.example.com';
delete process.env.SUPABASE_ANON_KEY;
delete process.env.TRUST_PROXY;
const { createApp } = require('../index');
const { productionConfigErrors, trustProxy } = require('../config');

function request(app, url, ip) {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    Object.defineProperty(req.socket, 'remoteAddress', { value: '127.0.0.1' });
    req.method = 'GET';
    req.url = url;
    req.headers = ip ? { 'x-forwarded-for': ip } : {};
    const res = new ServerResponse(req);
    res.end = (body) => {
      res.emit('finish');
      resolve({ status: res.statusCode, body: body ? JSON.parse(body) : null });
    };
    app.handle(req, res, reject);
  });
}

test('trust proxy defaults to one nginx hop and parses false and numeric settings', (t) => {
  t.after(() => { delete process.env.TRUST_PROXY; });
  for (const [value, expected] of [[undefined, 1], ['false', false], ['0', 0], ['2', 2]]) {
    if (value === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = value;
    const { app } = createApp();
    assert.equal(app.get('trust proxy'), expected);
  }
  process.env.TRUST_PROXY = 'true';
  assert.throws(trustProxy, /TRUST_PROXY/);
});

test('nginx forwarded IPs have separate rate-limit buckets without validation errors', async (t) => {
  const errors = [];
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const { app } = createApp();
  app.get('/api/probe', (req, res) => res.json({ ip: req.ip, remaining: req.rateLimit.remaining }));
  const first = await request(app, '/api/probe', '198.51.100.1');
  const second = await request(app, '/api/probe', '198.51.100.2');
  const again = await request(app, '/api/probe', '198.51.100.1');
  assert.deepEqual(first.body, { ip: '198.51.100.1', remaining: 199 });
  assert.deepEqual(second.body, { ip: '198.51.100.2', remaining: 199 });
  assert.deepEqual(again.body, { ip: '198.51.100.1', remaining: 198 });
  assert.deepEqual(errors, []);
});

test('production readiness and health disclose only status, including config failures', async (t) => {
  const { app } = createApp();
  assert.deepEqual(await request(app, '/ready'), { status: 200, body: { status: 'ready' } });
  const previous = process.env.JWT_SECRET;
  t.after(() => { process.env.JWT_SECRET = previous; });
  delete process.env.JWT_SECRET;
  assert.ok(productionConfigErrors().length);
  assert.deepEqual(await request(app, '/ready'), { status: 503, body: { status: 'not_ready' } });
  assert.deepEqual(await request(app, '/health'), { status: 200, body: { status: 'healthy' } });
});

test('anon key is optional in production but rejects a configured placeholder', (t) => {
  t.after(() => { delete process.env.SUPABASE_ANON_KEY; });
  assert.deepEqual(productionConfigErrors(), []);
  process.env.SUPABASE_ANON_KEY = 'your_anon_key';
  assert.deepEqual(productionConfigErrors(), ['SUPABASE_ANON_KEY still uses a placeholder']);
  process.env.SUPABASE_ANON_KEY = 'security-test-anon';
  assert.deepEqual(productionConfigErrors(), []);
});
