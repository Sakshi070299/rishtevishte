import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard, Roles } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { DonationsService } from '../donations/donations.service';
import { AddTeamMemberDto, UpdateSettingDto, UpdateWeeklyLimitDto, AddGalleryImageDto, AddBannerDto, AddManagerDto } from './admin.dto';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private tokenService: TokenService,
    private donationsService: DonationsService,
  ) { }

  @Get('team')
  async listTeam() { return this.adminService.listTeamMembers(); }

  @Post('team')
  async addTeam(@Body() dto: AddTeamMemberDto) {
    return this.adminService.addTeamMember(dto.name, dto.mobile);
  }

  @Delete('team/:id')
  async removeTeam(@Param('id') id: string) { return this.adminService.removeTeamMember(id); }

  @Get('settings')
  async getSettings() { return this.adminService.getSettings(); }

  @Patch('settings')
  async updateSetting(@Body() dto: UpdateSettingDto) {
    return this.adminService.updateSetting(dto.key, dto.value, dto.label);
  }

  @Patch('settings/weekly-limit')
  async updateWeeklyLimit(@Body() dto: UpdateWeeklyLimitDto) {
    return this.adminService.updateWeeklyLimit(dto.limit);
  }

  @Get('gallery')
  async getGallery() { return this.adminService.getGalleryImages(); }

  @Post('gallery')
  async addImage(@Body() dto: AddGalleryImageDto) {
    return this.adminService.addGalleryImage(dto.title, dto.titleHi || '', dto.imageUrl);
  }

  @Delete('gallery/:id')
  async deleteImage(@Param('id') id: string) { return this.adminService.deleteGalleryImage(id); }

  // ── Banner Management
  @Get('banners')
  async listBanners() { return this.adminService.listBanners(); }

  @Post('banners')
  async addBanner(@Body() dto: AddBannerDto) {
    return this.adminService.addBanner(dto.title, dto.titleHi, dto.imageUrl, dto.linkUrl);
  }

  @Delete('banners/:id')
  async deleteBanner(@Param('id') id: string) { return this.adminService.deleteBanner(id); }

  // ── Manager Management
  @Get('managers')
  async listManagers() { return this.adminService.listManagers(); }

  @Post('managers')
  async addManager(@Body() dto: AddManagerDto) {
    return this.adminService.addManager(dto.name, dto.mobile);
  }

  @Delete('managers/:id')
  async removeManager(@Param('id') id: string) { return this.adminService.removeManager(id); }

  @Get('team-activity')
  async getTeamActivity(@Query('memberId') memberId: string, @Query('days') days: string) {
    return this.adminService.getTeamActivity(memberId, parseInt(days || '7', 10));
  }

  // ── Profiles Management
  @Get('profiles')
  @SkipThrottle()
  async listProfiles(
    @Query('search') search: string,
    @Query('status') status: string,
    @Query('gender') gender: string,
    @Query('createdById') createdById: string,
    @Query('registrationSource') registrationSource: string,
    @Query('datePreset') datePreset: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('manglik') manglik: string,
    @Query('disability') disability: string,
    @Query('ageMin') ageMin: string,
    @Query('ageMax') ageMax: string,
    @Query('heightUnit') heightUnit: string,
    @Query('heightMin') heightMin: string,
    @Query('heightMax') heightMax: string,
    @Query('marriage') marriage: string,
    @Query('sort') sort: string,
    @Query('sortUpdatedAt') sortUpdatedAt: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listProfiles({
      search, status, gender, createdById, registrationSource,
      datePreset, dateFrom, dateTo, manglik, disability, ageMin, ageMax, heightUnit, heightMin, heightMax,
      marriage, sort,
      sortUpdatedAt: sortUpdatedAt === 'asc' || sortUpdatedAt === 'desc' ? sortUpdatedAt : undefined,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  @Patch('profiles/:id/status')
  async updateProfileStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.adminService.updateProfileStatus(id, body.status as any);
  }

  @Delete('profiles/:id')
  async deleteProfile(@Param('id') id: string) {
    return this.adminService.deleteProfile(id);
  }

  // ── Donations Management
  @Get('donations')
  async listDonations(
    @Query('type') type: string,
    @Query('status') status: string,
    @Query('search') search: string,
    @Query('paymentMethod') paymentMethod: string,
    @Query('collectedById') collectedById: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listDonations({
      type, status, search, paymentMethod, collectedById,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  // ── Detailed Registration Report
  @Get('reports/registrations-detailed')
  async getDetailedRegistrations(
    @Query('period') period: string,
    @Query('createdById') createdById: string,
    @Query('registrationSource') registrationSource: string,
    @Query('paymentMethod') paymentMethod: string,
    @Query('collectedById') collectedById: string,
  ) {
    return this.adminService.getRegistrationReport({
      period, createdById, registrationSource, paymentMethod, collectedById,
    });
  }

  // ── Notification History
  @Get('notifications')
  async listNotifications(
    @Query('channel') channel: string,
    @Query('status') status: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listNotifications({
      channel, status,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '30', 10),
    });
  }

  // ── Users Overview
  @Get('users')
  async listUsers(
    @Query('role') role: string,
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listUsers({
      role, search,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  @Get('incomplete-users')
  async listIncompleteUsers(
    @Query('search') search: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.adminService.listIncompleteUsers({
      search,
      page: parseInt(page || '1', 10),
      limit: parseInt(limit || '20', 10),
    });
  }

  // ── Sales Summary (weekly/monthly/yearly)
  @Get('sales')
  async getSalesSummary(@Query('period') period: string) {
    return this.donationsService.getSalesSummary((period || 'monthly') as 'weekly' | 'monthly' | 'yearly');
  }

  // ── Single Invoice
  @Get('invoices/:id')
  async getInvoice(@Param('id') id: string) {
    return this.donationsService.getInvoice(id);
  }

  // ── System Cleanup
  @Post('cleanup')
  async runCleanup() {
    const [, sessions] = await Promise.all([
      this.authService.cleanupExpiredOtps(),
      this.tokenService.cleanupExpiredSessions(),
    ]);
    return { cleanedSessions: sessions };
  }
}
