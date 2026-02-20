import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FcmToken } from './fcm-token.entity';

@Injectable()
export class FcmTokensService {
  private readonly logger = new Logger(FcmTokensService.name);

  constructor(
    @InjectRepository(FcmToken)
    private readonly fcmTokenRepo: Repository<FcmToken>,
  ) {}

  async upsert(userId: number, token: string, platform: string): Promise<void> {
    await this.fcmTokenRepo.upsert({ userId, token, platform }, ['token']);
  }

  async removeByToken(token: string): Promise<void> {
    await this.fcmTokenRepo.delete({ token });
  }

  async removeByUserId(userId: number): Promise<void> {
    await this.fcmTokenRepo.delete({ userId });
  }

  async findTokensByUserId(userId: number): Promise<string[]> {
    const rows = await this.fcmTokenRepo.find({ where: { userId } });
    return rows.map((r) => r.token);
  }
}
