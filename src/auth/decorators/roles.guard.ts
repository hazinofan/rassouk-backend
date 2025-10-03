// roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<any[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const userRole = String(req.user?.role ?? '').trim().toLowerCase();
    const requiredRoles = required.map(r => String(r).trim().toLowerCase());

    const ok = !!userRole && requiredRoles.includes(userRole);
    if (!ok) {
      throw new ForbiddenException(
        `Forbidden: need role ${requiredRoles.join('|')}, got ${userRole || 'none'}`
      );
    }
    return true;
  }
}
