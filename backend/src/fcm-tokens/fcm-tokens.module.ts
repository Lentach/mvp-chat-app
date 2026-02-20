import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FcmToken } from './fcm-token.entity';
import { FcmTokensService } from './fcm-tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([FcmToken])],
  providers: [FcmTokensService],
  exports: [FcmTokensService],
})
export class FcmTokensModule {}
