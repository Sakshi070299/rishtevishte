import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto } from './auth.dto';

type JwtRequest = { user: { sub: string; role: string } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private tokenService: TokenService,
  ) {}

  @Post('send-otp')
  @Throttle({
    otp_mobile: { limit: 3, ttl: 60000 },
    otp_ip: { limit: 15, ttl: 60000 },
  })
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto.mobile, dto.loginType);
  }

  @Post('verify-otp')
  @Throttle({
    otp_mobile: { limit: 8, ttl: 60000 },
    otp_ip: { limit: 30, ttl: 60000 },
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.mobile, dto.code, dto.loginType);
  }

  @Post('refresh')
  @Throttle({ global: { limit: 10, ttl: 60000 } })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.tokenService.refreshAccessToken(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Request() req: JwtRequest) {
    await this.tokenService.revokeRefreshToken(req.user.sub);
    return { message: 'Logged out successfully' };
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: JwtRequest) {
    return this.authService.getMe(req.user.sub);
  }
}
