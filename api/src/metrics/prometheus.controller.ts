import { Controller, Get, Header } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Controller('api/metrics')
export class PrometheusController {
  constructor(private readonly redis: RedisService) {}

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async prometheus() {
    const r = this.redis.getClient();
    const getNum = async (key: string) => Number((await r.get(key)) || '0');
    const reqTotal = await getNum('metrics:http:requests');
    const sum = await getNum('metrics:http:latency_ms_sum');
    const count = await getNum('metrics:http:latency_ms_count');
    const buckets = [50, 100, 200, 300, 500, 1000, 2000, 5000];
    const bucketVals = await Promise.all(buckets.map((b) => getNum(`metrics:http:latency_le:${b}`)));
    const statusCodes = [200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503];
    const statusVals = await Promise.all(statusCodes.map((s) => getNum(`metrics:http:status:${s}`)));

    const lines: string[] = [];
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    lines.push(`http_requests_total ${reqTotal}`);

    lines.push('# HELP http_requests_status_total HTTP requests by status code');
    lines.push('# TYPE http_requests_status_total counter');
    statusCodes.forEach((s, i) => {
      lines.push(`http_requests_status_total{code="${s}"} ${statusVals[i]}`);
    });

    lines.push('# HELP http_request_duration_ms HTTP request duration histogram (ms)');
    lines.push('# TYPE http_request_duration_ms histogram');
    let cumulative = 0;
    buckets.forEach((b, i) => {
      cumulative = bucketVals[i];
      lines.push(`http_request_duration_ms_bucket{le="${b}"} ${cumulative}`);
    });
    // +Inf bucket equals count
    lines.push(`http_request_duration_ms_bucket{le="+Inf"} ${count}`);
    lines.push(`http_request_duration_ms_sum ${sum}`);
    lines.push(`http_request_duration_ms_count ${count}`);

    // Include selected app-level counters if present
    const appKeys = [
      'ws:connections:total',
      'metrics:presence:sent',
      'metrics:presence:dropped',
      'metrics:comments:created',
      'metrics:comments:replied',
      'metrics:comments:resolved',
      'metrics:comments:deleted',
      'metrics:search:queries',
      'metrics:search:clicks',
      'jobs:processed',
      'jobs:failed',
    ];
    const appVals = await r.mget(appKeys);
    lines.push('# TYPE app_counters_total counter');
    appKeys.forEach((k, i) => lines.push(`app_counters_total{name="${k}"} ${Number(appVals[i] || '0')}`));

    return lines.join('\n') + '\n';
  }
}

