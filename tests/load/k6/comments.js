import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomSeed, randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '30s';

randomSeed(1234);

export const options = {
  scenarios: {
    users: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
      gracefulStop: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<800'],
  },
};

function oauthLogin() {
  const email = `k6+${__VU}-${__ITER}-${randomString(6)}@example.com`;
  const payload = JSON.stringify({ provider: 'test', email, name: 'K6 User' });
  const res = http.post(`${BASE_URL}/api/auth/oauth`, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'oauth 200': (r) => r.status === 200 && !!r.json('accessToken') });
  return res.json('accessToken');
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export default function scenario() {
  const token = oauthLogin();

  // Create workspace
  const wsBody = JSON.stringify({ name: `WS ${randomString(8)}`, slug: `ws-${__VU}-${__ITER}` });
  const wsRes = http.post(`${BASE_URL}/api/workspaces`, wsBody, authHeaders(token));
  check(wsRes, { 'workspace created': (r) => r.status === 201 && !!r.json('_id') });
  const wsId = wsRes.json('_id');

  // Create document
  const docBody = JSON.stringify({ workspaceId: wsId, title: `Doc ${randomString(6)}` });
  const docRes = http.post(`${BASE_URL}/api/docs`, docBody, authHeaders(token));
  check(docRes, { 'doc created': (r) => r.status === 201 && !!r.json('_id') });
  const docId = docRes.json('_id');

  // List docs
  const listDocs = http.get(`${BASE_URL}/api/docs?workspaceId=${wsId}`, authHeaders(token));
  check(listDocs, { 'docs list 200': (r) => r.status === 200 });

  // Create comment thread
  const cText = `Hello world ${randomString(5)} @mention.user@example.com`;
  const cBody = JSON.stringify({ documentId: docId, text: cText, anchor: { from: 1, to: 10 } });
  const cRes = http.post(`${BASE_URL}/comments`, cBody, authHeaders(token));
  check(cRes, { 'comment 201': (r) => r.status === 201 || r.status === 200 });
  const threadId = cRes.json('_id');

  // Reply
  const rBody = JSON.stringify({ documentId: docId, text: `Reply ${randomString(5)}`, threadId });
  const rRes = http.post(`${BASE_URL}/comments/${threadId}/replies`, rBody, authHeaders(token));
  check(rRes, { 'reply 200': (r) => r.status === 201 || r.status === 200 });

  // React
  const reactBody = JSON.stringify({ emoji: '👍' });
  const reactRes = http.post(`${BASE_URL}/comments/${threadId}/react`, reactBody, authHeaders(token));
  check(reactRes, { 'react 200': (r) => r.status === 200 });

  // List comments
  const list = http.get(`${BASE_URL}/comments/doc/${docId}?limit=50`, authHeaders(token));
  check(list, { 'comments list 200': (r) => r.status === 200 });

  // Analytics
  const analytics = http.get(`${BASE_URL}/comments/analytics/${docId}`, authHeaders(token));
  check(analytics, { 'analytics 200': (r) => r.status === 200 });

  // Search
  const search = http.get(`${BASE_URL}/comments/search?documentId=${docId}&q=Hello`, authHeaders(token));
  check(search, { 'search 200': (r) => r.status === 200 });

  // Resolve
  const resolve = http.post(`${BASE_URL}/comments/${threadId}/resolve`, null, authHeaders(token));
  check(resolve, { 'resolve 200': (r) => r.status === 200 });

  sleep(0.5);
}

