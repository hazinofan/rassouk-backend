import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CandidateProfilesService } from './candidate-profile.service';
import { UpsertCandidateProfileDto } from './dto/upsert-candidate-profile.dto';
import { CreateExperienceDto } from './dto/create-experience.dto';
import { UpdateExperienceDto } from './dto/update-experience.dto';
import { CreateEducationDto } from './dto/create-education.dto';
import { UpdateEducationDto } from './dto/update-education.dto';
import { AddResumeDto } from './dto/add-resume.dto';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { QueryCandidatesDto } from './dto/query-candidates.dto';

@Controller('candidate')
@UseGuards(JwtAuthGuard, RolesGuard)

export class CandidateProfilesController {
  constructor(private service: CandidateProfilesService) { }

  @Get()
  list(@Query() q: QueryCandidatesDto) {
    return this.service.listPublic(q)
  }
  // Profile
  @Roles('candidat')
  @Get('me')
  me(@Req() req: any) {
    return this.service.getMine(req.user.id);
  }

  @Roles('candidat')
  @Put('me')
  upsert(@Req() req: any, @Body() dto: UpsertCandidateProfileDto) {
    return this.service.upsertMine(req.user.id, dto);
  }

  // Experiences
  @Roles('candidat')
  @Post('experiences')
  addExp(@Req() req: any, @Body() dto: CreateExperienceDto) {
    return this.service.addExperience(req.user.id, dto);
  }

  @Put('experiences/:id')
  @Roles('candidat')
  updateExp(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExperienceDto,
  ) {
    return this.service.updateExperience(req.user.id, id, dto);
  }

  @Delete('experiences/:id')
  delExp(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteExperience(req.user.id, id);
  }

  // Educations
  @Post('educations')
  @Roles('candidat')
  addEdu(@Req() req: any, @Body() dto: CreateEducationDto) {
    return this.service.addEducation(req.user.id, dto);
  }

  @Put('educations/:id')
  @Roles('candidat')
  updateEdu(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.service.updateEducation(req.user.id, id, dto);
  }

  @Delete('educations/:id')
  @Roles('candidat')
  delEdu(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteEducation(req.user.id, id);
  }

  // Resumes
  @Roles('candidat')
  @Post('resumes')
  addResume(@Req() req: any, @Body() dto: AddResumeDto) {
    return this.service.addResume(req.user.id, dto);
  }

  @Roles('candidat')
  @Delete('resumes/:id')
  delResume(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteResume(req.user.id, id);
  }
}
