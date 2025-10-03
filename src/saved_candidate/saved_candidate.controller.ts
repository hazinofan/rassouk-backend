import { Controller, Post, Get, Delete, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { SavedCandidatesService } from './saved_candidate.service';

@Controller('saved-candidates')
@UseGuards(JwtAuthGuard) // only logged-in employers
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
