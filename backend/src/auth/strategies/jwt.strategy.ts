import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

const DEV_JWT_SECRET = 'super-secret-dev-key';

// Passport strategy — automatically verifies the JWT token
// and injects user data into request.user
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    configService: ConfigService,
  ) {
    const secret =
      configService.get<string>('JWT_SECRET') || DEV_JWT_SECRET;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: number;
    username: string;
    tag: string;
    profilePictureUrl: string;
  }) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      username: user.username,
      tag: user.tag,
      profilePictureUrl: user.profilePictureUrl,
    };
  }
}
