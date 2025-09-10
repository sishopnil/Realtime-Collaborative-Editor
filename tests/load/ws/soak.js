/*
  Socket.IO WebSocket Soak Test

  Simulates many clients joining a document room and sending presence updates.
  Requirements: Node >= 18 and `socket.io-client` installed locally.

  Usage:
    BASE_URL=http://localhost:4000 VUS=200 node tests/load/ws/soak.js
*/

// eslint-disable-next-line @typescript-eslint/no-var-requires
const io = require('socket.io-client');
const fetch = global.fetch; // Node 18+

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const VUS = parseInt(process.env.VUS || '200', 10);
const RUNTIME_MS = parseInt(process.env.RUNTIME_MS || '60000', 10);

async function oauthLogin(i) {
  const email = `ws-soak+${i}-${Date.now()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/oauth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'test', email }),
  });
  const data = await res.json();
  return data.accessToken;
}

async function createDoc(token, i) {
  const ws = await fetch(`${BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `WS ${i}`, slug: `ws-${i}-${Date.now()}` }),
  }).then((r) => r.json());
  const doc = await fetch(`${BASE_URL}/api/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workspaceId: ws._id, title: `Doc ${i}` }),
  }).then((r) => r.json());
  return doc._id;
}

async function main() {
  console.log(`Starting WS soak: VUS=${VUS}, RUNTIME_MS=${RUNTIME_MS}`);
  const token = await oauthLogin('seed');
  const docId = await createDoc(token, 'seed');

  const clients = [];
  for (let i = 0; i < VUS; i++) {
    clients.push(
      (async () => {
        const t = await oauthLogin(i);
        const socket = io(BASE_URL, {
          transports: ['websocket'],
          auth: { token: t },
        });
        socket.on('connect_error', (err) => console.error('connect_error', err.message));
        socket.on('connect', () => {
          socket.emit('doc:join', { documentId: docId });
        });
        socket.on('doc:joined', () => {
          // start presence pings
          const interval = setInterval(() => {
            socket.emit('presence', { documentId: docId, anchor: 1, head: Math.floor(Math.random() * 100), typing: Math.random() > 0.8 });
          }, 200);
          setTimeout(() => { clearInterval(interval); socket.disconnect(); }, RUNTIME_MS);
        });
      })()
    );
  }
  await Promise.all(clients);
  console.log('WS soak complete');
}

main().catch((e) => { console.error(e); process.exit(1); });

