import { Controller, Post, Get, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { SavedCandidatesService } from './saved_candidate.service';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('saved-candidates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('employer')
export class SavedCandidatesController {
  constructor(private service: SavedCandidatesService) {}

  @Post(':candidateId')
  async save(@Req() req, @Param('candidateId') candidateId: number) {
    return this.service.saveCandidate(req.user, { id: candidateId } as any);
  }

  @Get()
  async list(@Req() req) {
    return this.service.getSavedCandidates(req.user.id);
  }

  @Delete(':id')
  async remove(@Req() req, @Param('id') id: number) {
    return this.service.removeSaved(id, req.user.id);
  }
}
