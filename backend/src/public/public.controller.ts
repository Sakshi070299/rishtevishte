import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma.service';

/**
 * Public endpoints — no JWT guard.
 * Mounted at GET /api/v1/content/:key
 */
@ApiTags('Public')
@Controller('content')
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Get('gallery')
  @ApiOperation({ summary: 'Fetch active gallery images (no auth required)' })
  async getGallery() {
    return this.prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, titleHi: true, imageUrl: true, sortOrder: true },
    });
  }

  @Get('banners')
  @ApiOperation({ summary: 'Fetch active banners (no auth required)' })
  async getBanners() {
    return this.prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, titleHi: true, imageUrl: true, linkUrl: true, sortOrder: true },
    });
  }

  @Get(':key')
  @ApiOperation({ summary: 'Fetch public content by key (no auth required)' })
  @ApiParam({ name: 'key', example: 'terms_and_conditions' })
  async getContent(@Param('key') key: string) {
    const setting = await this.prisma.siteSettings.findUnique({ where: { key } });
    return { content: setting?.value ?? '' };
  }
}
