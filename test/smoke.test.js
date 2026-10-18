'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MEMBER_PASSWORD = 'correct horse';
process.env.SESSION_SECRET = 'test-secret';

const { createApp } = require('../app');
const locations = require('../lib/locations');

let server;
let base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const get = (path, options = {}) => fetch(base + path, { redirect: 'manual', ...options });

test('public pages render with a heading and skip link', async () => {
  for (const path of ['/', '/about', '/services', '/locations', '/contact', '/members']) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.match(html, /<h1[ >]/, `${path} has an h1`);
    assert.match(html, /href="#content"/, `${path} has a skip link`);
  }
});

test('every location has a working detail page', async () => {
  assert.equal(locations.all.length, 16);
  for (const l of locations.all) {
    const res = await get(`/locations/${l.slug}`);
    assert.equal(res.status, 200, l.slug);
  }
});

test('location filters narrow the list', async () => {
  const html = await (await get('/locations?vacancies=1')).text();
  const expected = locations.all.filter((l) => l.vacancies).length;
  assert.match(html, new RegExp(`Showing ${expected} of 16 locations`));
  const care = await (await get('/locations?region=east&category=nursing-care')).text();
  assert.match(care, /Viewlands House/);
  assert.doesNotMatch(care, /Tullis House/);
});

test('unknown routes return a 404 page', async () => {
  const res = await get('/nope');
  assert.equal(res.status, 404);
  assert.match(await res.text(), /Page not found/);
  assert.equal((await get('/locations/not-a-place')).status, 404);
});

test('members area is protected', async () => {
  const res = await get('/members-area');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/members');
});

test('wrong password is rejected', async () => {
  const res = await get('/members', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'password=wrong',
  });
  assert.equal(res.status, 401);
  assert.match(await res.text(), /Incorrect password/);
});

test('correct password unlocks the members area, and logout locks it again', async () => {
  const login = await get('/members', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'password=correct%20horse',
  });
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('location'), '/members-area');
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('abbeyfield.sid'));

  const area = await get('/members-area', { headers: { cookie } });
  assert.equal(area.status, 200);
  assert.match(await area.text(), /Members.Only Area/);

  const out = await get('/members/logout', {
    method: 'POST',
    headers: { cookie },
  });
  assert.equal(out.status, 302);
  const clearedCookie = out.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const after = await get('/members-area', { headers: { cookie: clearedCookie } });
  assert.equal(after.status, 302);
});

test('security headers and health check', async () => {
  const res = await get('/healthz');
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
});
