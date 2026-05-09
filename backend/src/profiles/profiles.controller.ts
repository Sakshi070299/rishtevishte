import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ProfilesService } from './profiles.service';
import { RequireCaptcha } from '../captcha/captcha.guard';
import { CreateProfileDto, UpdateProfileDto } from './profiles.dto';
import { SkipThrottle } from '@nestjs/throttler';

type JwtRequest = { user: { sub: string; role: string } };

@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Post()
  @RequireCaptcha()
  async create(@Request() req: JwtRequest, @Body() dto: CreateProfileDto) {
    return this.profilesService.create(req.user.sub, dto as never, {
      actorRole: req.user.role as never,
    });
  }

  @Get()
  @SkipThrottle()
  async findMyProfiles(@Request() req: JwtRequest) {
    return this.profilesService.findByUser(req.user.sub);
  }

  @Get('me/export')
  async exportMyData(@Request() req: JwtRequest) {
    return this.profilesService.exportUserData(req.user.sub);
  }

  // Called by UI when the 15-min countdown hits 0.
  // If the pending self-registration is past the window, deletes the user account immediately.
  @Post('me/expire-pending-payment')
  @HttpCode(HttpStatus.OK)
  async expirePendingPayment(@Request() req: JwtRequest) {
    return this.profilesService.expireMyPendingPaymentIfPastWindow(req.user.sub, 15);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: JwtRequest) {
    const enforceOwnership = req.user.role === 'USER';
    return this.profilesService.findOne(id, enforceOwnership ? req.user.sub : undefined);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Request() req: JwtRequest, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(id, req.user.sub, req.user.role, dto as never);
  }

  @Patch(':id/settle')
  async markSettled(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.profilesService.markSettled(id, req.user.sub, req.user.role);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string, @Request() req: JwtRequest) {
    return this.profilesService.deactivateProfile(id, req.user.sub);
  }
}
