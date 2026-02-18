import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn((val: string) => Promise.resolve(`hashed_${val}`)),
}));

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: Partial<User> = {
    id: 1,
    username: 'testuser',
    password: 'hashed_password',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findByUsername: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => 'mock_jwt_token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create user with valid password', async () => {
      usersService.create.mockResolvedValue(mockUser as User);
      const result = await service.register('testuser', 'ValidPass1');
      expect(usersService.create).toHaveBeenCalledWith(
        'testuser',
        'ValidPass1',
      );
      expect(result).toEqual({ id: 1, username: 'testuser' });
    });

    it('should reject password shorter than 8 chars', async () => {
      await expect(service.register('testuser', 'Short1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.register('testuser', 'Short1')).rejects.toThrow(
        /at least 8 characters/,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should reject password without uppercase', async () => {
      await expect(service.register('testuser', 'lowercase1')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should reject password without lowercase', async () => {
      await expect(service.register('testuser', 'UPPERCASE1')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should reject password without number', async () => {
      await expect(service.register('testuser', 'NoNumberHere')).rejects.toThrow(
        BadRequestException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return access_token for valid credentials', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const result = await service.login('testuser', 'ValidPass1');
      expect(result).toEqual({ access_token: 'mock_jwt_token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'testuser',
        profilePictureUrl: undefined,
      });
    });

    it('should throw when user not found', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      await expect(service.login('unknown', 'ValidPass1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('unknown', 'ValidPass1')).rejects.toThrow(
        'Invalid credentials',
      );
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw when password invalid', async () => {
      usersService.findByUsername.mockResolvedValue(mockUser as User);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login('testuser', 'WrongPass1')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('testuser', 'WrongPass1')).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });
});
