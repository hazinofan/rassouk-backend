// src/upload/upload.controller.ts
import {
  BadRequestException,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import type { Express } from 'express'; 
import { ALLOWED_TYPES, UPLOAD_PROFILES } from './upload.config';
import type { UploadType } from './upload.config';

function fileFilter() {
  return (req: any, file: Express.Multer.File, cb: Function) => {
    const type: UploadType = req.params.type;
    const profile = UPLOAD_PROFILES[type];
    if (!profile) return cb(new BadRequestException('Type invalide'), false);
    if (!profile.mimeOk(file.mimetype)) {
      return cb(new BadRequestException('MIME non autorisé'), false);
    }
    cb(null, true);
  };
}

function makeFilename(_: any, file: Express.Multer.File, cb: Function) {
  const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
  cb(null, unique + extname(file.originalname).toLowerCase());
}

function destination(req: any, _: Express.Multer.File, cb: Function) {
  const type: UploadType = req.params.type;
  const profile = UPLOAD_PROFILES[type];
  if (!profile) return cb(new BadRequestException('Type invalide'), null);

  const dir = profile.root(req);
  fs.mkdirSync(dir, { recursive: true });
  cb(null, dir);
}

@Controller('upload')
export class UploadController {
  @Post(':type')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination,
        filename: makeFilename,
      }),
      fileFilter: fileFilter(),
      limits: {
        fileSize: (req: any, _file: any) => {
          const type: UploadType = req.params.type;
          const profile = UPLOAD_PROFILES[type];
          return profile?.maxSize ?? 5 * 1024 * 1024;
        },
      } as any,
    }),
  )
  async uploadOne(
    @Param('type') type: UploadType,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!ALLOWED_TYPES.includes(type)) {
      throw new BadRequestException('Type de dossier invalide');
    }
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    const profile = UPLOAD_PROFILES[type];
    const url = profile.publicUrl(null, file.filename);

    return {
      ok: true,
      type,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      url,                           // public URL to store/display
      path: url.replace('/public/', 'public/'), // internal path if you like
    };
  }
}
