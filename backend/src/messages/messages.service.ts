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

  // Get messages from a conversation with pagination support.
  // Returns messages ordered oldest first (ASC).
  async findByConversation(
    conversationId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<Message[]> {
    return this.msgRepo.find({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'ASC' },
      take: limit,
      skip: offset,
    });
  }
}
