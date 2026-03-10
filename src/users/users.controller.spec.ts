import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    findEmployers: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('forwards the employers listing query params', async () => {
    usersService.findEmployers.mockResolvedValue({ data: [], total: 0 });

    await controller.findEmployers('18', '12', 'latest');

    expect(usersService.findEmployers).toHaveBeenCalledWith({
      page: 18,
      limit: 12,
      sort: 'latest',
    });
  });
});
