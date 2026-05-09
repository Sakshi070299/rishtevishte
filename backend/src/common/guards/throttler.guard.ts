import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';

function maskMobile(mobile: string): string {
  const m = String(mobile || '');
  if (m.length <= 4) return '****';
  return `${m.slice(0, 2)}******${m.slice(-2)}`;
}

function getClientIp(req: Record<string, any>): string {
  // Fastify sets `req.ip` based on `trustProxy`.
  // Fall back to socket address when missing (e.g. tests / unusual adapters).
  const ip = req?.ip || req?.raw?.ip || req?.socket?.remoteAddress;
  return String(ip || 'unknown');
}

function getOtpIdentityFromBody(req: Record<string, any>): { mobile?: string; loginType?: string } {
  const body = req?.body ?? {};
  const mobile = typeof body.mobile === 'string' ? body.mobile : undefined;
  const loginType = typeof body.loginType === 'string' ? body.loginType : undefined;
  return { mobile, loginType };
}

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(ApiThrottlerGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Hard bypass for high-frequency browsing endpoints where throttling hurts UX.
    // (Decorators like @SkipThrottle can be version/named-throttler sensitive.)
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;
    if (className === 'TeamsController' || className === 'ProfilesController' || className === 'SearchController' || className === 'AdminController') {
      return true;
    }

    return super.canActivate(context) as unknown as boolean;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = getClientIp(req);
    const { mobile, loginType } = getOtpIdentityFromBody(req);

    // We support multiple throttlers (named) so we can apply hybrid throttling:
    // - otp_mobile: limits per (mobile + loginType)
    // - otp_ip: limits per IP (independent of mobile) for bot-style spraying
    // - global: general API safety net
    //
    // We don't have ExecutionContext here (base class signature), so use method+url
    // for extra entropy (prevents accidental cross-route bucket sharing).
    const method = String(req?.method || 'UNKNOWN');
    const url = String(req?.url || req?.raw?.url || 'unknown');
    const routeHint = `${method}:${url}`;

    // NOTE: We intentionally do NOT always include (mobile + IP) together.
    // Doing so creates a new bucket per mobile and defeats IP-wide anti-spray protection.
    // Instead, the throttlerName-specific `generateKey` (configured via decorators)
    // selects which dimensions to use.
    return `${ip}|${mobile ?? ''}|${loginType ?? ''}|${routeHint}`;
  }

  protected generateKey(context: ExecutionContext, trackerString: string, throttlerName: string): string {
    const { req } = this.getRequestResponse(context);
    const ip = getClientIp(req);
    const { mobile, loginType } = getOtpIdentityFromBody(req);

    const normalizedMobile = mobile ? mobile.trim() : undefined;
    const normalizedLoginType = loginType ? loginType.trim().toUpperCase() : undefined;

    // Build a stable, human-auditable key prefix.
    const routeKey = `${context.getClass().name}.${context.getHandler().name}`;

    if (throttlerName === 'otp_mobile') {
      // Per-mobile throttling should not depend on IP (shared WiFi / carrier NAT).
      return `thr:${throttlerName}:${routeKey}:${normalizedLoginType ?? 'USER'}:${normalizedMobile ?? 'unknown'}`;
    }

    if (throttlerName === 'otp_ip') {
      // IP-level throttling is independent of mobile to prevent number-spraying.
      return `thr:${throttlerName}:${routeKey}:${ip}`;
    }

    // Default/global: keep original behavior (IP-based).
    return `thr:${throttlerName || 'default'}:${routeKey}:${ip}`;
  }

  protected async throwThrottlingException(context: ExecutionContext, detail: any): Promise<void> {
    const { req, res } = this.getRequestResponse(context);
    const ip = getClientIp(req);
    const { mobile, loginType } = getOtpIdentityFromBody(req);

    const retryAfterSeconds =
      typeof detail?.timeToExpire === 'number'
        ? Math.max(1, Math.ceil(detail.timeToExpire / 1000))
        : undefined;

    // Best-effort `Retry-After` for frontend UX.
    if (retryAfterSeconds != null) {
      try {
        if (typeof res?.header === 'function') res.header('retry-after', String(retryAfterSeconds));
        else if (typeof res?.setHeader === 'function') res.setHeader('retry-after', String(retryAfterSeconds));
      } catch {
        // ignore header setting errors
      }
    }

    // High-signal abuse telemetry (mobile masked).
    this.logger.warn(
      `429 throttled name=${detail?.key ? String(detail.key).split(':')[1] : 'unknown'} ip=${ip} mobile=${mobile ? maskMobile(mobile) : 'n/a'} loginType=${loginType ?? 'n/a'} route=${context.getClass().name}.${context.getHandler().name}`,
    );

    return super.throwThrottlingException(context, detail);
  }
}

