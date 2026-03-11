import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DataSource } from "typeorm";
import { User } from "src/users/users.entity";

// auth/guards/jwt.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private cfg: ConfigService,
    private dataSource: DataSource,
  ) {}

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

      const users = this.dataSource.getRepository(User);
      const user = await users.findOne({
        where: { id: Number(payload.sub) },
        select: ['id', 'email', 'role', 'isOnboarded', 'name', 'isBanned', 'bannedUntil'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (
        user.isBanned &&
        (!user.bannedUntil || user.bannedUntil.getTime() > Date.now())
      ) {
        throw new UnauthorizedException('Account suspended');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        isOnboarded: user.isOnboarded,
        name: user.name,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException('Invalid or expired token'); 
    }
  }
}
