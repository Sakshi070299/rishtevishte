// ═══════════════════════════════════════════════════════
// SEARCH MODULE — Profile Search + Weekly Limits
// Rule: 5 profiles/week, resets Sunday, always different
// ═══════════════════════════════════════════════════════

import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
