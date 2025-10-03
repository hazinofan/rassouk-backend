import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateApplicationDto } from './dto/create-application.dto';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ApplicationStatus } from './entities/application.entity';
import { QueryApplicationsDto } from './dto/query-applications.dto';

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

  @Roles('employer')
  @Get('/jobapp/:jobId')
  async getApplicationsForJob(@Param('jobId') jobId: number, @Req() req: any) {
    return this.service.getApplicationsForJob(+jobId, req.user.id);
  }

  @Get('application/:id')
  async findOne(@Param('id', ParseIntPipe) id:number) {
    return this.service.getAppById(id)
  }

  @Get(':slug/applications')
  // @UseGuards(AuthGuard, RolesGuard)
  @Roles('employer')
  async listEmployer(
    @Param('slug') slug: string,
    @Query() qs: QueryApplicationsDto,
    @Req() req: any,
  ) {
    const employerId = req.user.id;
    return this.service.listByJobSlugForEmployer(slug, employerId, qs);
  }

  @Roles('employer')
  @Patch('/applications/:id/status')
  async patchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @Req() req: any,
  ) {
    const employerId = req.user.id;
    return this.service.updateStatusForEmployer(
      +id,
      employerId,
      dto.status as ApplicationStatus,
    );
  }

  @Roles('candidat')
  @Get('/me/applications')
  myApps(@Req() req: any) {
    return this.service.myApps(Number(req.user.id));
  }

  @UseGuards(JwtAuthGuard) 
  @Get('jobs/:jobId/applications/me')
  async hasAppliedForJob(@Param('jobId') jobId: string, @Req() req: any) {
    const hasApplied = await this.service.hasApplied(+jobId, req.user.id);
    return { hasApplied };
  }
}
