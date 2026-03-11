import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlogCategory } from './blog-category.entity';
import { BlogMedia } from './blog-media.entity';
import { BlogTag } from './blog-tag.entity';

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type BlogPostVisibility = 'PUBLIC' | 'PRIVATE';

@Entity('blog_posts')
@Index(['status', 'publishedAt'])
export class BlogPost {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 180 })
  title: string;

  @Column({ unique: true, length: 220 })
  slug: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  @Column({ type: 'longtext', nullable: true, charset: 'utf8mb4', collation: 'utf8mb4_unicode_ci' })
  contentHtml: string | null;

  @Column({ type: 'simple-json', nullable: true })
  contentJson: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
  })
  status: BlogPostStatus;

  @Column({
    type: 'enum',
    enum: ['PUBLIC', 'PRIVATE'],
    default: 'PUBLIC',
  })
  visibility: BlogPostVisibility;

  @Column({ default: false })
  featured: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  seoTitle: string | null;

  @Column({ type: 'text', nullable: true })
  seoDesc: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ogImageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  canonicalUrl: string | null;

  @Column({ type: 'boolean', default: false })
  noindex: boolean;

  @ManyToOne(() => BlogCategory, (category) => category.posts, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  category: BlogCategory | null;

  @ManyToMany(() => BlogTag, { cascade: false })
  @JoinTable({
    name: 'blog_post_tags',
    joinColumn: { name: 'post_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: BlogTag[];

  @ManyToOne(() => BlogMedia, { nullable: true, onDelete: 'SET NULL' })
  featuredMedia: BlogMedia | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
