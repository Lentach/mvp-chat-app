import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { User } from '../users/user.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private convRepo: Repository<Conversation>,
  ) {}

  // Szukamy istniejącej konwersacji między dwoma użytkownikami.
  // Jeśli nie ma — tworzymy nową. Dzięki temu nie powstają duplikaty.
  async findOrCreate(userOne: User, userTwo: User): Promise<Conversation> {
    const existing = await this.convRepo.findOne({
      where: [
        { userOne: { id: userOne.id }, userTwo: { id: userTwo.id } },
        { userOne: { id: userTwo.id }, userTwo: { id: userOne.id } },
      ],
    });

    if (existing) return existing;

    const conv = this.convRepo.create({ userOne, userTwo });
    return this.convRepo.save(conv);
  }

  async findById(id: number): Promise<Conversation | null> {
    return this.convRepo.findOne({ where: { id } });
  }

  // Wszystkie konwersacje danego użytkownika
  async findByUser(userId: number): Promise<Conversation[]> {
    return this.convRepo.find({
      where: [
        { userOne: { id: userId } },
        { userTwo: { id: userId } },
      ],
    });
  }
}
