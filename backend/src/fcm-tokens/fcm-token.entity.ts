import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
@Index(['token'], { unique: true })
export class FcmToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column({ unique: true })
  token: string;

  @Column({ default: 'web' })
  platform: string; // 'web' | 'android' | 'ios'

  @CreateDateColumn()
  createdAt: Date;
}
