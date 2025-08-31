import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { SecurityLogger } from '../common/security-logger.service';

type JobHandler = (data: any) => Promise<void>;

@Injectable()
export class JobQueueService implements OnModuleInit {
  private readonly logger = new Logger(JobQueueService.name);
  private handlers = new Map<string, JobHandler>();
  private mode: 'bullmq' | 'fallback' = 'fallback';
  private bull: any = null;
  private queue: any = null;
  private worker: any = null;
  private scheduler: any = null;

  constructor(private readonly redis: RedisService, private readonly audit: SecurityLogger) {}

  async onModuleInit() {
    // Try to initialize BullMQ if available; otherwise, fallback
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.bull = require('bullmq');
      const connection = { connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' } };
      this.queue = new this.bull.Queue('rce-jobs', connection);
      this.scheduler = new this.bull.QueueScheduler('rce-jobs', connection);
      await this.scheduler.waitUntilReady();
      this.worker = new this.bull.Worker(
        'rce-jobs',
        async (job: any) => {
          const h = this.handlers.get(job.name);
          if (!h) return;
          try {
            await h(job.data);
            await this.redis.getClient().incr('jobs:processed');
          } catch (e) {
            await this.redis.getClient().incr('jobs:failed');
            await this.audit.log('jobs.fail', { name: job.name, err: String(e) });
            throw e;
          }
        },
        { ...connection, concurrency: parseInt(process.env.JOBS_CONCURRENCY || '5', 10) },
      );
      this.mode = 'bullmq';
      this.logger.log('Initialized BullMQ job queue');
    } catch (e) {
      this.mode = 'fallback';
      this.logger.warn('BullMQ not installed; using fallback in-process queue');
    }
  }

  register(name: string, handler: JobHandler) {
    this.handlers.set(name, handler);
  }

  async add(name: string, data: any, opts?: { delayMs?: number; attempts?: number }) {
    const attempts = opts?.attempts ?? 3;
    if (this.mode === 'bullmq') {
      await this.queue.add(name, data, {
        attempts,
        removeOnComplete: 1000,
        removeOnFail: 1000,
        backoff: { type: 'exponential', delay: 2000 },
        delay: opts?.delayMs ?? 0,
      });
      return;
    }
    // fallback: simple timer-based runner
    const run = async (tryNo: number) => {
      try {
        const h = this.handlers.get(name);
        if (!h) return;
        await h(data);
        await this.redis.getClient().incr('jobs:processed');
      } catch (e) {
        await this.redis.getClient().incr('jobs:failed');
        await this.audit.log('jobs.fail', { name, err: String(e), tryNo });
        if (tryNo < attempts) setTimeout(() => void run(tryNo + 1), 2000 * tryNo);
      }
    };
    setTimeout(() => void run(1), opts?.delayMs ?? 0);
  }

  async health() {
    return {
      mode: this.mode,
      processed: Number(await this.redis.getClient().get('jobs:processed')) || 0,
      failed: Number(await this.redis.getClient().get('jobs:failed')) || 0,
    };
  }
}

