import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { TeamsService } from './teams.service';
import { OfflinePaymentMethod, TeamEditProfileDto, ToggleSettledDto, TeamSearchQueryDto, TeamCreateProfileDto, TeamUpdateStatusDto } from './teams.dto';

type JwtRequest = { user: { sub: string } };

@ApiTags('Team')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('TEAM', 'MANAGER', 'ADMIN')
@Controller('team')
export class TeamsController {
  constructor(private teamsService: TeamsService) { }

  @Get('dashboard')
  async getDashboard(@Request() req: JwtRequest) {
    return this.teamsService.getDashboardStats(req.user.sub);
  }

  @Get('my-activity')
  async getMyActivity(@Request() req: JwtRequest, @Query('days') days: string) {
    return this.teamsService.getMyActivity(req.user.sub, parseInt(days || '7', 10));
  }

  @Post('profiles/register')
  async createProfile(@Request() req: JwtRequest, @Body() dto: TeamCreateProfileDto) {
    const paymentMethods: OfflinePaymentMethod[] =
      dto.paymentMethods && dto.paymentMethods.length > 0
        ? dto.paymentMethods
        : dto.paymentMethod
          ? [dto.paymentMethod]
          : [OfflinePaymentMethod.CASH];

    return this.teamsService.createProfileOffline(
      req.user.sub,
      dto.profileData,
      paymentMethods,
      dto.paymentDetails,
    );
  }

  @Get('profiles')
  @SkipThrottle({ global: true })
  async searchProfiles(@Request() req: JwtRequest, @Query() filters: TeamSearchQueryDto) {
    return this.teamsService.searchProfiles(req.user.sub, filters);
  }

  @Get('incomplete-users')
  async listIncompleteUsers(
    @Request() _req: JwtRequest,
    @Query('search') search: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.teamsService.listIncompleteUsers({ search, page, limit });
  }

  @Patch('profiles/:id')
  async editProfile(@Request() req: JwtRequest, @Param('id') id: string, @Body() dto: TeamEditProfileDto) {
    return this.teamsService.editProfile(req.user.sub, id, dto as never);
  }

  @Patch('profiles/:id/settle')
  async toggleSettled(@Request() req: JwtRequest, @Param('id') id: string, @Body() dto: ToggleSettledDto) {
    return this.teamsService.toggleSettled(req.user.sub, id, dto.settled);
  }

  @Patch('profiles/:id/status')
  async updateProfileStatus(@Request() req: JwtRequest, @Param('id') id: string, @Body() dto: TeamUpdateStatusDto) {
    return this.teamsService.updateProfileStatus(req.user.sub, id, dto.status);
  }

  @Get('export')
  async exportBatch(@Request() req: JwtRequest, @Query('limit') limit?: string) {
    return this.teamsService.exportBatch(req.user.sub, parseInt(limit || '25', 10));
  }

  @Get('print')
  async printRegistrations(@Request() req: JwtRequest, @Query('from') from: string, @Query('to') to: string) {
    return this.teamsService.getPrintableRegistrations(req.user.sub, from, to);
  }
}
