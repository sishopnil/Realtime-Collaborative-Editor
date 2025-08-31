import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JobQueueService } from './job-queue.service';

@ApiTags('jobs')
@Controller('api/jobs')
export class JobsController {
  constructor(private readonly queue: JobQueueService) {}

  @Get('health')
  @ApiOperation({ summary: 'Job queue health' })
  health() {
    return this.queue.health();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Job queue stats' })
  stats() {
    return this.queue.health();
  }
}

