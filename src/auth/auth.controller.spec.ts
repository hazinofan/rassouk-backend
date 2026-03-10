import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { EntitlementsService } from 'src/subscriptions/entitlements.service';
import { JwtAuthGuard } from './guards/jwt.guard';

describe('AuthController', () => {
  let controller: AuthController;
  const authService = {};
  const cfg = {};
  const jwt = {};
  const usersService = {
    findById: jest.fn(),
  };
  const entitlements = {
    getBillingSnapshot: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: cfg },
        { provide: JwtService, useValue: jwt },
        { provide: UsersService, useValue: usersService },
        { provide: EntitlementsService, useValue: entitlements },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('returns billing inside auth me payload', async () => {
    usersService.findById.mockResolvedValue({
      id: 4,
      email: 'candidate@example.com',
      role: 'candidat',
      name: 'Candidate',
      isOnboarded: true,
      onboardingStep: 2,
    });
    entitlements.getBillingSnapshot.mockResolvedValue({
      audience: 'candidate',
      planKey: 'starter',
      usage: {
        max_applications_per_month: { current: 5, limit: 40, remaining: 35 },
      },
    });

    const result = await controller.me({
      user: { id: 4, email: 'candidate@example.com', role: 'candidat' },
    } as any);

    expect(result.billing).toBeDefined();
    expect(result.billing.planKey).toBe('starter');
    expect(result.billing.usage.max_applications_per_month.remaining).toBe(35);
  });
});
