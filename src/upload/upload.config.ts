// src/upload/upload.config.ts
import { join } from 'path';

export type UploadType =
  | 'avatars'
  | 'resumes'
  | 'banners'
  | 'logos'
  | 'attachments'
  | 'certificates'
  | 'profilePhoto'   
  | 'otherdocs';

type Profile = {
  root: (req: any) => string;     // absolute dir
  publicUrl: (req: any, filename: string) => string; 
  maxSize: number;                // bytes
  mimeOk: (mime: string) => boolean;
};

// baseline mimes
const isImage = (m: string) => /^image\//.test(m);
const isDoc   = (m: string) => /(pdf|msword|officedocument)/.test(m);
const any     = (_: string) => true;

export const UPLOAD_PROFILES: Record<UploadType, Profile> = {
  avatars: {
    root: () => join(process.cwd(), 'public', 'avatars'),
    publicUrl: (_req, f) => `/public/avatars/${f}`,
    maxSize: 5 * 1024 * 1024,
    mimeOk: isImage,
  },
  banners: {
    root: () => join(process.cwd(), 'public', 'banners'),
    publicUrl: (_req, f) => `/public/banners/${f}`,
    maxSize: 5 * 1024 * 1024,
    mimeOk: isImage,
  },
  logos: {
    root: () => join(process.cwd(), 'public', 'logos'),
    publicUrl: (_req, f) => `/public/logos/${f}`,
    maxSize: 5 * 1024 * 1024,
    mimeOk: isImage,
  },
  resumes: {
    root: () => join(process.cwd(), 'public', 'resumes'),
    publicUrl: (_req, f) => `/public/resumes/${f}`,
    maxSize: 8 * 1024 * 1024,
    mimeOk: isDoc,
  },
  profilePhoto: {
    root: () => join(process.cwd(), 'public', 'pdp'),
    publicUrl: (_req, f) => `/public/pdp/${f}`,
    maxSize: 8 * 1024 * 1024,
    mimeOk: isImage,
  },
  certificates: {
    root: () => join(process.cwd(), 'public', 'certificates'),
    publicUrl: (_req, f) => `/public/certificates/${f}`,
    maxSize: 10 * 1024 * 1024,
    mimeOk: (m) => isDoc(m) || isImage(m),
  },
  attachments: {
    root: () => join(process.cwd(), 'public', 'attachments'),
    publicUrl: (_req, f) => `/public/attachments/${f}`,
    maxSize: 15 * 1024 * 1024,
    mimeOk: any,
  },
  otherdocs: {
    root: () => join(process.cwd(), 'public', 'otherdocs'),
    publicUrl: (_req, f) => `/public/otherdocs/${f}`,
    maxSize: 10 * 1024 * 1024,
    mimeOk: isDoc,
  },
};

export const ALLOWED_TYPES = Object.keys(UPLOAD_PROFILES) as UploadType[];
