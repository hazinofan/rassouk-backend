import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  FeatureKey,
  LimitKey,
  PlanKey,
} from './subscription.types';

export class FeatureNotIncludedException extends ForbiddenException {
  constructor(planKey: PlanKey, requiredFeature: FeatureKey) {
    super({
      code: 'FEATURE_NOT_INCLUDED',
      planKey,
      requiredFeature,
    });
  }
}

export class LimitReachedException extends ConflictException {
  constructor(
    planKey: PlanKey,
    limitKey: LimitKey,
    limit: number | null,
    current: number,
  ) {
    super({
      code: 'LIMIT_REACHED',
      planKey,
      limitKey,
      limit,
      current,
    });
  }
}

export class SubscriptionInactiveException extends HttpException {
  constructor(planKey: PlanKey, status: string) {
    super(
      {
        code: 'SUBSCRIPTION_INACTIVE',
        planKey,
        status,
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
