import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { CandidateProfile } from 'src/candidate-profile/entities/candidate-profile.entity';
import { CandidateResume } from 'src/candidate-profile/entities/candidate-resume.entity';
import { MailService } from 'src/mail/mail.service';
import { User } from 'src/users/users.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { AdminCvLibraryQueryDto } from './dto/admin-cv-library-query.dto';
import { AdminBanUserDto } from './dto/admin-ban-user.dto';
import { AdminCreateAdminUserDto } from './dto/admin-create-admin-user.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(CandidateResume)
    private readonly resumesRepo: Repository<CandidateResume>,
    private readonly mail: MailService,
  ) {}

  private generateTempPassword(length = 12) {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let value = '';
    for (let i = 0; i < length; i++) {
      value += chars[Math.floor(Math.random() * chars.length)];
    }
    return value;
  }

  private buildCvLibraryQuery(query: AdminCvLibraryQueryDto) {
    const qb = this.resumesRepo
      .createQueryBuilder('resume')
      .innerJoin(CandidateProfile, 'profile', 'profile.userId = resume.userId')
      .innerJoin(User, 'user', 'user.id = resume.userId')
      .where('user.role = :role', { role: 'candidat' })
      .select([
        'resume.id AS resumeId',
        'resume.userId AS candidateUserId',
        'resume.filePath AS filePath',
        'resume.label AS label',
        'resume.uploadedAt AS uploadedAt',
        'user.email AS email',
        'user.name AS accountName',
        'profile.firstName AS firstName',
        'profile.lastName AS lastName',
        'profile.headline AS headline',
        'profile.city AS city',
      ]);

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        `(
          user.email LIKE :term
          OR user.name LIKE :term
          OR profile.firstName LIKE :term
          OR profile.lastName LIKE :term
          OR CONCAT(profile.firstName, ' ', profile.lastName) LIKE :term
          OR resume.label LIKE :term
        )`,
        { term },
      );
    }

    if (query.city?.trim()) {
      qb.andWhere('profile.city LIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }

    if (query.candidateUserId) {
      qb.andWhere('resume.userId = :candidateUserId', {
        candidateUserId: query.candidateUserId,
      });
    }

    if (query.uploadedFrom) {
      qb.andWhere('resume.uploadedAt >= :uploadedFrom', {
        uploadedFrom: new Date(query.uploadedFrom),
      });
    }

    if (query.uploadedTo) {
      const uploadedTo = new Date(query.uploadedTo);
      uploadedTo.setHours(23, 59, 59, 999);
      qb.andWhere('resume.uploadedAt <= :uploadedTo', {
        uploadedTo,
      });
    }

    if (query.sortBy === 'candidateName') {
      qb.orderBy('profile.firstName', query.sortDir ?? 'DESC').addOrderBy(
        'profile.lastName',
        query.sortDir ?? 'DESC',
      );
    } else if (query.sortBy === 'email') {
      qb.orderBy('user.email', query.sortDir ?? 'DESC');
    } else {
      qb.orderBy('resume.uploadedAt', query.sortDir ?? 'DESC');
    }

    return qb;
  }

  private mapCvLibraryRow(row: Record<string, any>) {
    return {
      resumeId: Number(row.resumeId),
      candidateUserId: Number(row.candidateUserId),
      candidateName:
        [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
        row.accountName,
      firstName: row.firstName ?? null,
      lastName: row.lastName ?? null,
      email: row.email,
      headline: row.headline ?? null,
      city: row.city ?? null,
      label: row.label ?? null,
      filePath: row.filePath,
      uploadedAt: row.uploadedAt,
    };
  }

  private escapeCsvValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value).replace(/"/g, '""');
    return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
  }

  private escapeXml(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildCvLibraryCsv(rows: Array<Record<string, any>>) {
    const headers = [
      'resumeId',
      'candidateUserId',
      'candidateName',
      'firstName',
      'lastName',
      'email',
      'headline',
      'city',
      'label',
      'filePath',
      'uploadedAt',
    ];

    const lines = [
      headers.join(','),
      ...rows.map((row) =>
        headers.map((header) => this.escapeCsvValue(row[header])).join(','),
      ),
    ];

    return `\uFEFF${lines.join('\n')}`;
  }

  private buildCvLibraryExcel(rows: Array<Record<string, any>>) {
    const headers = [
      'Resume ID',
      'Candidate User ID',
      'Candidate Name',
      'First Name',
      'Last Name',
      'Email',
      'Headline',
      'City',
      'Label',
      'File Path',
      'Uploaded At',
    ];

    const headerXml = headers
      .map(
        (header) =>
          `<Cell ss:StyleID="header"><Data ss:Type="String">${this.escapeXml(header)}</Data></Cell>`,
      )
      .join('');

    const rowsXml = rows
      .map((row) => {
        const cells = [
          row.resumeId,
          row.candidateUserId,
          row.candidateName,
          row.firstName,
          row.lastName,
          row.email,
          row.headline,
          row.city,
          row.label,
          row.filePath,
          row.uploadedAt,
        ]
          .map(
            (value) =>
              `<Cell><Data ss:Type="String">${this.escapeXml(value)}</Data></Cell>`,
          )
          .join('');

        return `<Row>${cells}</Row>`;
      })
      .join('');

    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="CV Library">
  <Table>
   <Row>${headerXml}</Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;
  }

  private async getCvLibraryRows(query: AdminCvLibraryQueryDto) {
    const rows = await this.buildCvLibraryQuery(query).getRawMany();
    return rows.map((row) => this.mapCvLibraryRow(row));
  }

  async list(query: AdminUserQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.usersRepo.createQueryBuilder('u');

    if (query.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere('(u.email LIKE :term OR u.name LIKE :term)', { term });
    }
    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query.status === 'banned') {
      qb.andWhere('u.isBanned = true');
    } else if (query.status === 'active') {
      qb.andWhere('u.isBanned = false');
    }

    qb.orderBy(`u.${query.sortBy ?? 'createdAt'}`, query.sortDir ?? 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isBanned: u.isBanned,
        bannedAt: u.bannedAt,
        bannedUntil: u.bannedUntil,
        bannedReason: u.bannedReason,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      limit,
    };
  }

  async listCvLibrary(query: AdminCvLibraryQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const qb = this.buildCvLibraryQuery(query);
    qb.skip(skip).take(limit);

    const [rows, total] = await Promise.all([
      qb.getRawMany(),
      this.buildCvLibraryQuery(query).getCount(),
    ]);

    return {
      data: rows.map((row) => this.mapCvLibraryRow(row)),
      total,
      page,
      limit,
    };
  }

  async exportCvLibraryCsv(query: AdminCvLibraryQueryDto) {
    const rows = await this.getCvLibraryRows(query);
    return this.buildCvLibraryCsv(rows);
  }

  async exportCvLibraryExcel(query: AdminCvLibraryQueryDto) {
    const rows = await this.getCvLibraryRows(query);
    return this.buildCvLibraryExcel(rows);
  }

  async getById(id: number) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: {
        profile: true,
        candidateProfile: {
          resumes: true,
          educations: true,
          experiences: true,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, refreshTokenHash, ...safe } = user as any;
    return safe;
  }

  async createAdmin(dto: AdminCreateAdminUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepo.findOne({ where: { email }, withDeleted: true });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const plainPassword = dto.password?.trim() || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const created = await this.usersRepo.save(
      this.usersRepo.create({
        email,
        name: dto.name.trim(),
        passwordHash,
        role: 'admin',
        emailVerified: true,
        isOnboarded: true,
        onboardingStep: 0,
        isBanned: false,
        bannedAt: null,
        bannedUntil: null,
        bannedReason: null,
        bannedByUserId: null,
      }),
    );

    try {
      await this.mail.sendAdminCredentialsEmail({
        to: email,
        name: created.name,
        email,
        password: plainPassword,
      });
    } catch (err) {
      await this.usersRepo.delete(created.id);
      throw err;
    }

    return { ok: true, id: created.id, email: created.email };
  }

  async banUser(id: number, dto: AdminBanUserDto, actorUserId: number) {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot ban yourself');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const until = dto.until ? new Date(dto.until) : null;
    if (until && Number.isNaN(until.getTime())) {
      throw new BadRequestException('Invalid until date');
    }

    user.isBanned = true;
    user.bannedAt = new Date();
    user.bannedUntil = until;
    user.bannedReason = dto.reason.trim();
    user.bannedByUserId = actorUserId;
    await this.usersRepo.save(user);

    return { ok: true };
  }

  async unbanUser(id: number) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isBanned = false;
    user.bannedAt = null;
    user.bannedUntil = null;
    user.bannedReason = null;
    user.bannedByUserId = null;
    await this.usersRepo.save(user);

    return { ok: true };
  }

  async deleteUser(id: number, actorUserId: number) {
    if (id === actorUserId) {
      throw new BadRequestException('You cannot delete yourself');
    }
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.usersRepo.softDelete(id);
    return { ok: true };
  }
}
