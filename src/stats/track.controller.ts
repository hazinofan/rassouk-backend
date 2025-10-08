import { Body, Controller, Post } from '@nestjs/common';
import { AnalyticsService } from './stats.service';
import { TrackViewDto } from './dto/track-view.dto';
import { TrackClickDto } from './dto/track-click.dto';

@Controller('track') // → POST /track/view and /track/click-apply
export class TrackController {
  constructor(private readonly stats: AnalyticsService) {}

  @Post('view')
  async trackView(@Body() dto: TrackViewDto) {
    await this.stats.recordView(dto);
    return { ok: true };
  }

  @Post('click-apply')
  async trackClick(@Body() dto: TrackClickDto) {
    await this.stats.recordClick(dto);
    return { ok: true };
  }
}
