import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { UserRole } from '@/generated/prisma';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    // Create a deep mock of PrismaService
    const mockPrisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should find a user by id', async () => {
    const mockUser = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Test User',
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyName: null,
      companyLogo: null,
      phone: null,
      address: null,
      website: null,
    };

    prismaService.user.findUnique.mockResolvedValue(mockUser);

    const result = await service.findById('test-id');

    expect(result).toEqual(mockUser);
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'test-id' },
    });
  });

  it('should update a user profile', async () => {
    const mockUser = {
      id: 'test-id',
      email: 'test@example.com',
      name: 'Updated Name',
      createdAt: new Date(),
      updatedAt: new Date(),
      companyName: null,
      companyLogo: null,
      phone: null,
      address: null,
      website: null,
    };
    const updateData = { name: 'Updated Name' };

    prismaService.user.update.mockResolvedValue(mockUser);

    const result = await service.updateProfile('test-id', updateData);

    expect(result).toEqual(mockUser);
    expect(prismaService.user.update).toHaveBeenCalledWith({
      where: { id: 'test-id' },
      data: updateData,
    });
  });
});
