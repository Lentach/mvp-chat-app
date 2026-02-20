import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FcmTokensService } from '../fcm-tokens/fcm-tokens.service';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private initialized = false;

  constructor(private readonly fcmTokensService: FcmTokensService) {}

  onModuleInit() {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled',
      );
      return;
    }

    if (admin.apps.length === 0) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
        });
        this.initialized = true;
        this.logger.log('Firebase Admin initialized');
      } catch (err) {
        this.logger.error('Firebase Admin init failed', err);
      }
    } else {
      this.initialized = true;
    }
  }

  async notify(userId: number): Promise<void> {
    if (!this.initialized) return;

    const tokens = await this.fcmTokensService.findTokensByUserId(userId);
    if (!tokens.length) return;

    try {
      const result = await admin.messaging().sendEachForMulticast({
        tokens,
        data: { type: 'new_message' }, // empty payload — privacy like Signal
        android: { priority: 'high' },
        apns: { payload: { aps: { contentAvailable: true } } }, // silent push iOS
      });

      // Cleanup stale tokens (registration expired)
      result.responses.forEach((r, i) => {
        if (
          !r.success &&
          r.error?.code === 'messaging/registration-token-not-registered'
        ) {
          this.fcmTokensService.removeByToken(tokens[i]).catch(() => {});
        }
      });
    } catch (err) {
      this.logger.error(`Failed to send push to userId=${userId}`, err);
    }
  }
}
