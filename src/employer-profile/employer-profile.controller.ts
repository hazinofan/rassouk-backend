import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { EmployerProfilesService } from './employer-profile.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UpsertEmployerProfileDto } from './dto/create-employer-profile.dto';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('employer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer')
export class EmployerProfilesController {
  constructor(private service: EmployerProfilesService) {}

  @Get('me')
  async me(@Req() req: any) {
    const profile = await this.service.getMine(req.user.id);
    return profile ?? {};
  }

  @Put('me')
  async upsertMe(@Req() req: any, @Body() dto: UpsertEmployerProfileDto & { step?: number }) {
    const profile = await this.service.upsertMine(req.user.id, dto);
    return profile;
  }

  @Get('status')
  async status(@Req() req: any) {
    return this.service.getStatus(req.user.id);
  }
}
