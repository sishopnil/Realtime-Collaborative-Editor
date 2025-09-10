import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<600'],
  },
};

function oauthLogin() {
  const email = `k6-search-${__VU}-${__ITER}-${randomString(6)}@example.com`;
  const res = http.post(`${BASE_URL}/api/auth/oauth`, JSON.stringify({ provider: 'test', email }), { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'oauth 200': (r) => r.status === 200 && !!r.json('accessToken') });
  return res.json('accessToken');
}

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
}

export default function searchScenario() {
  const token = oauthLogin();

  // Create workspace + doc with some comments to seed
  const ws = http.post(`${BASE_URL}/api/workspaces`, JSON.stringify({ name: 'Search WS', slug: `s-${__VU}-${__ITER}` }), authHeaders(token));
  check(ws, { 'ws 201': (r) => r.status === 201 });
  const wsId = ws.json('_id');
  const doc = http.post(`${BASE_URL}/api/docs`, JSON.stringify({ workspaceId: wsId, title: 'Search Doc' }), authHeaders(token));
  check(doc, { 'doc 201': (r) => r.status === 201 });
  const docId = doc.json('_id');

  for (let i = 0; i < 3; i++) {
    http.post(`${BASE_URL}/comments`, JSON.stringify({ documentId: docId, text: `Note ${i} is awesome ${randomString(6)}` }), authHeaders(token));
  }

  // Search endpoints
  const s1 = http.get(`${BASE_URL}/api/search/comments?documentId=${docId}&q=awesome&limit=20`, authHeaders(token));
  check(s1, { 'search comments 200': (r) => r.status === 200 });

  const s2 = http.get(`${BASE_URL}/api/search/docs?workspaceId=${wsId}&limit=50`, authHeaders(token));
  check(s2, { 'search docs 200': (r) => r.status === 200 });

  sleep(0.3);
}

