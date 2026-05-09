import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(@Res({ passthrough: true }) res: { code?: (n: number) => void; status?: (n: number) => void }) {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        uptime: process.uptime(),
        db: 'connected',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Return 503 so load balancers can detect degraded state
      if (typeof res.code === 'function') {
        res.code(HttpStatus.SERVICE_UNAVAILABLE);
      } else if (typeof res.status === 'function') {
        res.status(HttpStatus.SERVICE_UNAVAILABLE);
      }
      return {
        status: 'degraded',
        uptime: process.uptime(),
        db: 'disconnected',
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
