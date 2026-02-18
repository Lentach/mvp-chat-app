import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /auth/register — creates a new user
  // Rate limit: 3 requests per hour per IP
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password);
  }

  // POST /auth/login — returns JWT token
  // Rate limit: 5 requests per 15 minutes per IP
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }
}
