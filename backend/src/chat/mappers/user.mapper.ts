import { User } from '../../users/user.entity';

export class UserMapper {
  static toPayload(user: User) {
    return {
      id: user.id,
      username: user.username,
      profilePictureUrl: user.profilePictureUrl,
    };
  }

}
