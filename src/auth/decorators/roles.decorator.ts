import { SetMetadata } from '@nestjs/common';
import type { UserRole } from 'src/users/users.entity'; // or 'src/users/user.entity'

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
