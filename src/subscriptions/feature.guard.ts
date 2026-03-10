import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Type,
  mixin,
} from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';
import { EmployerFeatureKey } from './subscription.types';

export function requireFeature(feature: EmployerFeatureKey): Type<CanActivate> {
  @Injectable()
  class FeatureGuardMixin implements CanActivate {
    constructor(private readonly entitlements: EntitlementsService) {}

    async canActivate(context: ExecutionContext) {
      const request = context.switchToHttp().getRequest();
      const tenantId = Number(
        request.user?.id ?? request.params?.tenantId ?? request.body?.tenantId,
      );

      await this.entitlements.assertEmployerFeature(tenantId, feature);
      return true;
    }
  }

  return mixin(FeatureGuardMixin);
}
