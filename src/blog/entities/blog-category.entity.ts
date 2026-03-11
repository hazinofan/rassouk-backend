import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BlogPost } from './blog-post.entity';

@Entity('blog_categories')
export class BlogCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  name: string;

  @Column({ unique: true, length: 140 })
  slug: string;

  @OneToMany(() => BlogPost, (post) => post.category)
  posts: BlogPost[];
}
