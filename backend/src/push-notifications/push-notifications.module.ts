import { Module } from '@nestjs/common';
import { FcmTokensModule } from '../fcm-tokens/fcm-tokens.module';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [FcmTokensModule],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
