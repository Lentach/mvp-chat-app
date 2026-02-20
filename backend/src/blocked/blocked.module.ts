import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedUser } from './blocked-user.entity';
import { BlockedService } from './blocked.service';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockedUser]),
    FriendsModule,
  ],
  providers: [BlockedService],
  exports: [BlockedService],
})
export class BlockedModule {}
