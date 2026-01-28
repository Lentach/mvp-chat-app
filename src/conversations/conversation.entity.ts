import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// Konwersacja łączy dwóch użytkowników.
// W MVP nie robimy grup — tylko czat 1-na-1.
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_one_id' })
  userOne: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'user_two_id' })
  userTwo: User;

  @CreateDateColumn()
  createdAt: Date;
}
