import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { Conversation } from '../conversations/conversation.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private msgRepo: Repository<Message>,
  ) {}

  async create(
    content: string,
    sender: User,
    conversation: Conversation,
  ): Promise<Message> {
    const msg = this.msgRepo.create({ content, sender, conversation });
    return this.msgRepo.save(msg);
  }

  // Ostatnie 50 wiadomości z konwersacji, od najstarszej do najnowszej.
  // Uproszczenie: brak paginacji w MVP.
  async findByConversation(conversationId: number): Promise<Message[]> {
    return this.msgRepo.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
      take: 50,
    });
  }
}
