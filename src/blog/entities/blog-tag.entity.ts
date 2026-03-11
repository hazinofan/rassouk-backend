import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('blog_tags')
export class BlogTag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true, length: 120 })
  slug: string;
}
