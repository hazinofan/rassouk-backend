import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';

export type UserRole = 'admin' | 'candidat' | 'employer';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  // keep your old create
  async create(data: DeepPartial<User>) {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  // NEW: create with plaintext password (hash it here)
  async createWithPassword(data: { email: string; password: string; name?: string; role?: UserRole }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({
      email: data.email,
      name: data.name ?? '',
      role: data.role ?? 'candidat',
      passwordHash,
    } as DeepPartial<User>);
    return this.repo.save(user);
  }

  // NEW: return all users
  async findAll() {
    return this.repo.find();
  }

  async findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  async findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async verifyEmail(id: number) {
    await this.repo.update(id, { emailVerified: true });
  }

  async setRefreshTokenHash(userId: number, hash: string) {
    await this.repo.update(userId, { refreshTokenHash: hash });
  }

  async getRefreshTokenHash(userId: number) {
    const u = await this.repo.findOne({
      where: { id: userId },
      select: ['id', 'refreshTokenHash'],
    });
    return u?.refreshTokenHash ?? null;
  }

  async updatePassword(userId: number, passwordHash: string) {
    await this.repo.update(userId, { passwordHash });
  }

  // NEW: partial update (generic)
  async updatePartial(userId: number, patch: any) {
    const data: any = { ...patch };
    if (typeof patch.password === 'string' && patch.password.length > 0) {
      data.passwordHash = await bcrypt.hash(patch.password, 10);
      delete data.password;
    }
    if (typeof data.email === 'string') {
      data.email = data.email.trim().toLowerCase();
    }
    await this.repo.update(userId, data);
    return this.findById(userId);
  }

  // NEW: remove user
  async remove(userId: number) {
    await this.repo.delete(userId);
  }
}
