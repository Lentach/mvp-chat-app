import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  // Password stored as bcrypt hash — never plain text
  @Column()
  password: string;

  @Column({ nullable: true })
  profilePictureUrl: string;

  @Column({ nullable: true })
  profilePicturePublicId: string;

  @CreateDateColumn()
  createdAt: Date;
}
