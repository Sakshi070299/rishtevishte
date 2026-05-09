// ═══════════════════════════════════════════════════════
// FEATURE 1: reCAPTCHA v3 Verification Guard
// Backend validates token from frontend on all form submissions
// ═══════════════════════════════════════════════════════

import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';

@Injectable()
export class CaptchaGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-captcha-token'] || request.body?.captchaToken;

    // Skip entirely in development mode
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    if (!token) {
      throw new BadRequestException('CAPTCHA verification required');
    }

    // Production: secret key is required
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('CAPTCHA not configured');
    }

    try {
      const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secretKey}&response=${token}`,
      });
      const data = await response.json();

      if (!data.success || data.score < 0.5) {
        throw new BadRequestException('CAPTCHA verification failed. Please try again.');
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // Fail closed in production
      throw new BadRequestException('CAPTCHA verification failed. Please try again.');
    }
  }
}

// ─── Decorator for easy use on controllers ──────────
import { UseGuards, applyDecorators } from '@nestjs/common';

export function RequireCaptcha() {
  return applyDecorators(UseGuards(CaptchaGuard));
}
