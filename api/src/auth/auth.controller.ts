import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from './auth.guard';
import { UserRepository } from '../database/repositories/user.repo';
import { CacheService } from '../redis/cache.service';
import { SecurityLogger } from '../common/security-logger.service';
import { authenticator } from 'otplib';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { hashPassword } from '../common/security';
import { verifyCaptcha } from '../common/captcha';

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UserRepository,
    private readonly cache: CacheService,
    private readonly audit: SecurityLogger,
    private readonly redis: RedisService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Logged in' })
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Rate limit: 5 attempts per 5 minutes per email+ip
    const ip =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip-unknown';
    const rateKey = `login:${body.email}:${ip}`;
    const lockKey = `lock:${body.email}`;
    const locked = await this.cache.getJson<number>(lockKey);
    if (locked) throw new UnauthorizedException('Account locked. Try again later');
    // 5 attempts per minute
    const attempts = await this.cache.incr(rateKey, 60);
    if (attempts > 5) {
      await this.cache.setJson(lockKey, 1, 60 * 10);
      await this.audit.log('auth.lockout', { email: body.email, ip });
      throw new UnauthorizedException('Too many attempts, account temporarily locked');
    }
    // if attempts > 3, require CAPTCHA token when enabled
    if (attempts > 3 && process.env.CAPTCHA_ENABLED) {
      const ok = await verifyCaptcha((body as any).captchaToken);
      if (!ok) {
        await this.audit.log('auth.captcha.required', { email: body.email, ip });
        throw new UnauthorizedException('Captcha verification required');
      }
    }
    try {
      const user = await this.auth.validateUser(body.email, body.password);
      const adminEmails = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase());
      if (adminEmails.includes(user.email.toLowerCase())) {
        const secret = process.env.MFA_TOTP_SECRET || '';
        if (!body.otp || !secret || !authenticator.check(body.otp, secret)) {
          await this.audit.log('auth.mfa.failed', { email: user.email, ip });
          throw new UnauthorizedException('MFA required');
        }
      }
      const pair = await this.auth.generateTokenPair((user as any)._id, {
        refreshTtlSec: body.rememberMe ? 60 * 60 * 24 * 30 : undefined,
        ip,
        ua: req.headers['user-agent'] as string | undefined,
      });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('refreshToken', pair.refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        path: '/api/auth',
        maxAge: body.rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24 * 7,
      });
      await this.cache.del(rateKey);
      await this.audit.log('auth.login.success', {
        userId: (user as any)._id,
        email: user.email,
        ip,
      });
      return {
        accessToken: pair.accessToken,
        user: { id: (user as any)._id, email: user.email, name: user.name },
      };
    } catch (e) {
      await this.audit.log('auth.login.failed', { email: body.email, ip });
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies && (req.cookies as any)['refreshToken']) || undefined;
    if (!token) throw new UnauthorizedException('Missing refresh token');
    const pair = await this.auth.rotateRefreshToken(token, {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip-unknown',
      ua: req.headers['user-agent'] as string | undefined,
    });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', pair.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    await this.audit.log('auth.refresh', {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    });
    return { accessToken: pair.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies && (req.cookies as any)['refreshToken']) || undefined;
    if (token) {
      try {
        const payload = (await import('jsonwebtoken')).then(
          (m) => m.default.verify(token, process.env.JWT_SECRET || 'changeme') as any,
        );
        // best-effort revoke
        const p = await payload;
        if (p.jti) await this.auth.revokeRefresh(p.jti);
      } catch {}
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    await this.audit.log('auth.logout', {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress,
    });
    return { ok: true };
  }

  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'OAuth callback handler (email-based upsert)' })
  async oauth(
    @Body() body: { provider: string; email: string; name?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const email = body.email.toLowerCase().trim();
    let user = await this.users.findByEmail(email);
    if (!user) {
      const passwordHash = await hashPassword(bcrypt, (Math.random() + '').slice(2));
      user = await this.users.create({ email, passwordHash, name: body.name });
    }
    const pair = await this.auth.generateTokenPair((user as any)._id, {
      ip: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'ip-unknown',
      ua: req.headers['user-agent'] as string | undefined,
    });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', pair.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/api/auth',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    await this.audit.log('auth.oauth', { provider: body.provider, email });
    return {
      accessToken: pair.accessToken,
      user: { id: (user as any)._id, email: user.email, name: user.name },
    };
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions for current user' })
  async sessions(@Req() req: Request & { user?: any }) {
    const userId = req.user!.id;
    const client = this.redis.getClient();
    const jtiss: string[] = await client.smembers(`user-sessions:${userId}`);
    const metas = await Promise.all(jtiss.map((j) => this.cache.getJson<any>(`session:${j}`)));
    const result = metas.map((m, idx) => (m ? { jti: jtiss[idx], ...m } : null)).filter(Boolean);
    return { sessions: result } as any;
  }

  @Post('sessions/revoke')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a session by refreshId' })
  async revokeSession(@Body() body: { refreshId: string }, @Req() req: Request & { user?: any }) {
    await this.auth.revokeRefresh(body.refreshId);
    await this.audit.log('auth.session.revoke', { jti: body.refreshId, userId: req.user!.id });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Req() req: Request & { user?: any }) {
    return { user: req.user };
  }

  @Post('request-email-verification')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request email verification for current user' })
  async requestEmailVerification(@Req() req: Request & { user?: any }) {
    const token = await this.auth.newEmailVerificationToken(req.user!.id);
    // In real scenario, send email. For now, return token for testing.
    await this.audit.log('auth.verify.request', { userId: req.user!.id });
    return { token };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email using token' })
  async verifyEmail(@Body() body: VerifyEmailDto) {
    const userId = await this.auth.consumeEmailVerificationToken(body.token);
    if (!userId) throw new UnauthorizedException('Invalid or expired token');
    await this.users.updateById(userId, { emailVerifiedAt: new Date() as any });
    await this.audit.log('auth.verify.success', { userId });
    return { ok: true };
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset for email' })
  async requestPasswordReset(@Body() body: RequestPasswordResetDto) {
    const user = await this.users.findByEmail(body.email.toLowerCase().trim());
    if (!user) return { ok: true };
    const token = await this.auth.newPasswordResetToken((user as any)._id);
    // Normally email the token; for now return for testing
    await this.audit.log('auth.reset.request', { email: body.email });
    return { token };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token' })
  async resetPassword(@Body() body: ResetPasswordDto) {
    const userId = await this.auth.consumePasswordResetToken(body.token);
    if (!userId) throw new UnauthorizedException('Invalid or expired token');
    const passwordHash = await hashPassword(bcrypt, body.newPassword);
    await this.users.updateById(userId, { passwordHash });
    await this.audit.log('auth.reset.success', { userId });
    return { ok: true };
  }
}
