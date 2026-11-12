import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactLogValue } from '../src/errors.js';
import { createApiApp } from '../src/app.js';
test('redacts common secret keys and handles cycles', () => {
  const input: any = { accessToken: 'secret', cookie: 'secret', 'x-api-key': 'secret' }; input.self = input;
  assert.deepEqual(redactLogValue(input), { accessToken: '[REDACTED]', cookie: '[REDACTED]', 'x-api-key': '[REDACTED]', self: '[Circular]' });
});
test('unknown routes return JSON error envelope', async () => {
  const response = await createApiApp().request('/api/missing');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, 'NOT_FOUND');
});

test('database domain failures map to API errors', async () => {
  const { errorResponse } = await import('../src/errors.js');
  assert.equal(errorResponse(new Error('NOT_FOUND'), 'r').status, 404);
  assert.equal(errorResponse(new Error('CONFLICT_STATE'), 'r').status, 409);
});

test('authorization rolls back on failure and propagates infrastructure errors', async () => {
  const { authorizeRequest } = await import('../src/middleware/auth.js');
  let rolledBack = false;
  const failure = new Error('database unavailable');
  const deps = { resolvePrincipal: async () => ({ firebaseUid: 'u', tokenClaims: {} }), lookupRegisteredUser: async () => ({ firebaseUid: 'u', userId: 'u', role: 'PM' as const }), beginTransaction: async () => ({ commit: async () => {}, rollback: async () => { rolledBack = true; } }), resolveResource: async () => { throw failure; }, requireMember: async () => {}, evaluatePredicate: async () => {} };
  await assert.rejects(() => authorizeRequest({ operationId: 'x', method: 'GET', authState: 'REGISTERED', roles: [], predicate: 'MEMBER' }, deps, 'token', { method: 'GET', path: '/', params: {}, query: new URLSearchParams(), body: null }), (error) => error === failure);
  assert.equal(rolledBack, true);
});

test('token scope has no fabricated role', async () => {
  const { authorizeRequest } = await import('../src/middleware/auth.js');
  const deps: any = { resolvePrincipal: async () => ({ firebaseUid: 'u', tokenClaims: {} }) };
  const result = await authorizeRequest({ operationId: 'x', method: 'POST', authState: 'TOKEN', roles: [], predicate: 'NONE' }, deps, 'token', { method: 'POST', path: '/', params: {}, query: new URLSearchParams(), body: null });
  assert.deepEqual(result, { principal: { firebaseUid: 'u', tokenClaims: {} }, resolved: null });
});
