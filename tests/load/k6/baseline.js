import http from 'k6/http';
import { sleep, check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<300'],
  },
};

export default function baseline() {
  const resHealth = http.get(`${BASE_URL}/health`);
  check(resHealth, { 'health 200': (r) => r.status === 200 });

  const resMetrics = http.get(`${BASE_URL}/api/metrics`);
  check(resMetrics, { 'metrics 200': (r) => r.status === 200 });

  sleep(1);
}

