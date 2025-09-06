import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

// auth/guards/jwt.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private cfg: ConfigService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();

    const header = req.headers['authorization'] as string | undefined;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const cookieToken = req.cookies?.['access_token'];
    const token = bearer ?? cookieToken;

    if (!token) throw new UnauthorizedException('No token');

    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.cfg.get<string>('JWT_ACCESS_SECRET'), 
        algorithms: ['HS256'],
      }); 
      req.user = { id: payload.sub, email: payload.email, role: payload.role, isOnboarded: payload.isOnboarded, name: payload.name };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token'); 
    }
  }
}
