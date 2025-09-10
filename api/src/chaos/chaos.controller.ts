import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChaosService, ChaosConfig } from './chaos.service';

function assertKey(h: Record<string, any>) {
  const key = (h['x-chaos-key'] as string) || '';
  if (!process.env.CHAOS_KEY || key !== process.env.CHAOS_KEY) {
    const e: any = new Error('Forbidden');
    e.status = 403;
    throw e;
  }
}

@ApiTags('chaos')
@Controller('api/chaos')
export class ChaosController {
  constructor(private readonly chaos: ChaosService) {}

  @Get('config')
  @ApiOperation({ summary: 'Get chaos config' })
  async get(@Headers() headers: Record<string, any>) {
    assertKey(headers);
    return this.chaos.getConfig();
  }

  @Post('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set chaos config' })
  async set(@Body() body: ChaosConfig, @Headers() headers: Record<string, any>) {
    assertKey(headers);
    await this.chaos.setConfig(body || {});
    return { ok: true };
  }
}

