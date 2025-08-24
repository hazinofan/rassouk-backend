import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
export type UserRole = 'admin' | 'candidat' | 'employer';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  async create(data: { email: string; passwordHash: string; role?: UserRole }) {
    const user = this.repo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? 'candidat',
    });
    return this.repo.save(user);
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
}
