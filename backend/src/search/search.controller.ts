import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SearchService } from './search.service';
import { SearchFiltersDto } from './search.dto';
import { SkipThrottle } from '@nestjs/throttler';

type JwtRequest = { user: { sub: string } };

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Post()
  @SkipThrottle()
  async search(@Request() req: JwtRequest, @Body() filters: SearchFiltersDto) {
    return this.searchService.searchProfiles(req.user.sub, filters);
  }

  @Get('remaining')
  @SkipThrottle()
  async getRemaining(@Request() req: JwtRequest) {
    return this.searchService.getRemainingViews(req.user.sub);
  }
}
