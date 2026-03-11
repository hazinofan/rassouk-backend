import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BlogQueryDto } from './dto/blog-query.dto';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { BlogCategory } from './entities/blog-category.entity';
import { BlogPost } from './entities/blog-post.entity';
import { BlogTag } from './entities/blog-tag.entity';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(BlogPost)
    private readonly postsRepo: Repository<BlogPost>,
    @InjectRepository(BlogCategory)
    private readonly categoriesRepo: Repository<BlogCategory>,
    @InjectRepository(BlogTag)
    private readonly tagsRepo: Repository<BlogTag>,
  ) {}

  async createDraft(dto: CreateBlogPostDto) {
    const title = (dto.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const slug = await this.generateUniqueSlug(title);
    const category = await this.resolveCategory(dto.categoryId);
    const tags = await this.resolveTags(dto.tagIds);

    const post = this.postsRepo.create({
      title,
      slug,
      coverImageUrl: dto.coverImageUrl ?? null,
      excerpt: dto.excerpt ?? null,
      contentHtml: dto.contentHtml ?? null,
      contentJson: dto.contentJson ?? null,
      status: 'DRAFT',
      visibility: dto.visibility ?? 'PUBLIC',
      featured: dto.featured ?? false,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      category,
      tags,
      seoTitle: dto.seoTitle ?? null,
      seoDesc: dto.seoDesc ?? null,
      ogImageUrl: dto.ogImageUrl ?? null,
      canonicalUrl: dto.canonicalUrl ?? null,
      noindex: dto.noindex ?? false,
      publishedAt: null,
    });

    return this.postsRepo.save(post);
  }

  async listAdmin(query: BlogQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.category', 'category')
      .leftJoinAndSelect('post.tags', 'tag')
      .orderBy('post.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.q?.trim()) {
      qb.andWhere('(post.title LIKE :q OR post.slug LIKE :q)', {
        q: `%${query.q.trim()}%`,
      });
    }
    if (query.status) {
      qb.andWhere('post.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getAdminPost(id: number) {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['category', 'tags'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async updatePost(id: number, dto: UpdateBlogPostDto) {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['category', 'tags'],
    });
    if (!post) throw new NotFoundException('Post not found');

    if (dto.title !== undefined) {
      post.title = dto.title.trim();
      if (!post.title) throw new BadRequestException('title is required');
      post.slug = await this.generateUniqueSlug(post.title, post.id);
    }

    if (dto.coverImageUrl !== undefined) post.coverImageUrl = dto.coverImageUrl ?? null;
    if (dto.excerpt !== undefined) post.excerpt = dto.excerpt ?? null;
    if (dto.contentHtml !== undefined) post.contentHtml = dto.contentHtml ?? null;
    if (dto.contentJson !== undefined) post.contentJson = dto.contentJson ?? null;
    if (dto.visibility !== undefined) post.visibility = dto.visibility;
    if (dto.featured !== undefined) post.featured = dto.featured;
    if (dto.scheduledAt !== undefined) {
      post.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.seoTitle !== undefined) post.seoTitle = dto.seoTitle ?? null;
    if (dto.seoDesc !== undefined) post.seoDesc = dto.seoDesc ?? null;
    if (dto.ogImageUrl !== undefined) post.ogImageUrl = dto.ogImageUrl ?? null;
    if (dto.canonicalUrl !== undefined) post.canonicalUrl = dto.canonicalUrl ?? null;
    if (dto.noindex !== undefined) post.noindex = dto.noindex;

    if (dto.categoryId !== undefined) {
      post.category = (await this.resolveCategory(dto.categoryId)) ?? null;
    }
    if (dto.tagIds !== undefined) {
      post.tags = (await this.resolveTags(dto.tagIds)) ?? [];
    }

    return this.postsRepo.save(post);
  }

  async publishPost(id: number) {
    const post = await this.postsRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    post.status = 'PUBLISHED';
    post.publishedAt = new Date();
    post.scheduledAt = null;
    return this.postsRepo.save(post);
  }

  async unpublishPost(id: number) {
    const post = await this.postsRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    post.status = 'DRAFT';
    post.publishedAt = null;
    post.scheduledAt = null;
    return this.postsRepo.save(post);
  }

  async deletePost(id: number) {
    const post = await this.postsRepo.findOne({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    await this.postsRepo.remove(post);
    return { ok: true };
  }

  async listPublished(query: BlogQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.postsRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.category', 'category')
      .leftJoinAndSelect('post.tags', 'tag')
      .where('post.status = :status', { status: 'PUBLISHED' })
      .andWhere('post.visibility = :visibility', { visibility: 'PUBLIC' })
      .orderBy('post.publishedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.q?.trim()) {
      qb.andWhere('(post.title LIKE :q OR post.excerpt LIKE :q)', {
        q: `%${query.q.trim()}%`,
      });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getPublishedBySlug(slug: string) {
    const post = await this.postsRepo.findOne({
      where: { slug, status: 'PUBLISHED', visibility: 'PUBLIC' },
      relations: ['category', 'tags'],
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async listCategories() {
    return this.categoriesRepo.find({ order: { name: 'ASC' } });
  }

  async createCategory(dto: CreateBlogCategoryDto) {
    const name = dto.name.trim();
    const slug = this.slugify(name);
    const existing = await this.categoriesRepo.findOne({
      where: [{ name }, { slug }],
    });
    if (existing) throw new BadRequestException('Category already exists');
    return this.categoriesRepo.save(this.categoriesRepo.create({ name, slug }));
  }

  async updateCategory(id: number, dto: UpdateBlogCategoryDto) {
    const category = await this.categoriesRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    if (dto.name !== undefined) {
      category.name = dto.name.trim();
      category.slug = this.slugify(category.name);
    }
    return this.categoriesRepo.save(category);
  }

  async deleteCategory(id: number) {
    const category = await this.categoriesRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    await this.categoriesRepo.delete(id);
    return { ok: true };
  }

  private async resolveCategory(categoryId?: number | null) {
    if (categoryId === undefined) return undefined;
    if (categoryId === null) return null;
    const category = await this.categoriesRepo.findOne({ where: { id: categoryId } });
    if (!category) throw new BadRequestException('Category not found');
    return category;
  }

  private async resolveTags(tagIds?: number[]) {
    if (!tagIds) return undefined;
    if (!tagIds.length) return [];
    const tags = await this.tagsRepo.findBy({ id: In(tagIds) });
    if (tags.length !== new Set(tagIds).size) {
      throw new BadRequestException('One or more tags not found');
    }
    return tags;
  }

  private slugify(input: string) {
    return input
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private async generateUniqueSlug(title: string, excludeId?: number) {
    const base = this.slugify(title) || 'post';
    let slug = base;
    let i = 2;

    while (true) {
      const existing = await this.postsRepo.findOne({ where: { slug } });
      if (!existing || existing.id === excludeId) return slug;
      slug = `${base}-${i++}`;
    }
  }
}
