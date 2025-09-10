import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FeaturesService, FlagConfig } from './features.service';
import { AuthGuard } from '../auth/auth.guard';

function assertKey(h: Record<string, any>) {
  const key = (h['x-feature-key'] as string) || '';
  if (!process.env.FEATURE_KEY || key !== process.env.FEATURE_KEY) {
    const e: any = new Error('Forbidden');
    (e as any).status = 403;
    throw e;
  }
}

@ApiTags('features')
@Controller('api/features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Evaluate feature flags for current user' })
  async list(@Req() req: any) {
    return this.features.evaluateForUser(req.user?.id);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get feature flags config (admin)' })
  async getConfig(@Headers() headers: Record<string, any>) {
    assertKey(headers);
    return this.features.getConfig();
  }

  @Post('config')
  @ApiOperation({ summary: 'Set feature flags config (admin)' })
  async setConfig(@Body() body: { flags: FlagConfig[] }, @Headers() headers: Record<string, any>) {
    assertKey(headers);
    await this.features.setConfig({ flags: Array.isArray(body?.flags) ? body.flags : [] });
    return { ok: true };
  }
}

