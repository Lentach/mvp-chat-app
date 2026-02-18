import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly auditLogger = new Logger('Audit');
  // Password strength requirements
  private PASSWORD_MIN_LENGTH = 8;
  private PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\s@$!%*?&]{8,}$/;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private validatePassword(password: string): void {
    if (password.length < this.PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`,
      );
    }

    if (!this.PASSWORD_REGEX.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
    }
  }

  async register(username: string, password: string) {
    this.validatePassword(password);
    const user = await this.usersService.create(username, password);
    return { id: user.id, username: user.username, tag: user.tag };
  }

  async login(identifier: string, password: string) {
    let user: User | null = null;
    if (identifier.includes('#')) {
      const [u, t] = identifier.split('#');
      if (u && t) user = await this.usersService.findByUsernameAndTag(u.trim(), t.trim());
    } else {
      const users = await this.usersService.findByUsername(identifier.trim());
      if (users.length === 1) user = users[0];
      else if (users.length > 1) {
        this.auditLogger.log(`login failed identifier=${identifier} (multiple users)`);
        throw new UnauthorizedException('Multiple users found, please use username#tag');
      }
    }
    if (!user) {
      this.auditLogger.log(`login failed identifier=${identifier}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      this.auditLogger.log(`login failed identifier=${identifier}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.auditLogger.log(`login success userId=${user.id} username=${user.username}`);

    const payload = {
      sub: user.id,
      username: user.username,
      tag: user.tag,
      profilePictureUrl: user.profilePictureUrl,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
