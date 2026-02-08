import { Conversation } from '../../conversations/conversation.entity';
import { UserMapper } from './user.mapper';

export class ConversationMapper {
  static toPayload(
    conversation: Conversation,
    options?: { unreadCount?: number },
  ) {
    return {
      id: conversation.id,
      userOne: UserMapper.toPayload(conversation.userOne),
      userTwo: UserMapper.toPayload(conversation.userTwo),
      createdAt: conversation.createdAt,
      unreadCount: options?.unreadCount ?? 0,
    };
  }

  static toPayloadArray(conversations: Conversation[]) {
    return conversations.map((c) => this.toPayload(c));
  }
}
