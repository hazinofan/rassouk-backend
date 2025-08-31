import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
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

@Controller('candidate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('candidat')
export class CandidateProfilesController {
  constructor(private service: CandidateProfilesService) {}

  // Profile
  @Get('me')
  me(@Req() req: any) {
    return this.service.getMine(req.user.id);
  }

  @Put('me')
  upsert(@Req() req: any, @Body() dto: UpsertCandidateProfileDto) {
    return this.service.upsertMine(req.user.id, dto);
  }

  // Experiences
  @Post('experiences')
  addExp(@Req() req: any, @Body() dto: CreateExperienceDto) {
    return this.service.addExperience(req.user.id, dto);
  }

  @Put('experiences/:id')
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
  addEdu(@Req() req: any, @Body() dto: CreateEducationDto) {
    return this.service.addEducation(req.user.id, dto);
  }

  @Put('educations/:id')
  updateEdu(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEducationDto,
  ) {
    return this.service.updateEducation(req.user.id, id, dto);
  }

  @Delete('educations/:id')
  delEdu(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteEducation(req.user.id, id);
  }

  // Resumes
  @Post('resumes')
  addResume(@Req() req: any, @Body() dto: AddResumeDto) {
    return this.service.addResume(req.user.id, dto);
  }

  @Delete('resumes/:id')
  delResume(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteResume(req.user.id, id);
  }
}
