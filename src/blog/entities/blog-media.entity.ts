import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blog_media')
export class BlogMedia {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ type: 'text', nullable: true })
  alt: string | null;

  @Column({ type: 'text', nullable: true })
  caption: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
