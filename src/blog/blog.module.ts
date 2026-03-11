import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogCategory } from './entities/blog-category.entity';
import { BlogMedia } from './entities/blog-media.entity';
import { BlogPost } from './entities/blog-post.entity';
import { BlogTag } from './entities/blog-tag.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlogPost, BlogCategory, BlogTag, BlogMedia]),
    AuthModule,
  ],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
