import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { ApplicationsService } from './applications.service';

// src/applications/applications.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ApplicationsController {
  constructor(private service: ApplicationsService) {}

  @Roles('candidat')
  @Post('/jobs/:jobId/apply')
  apply(
    @Param('jobId') jobId: string,
    @Body() dto: CreateApplicationDto,
    @Req() req: any,
  ) {
    return this.service.create(Number(jobId), Number(req.user.id), dto);
  }

  @Roles('candidat')
  @Get('/me/applications')
  myApps(@Req() req: any) {
    return this.service.myApps(Number(req.user.id));
  }

  @UseGuards(JwtAuthGuard) // your auth guard
  @Get('jobs/:jobId/applications/me')
  async hasAppliedForJob(@Param('jobId') jobId: string, @Req() req: any) {
    const hasApplied = await this.service.hasApplied(
      +jobId,
      req.user.id,
    );
    return { hasApplied };
  }
}
