import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../src/index.js';

const env = {
  DOMAIN: 'https://domain.com',
  DOMAIN_TARGET: 'https://qr.domain.com'
};

test('redirects QR requests to the internal QR host', async () => {
  const request = new Request('https://domain.com/qr?id=app');
  const response = await handler.fetch(request, env);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://qr.domain.com/?id=app');
});

test('redirects to homepage when id parameter is missing', async () => {
  const request = new Request('https://domain.com/qr');
  const response = await handler.fetch(request, env);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://domain.com');
});

test('redirects to homepage with the original query string when no qr value is present', async () => {
  const request = new Request('https://domain.com/qr?source=landing');
  const response = await handler.fetch(request, env);

  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://domain.com/?source=landing');
});

test('forwards non-qr requests to the website origin', async () => {
  const originalFetch = globalThis.fetch;
  let forwardedUrl = null;

  globalThis.fetch = async (input) => {
    forwardedUrl = input instanceof URL ? input.toString() : input.url;
    return new Response('web response', { status: 200 });
  };

  try {
    const request = new Request('https://domain.com/login');
    const response = await handler.fetch(request, env);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'web response');
    assert.equal(forwardedUrl, 'https://domain.com/login');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
