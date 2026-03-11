// src/users/users.controller.ts
import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { QueryEmployersDto } from './dto/query-employers.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  private strip(u: any) {
    if (!u) return u;
    const { passwordHash, refreshTokenHash, ...rest } = u;
    return rest;
  }

  // POST /users
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async create(@Body() body: any) {
    if (!body?.email) throw new BadRequestException('email is required');
    if (!body?.password) throw new BadRequestException('password is required');

    const created = await this.users.createWithPassword({
      email: String(body.email).trim().toLowerCase(),
      password: String(body.password),
      name: body?.name ?? '',
      role: body?.role ?? 'candidat',
    });
    return this.strip(created);
  }

  // GET /users
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findAll() {
    const list = await this.users.findAll();
    return list.map((u) => this.strip(u));
  }

  // GET /users/employers (alias: /users/emplyers)
  @Get(['employers', 'emplyers'])
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('candidat', 'admin')
  async findEmployers(@Query() query: QueryEmployersDto) {
    return this.users.findEmployers(query);
  }

  // GET /users/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const u = await this.users.findById(id);
    return this.strip(u);
  }

  // PATCH /users/:id
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const updated = await this.users.updatePartial(id, body);
    return this.strip(updated);
  }

  // PATCH /users/:id/onboarding → set isOnboarded = true
  @Patch(':id/onboarding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async completeOnboarding(@Param('id', ParseIntPipe) id: number) {
    const updated = await this.users.updatePartial(id, {
      isOnboarded: true,
    });
    return this.strip(updated);
  }

  // PATCH /users/:id/onboarding-step → update onboardingStep
  @Patch(':id/onboarding-step')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async setStep(
    @Param('id', ParseIntPipe) id: number,
    @Body('step') step: number,
  ) {
    if (typeof step !== 'number') {
      throw new BadRequestException('step must be a number');
    }
    const updated = await this.users.updatePartial(id, {
      onboardingStep: step,
    });
    return this.strip(updated);
  }

  // DELETE /users/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.users.remove(id);
    return { success: true };
  }
}
