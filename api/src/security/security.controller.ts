import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { AdminGuard } from '../common/admin.guard';
import { RedisService } from '../redis/redis.service';

@ApiTags('security')
@Controller('api/security')
@UseGuards(AuthGuard, AdminGuard)
@ApiBearerAuth()
export class SecurityController {
  constructor(private readonly redis: RedisService) {}

  @Get('audit')
  @ApiOperation({ summary: 'Get recent audit logs' })
  async audit(@Query('limit') limit = 200) {
    const n = Math.min(Number(limit) || 200, 1000);
    const arr = await this.redis.getClient().lrange('audit-log', 0, n - 1);
    return arr.map((j) => JSON.parse(j));
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get recent security alerts' })
  async alerts(@Query('limit') limit = 100) {
    const n = Math.min(Number(limit) || 100, 1000);
    const arr = await this.redis.getClient().lrange('security-alerts-recent', 0, n - 1);
    return arr.map((j) => JSON.parse(j));
  }
}

