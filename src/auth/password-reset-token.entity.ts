import { User } from 'src/users/users.entity';
import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: 66 }) // sha256 hex
  tokenHash: string;

  @Index()
  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  requestIp: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requestUa: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
