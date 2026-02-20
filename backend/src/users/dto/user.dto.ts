import { IsString, MinLength, Matches, IsIn } from 'class-validator';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
  PASSWORD_REGEX_MESSAGE,
} from '../../auth/password.constants';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  oldPassword: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  })
  @Matches(PASSWORD_REGEX, { message: PASSWORD_REGEX_MESSAGE })
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string;
}

export class RegisterFcmTokenDto {
  @IsString()
  @MinLength(10)
  token: string;

  @IsIn(['web', 'android', 'ios'])
  platform: string;
}

export class RemoveFcmTokenDto {
  @IsString()
  @MinLength(1)
  token: string;
}
