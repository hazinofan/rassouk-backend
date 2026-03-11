import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/decorators/roles.guard';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { BlogQueryDto } from './dto/blog-query.dto';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogService } from './blog.service';

@Controller()
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  @Get('blog/posts')
  listPublished(@Query() query: BlogQueryDto) {
    return this.blog.listPublished(query);
  }

  @Get('blog/posts/:slug')
  getPublishedBySlug(@Param('slug') slug: string) {
    return this.blog.getPublishedBySlug(slug);
  }

  @Get('blog/categories')
  listCategoriesPublic() {
    return this.blog.listCategories();
  }

  @Get('admin/blog/posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAdminPosts(@Query() query: BlogQueryDto) {
    return this.blog.listAdmin(query);
  }

  @Get('admin/blog/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  getAdminPost(@Param('id', ParseIntPipe) id: number) {
    return this.blog.getAdminPost(id);
  }

  @Post('admin/blog/posts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createDraft(@Body() dto: CreateBlogPostDto) {
    return this.blog.createDraft(dto);
  }

  @Patch('admin/blog/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updatePost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogPostDto,
  ) {
    return this.blog.updatePost(id, dto);
  }

  @Post('admin/blog/posts/:id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  publishPost(@Param('id', ParseIntPipe) id: number) {
    return this.blog.publishPost(id);
  }

  @Post('admin/blog/posts/:id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  unpublishPost(@Param('id', ParseIntPipe) id: number) {
    return this.blog.unpublishPost(id);
  }

  @Delete('admin/blog/posts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.blog.deletePost(id);
  }

  @Get('admin/blog/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listCategoriesAdmin() {
    return this.blog.listCategories();
  }

  @Post('admin/blog/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createCategory(@Body() dto: CreateBlogCategoryDto) {
    return this.blog.createCategory(dto);
  }

  @Patch('admin/blog/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBlogCategoryDto,
  ) {
    return this.blog.updateCategory(id, dto);
  }

  @Delete('admin/blog/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteCategory(@Param('id', ParseIntPipe) id: number) {
    return this.blog.deleteCategory(id);
  }
}
