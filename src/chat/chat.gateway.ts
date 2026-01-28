import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';

// cors: '*' — uproszczenie dla MVP, w produkcji ustaw konkretną domenę
@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Mapa: userId -> socketId, żeby wiedzieć kto jest online
  private onlineUsers = new Map<number, string>();

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private conversationsService: ConversationsService,
    private messagesService: MessagesService,
  ) {}

  // Przy połączeniu WebSocket — weryfikujemy JWT token.
  // Klient wysyła token w query: ?token=xxx
  // Uproszczenie: w produkcji lepiej użyć middleware lub handshake headers.
  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.query.token as string) ||
        client.handshake.auth?.token;

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        client.disconnect();
        return;
      }

      // Zapisujemy dane użytkownika w obiekcie socketa
      client.data.user = { id: user.id, email: user.email };
      this.onlineUsers.set(user.id, client.id);

      console.log(`User connected: ${user.email} (socket: ${client.id})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.user) {
      this.onlineUsers.delete(client.data.user.id);
      console.log(`User disconnected: ${client.data.user.email}`);
    }
  }

  // Klient wysyła: { recipientId: number, content: string }
  // Serwer:
  //   1. Znajduje lub tworzy konwersację
  //   2. Zapisuje wiadomość w bazie
  //   3. Wysyła wiadomość do odbiorcy (jeśli jest online)
  //   4. Potwierdza nadawcy
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipientId: number; content: string },
  ) {
    const senderId: number = client.data.user?.id;
    if (!senderId) return;

    const sender = await this.usersService.findById(senderId);
    const recipient = await this.usersService.findById(data.recipientId);

    if (!sender || !recipient) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    // Znajdź lub utwórz konwersację między tymi dwoma użytkownikami
    const conversation = await this.conversationsService.findOrCreate(
      sender,
      recipient,
    );

    // Zapisz wiadomość w PostgreSQL
    const message = await this.messagesService.create(
      data.content,
      sender,
      conversation,
    );

    const messagePayload = {
      id: message.id,
      content: message.content,
      senderId: sender.id,
      senderEmail: sender.email,
      conversationId: conversation.id,
      createdAt: message.createdAt,
    };

    // Wyślij do odbiorcy jeśli jest online
    const recipientSocketId = this.onlineUsers.get(recipient.id);
    if (recipientSocketId) {
      this.server.to(recipientSocketId).emit('newMessage', messagePayload);
    }

    // Potwierdzenie dla nadawcy
    client.emit('messageSent', messagePayload);
  }

  // Rozpocznij konwersację po emailu — frontend wysyła email drugiego użytkownika
  @SubscribeMessage('startConversation')
  async handleStartConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { recipientEmail: string },
  ) {
    const senderId: number = client.data.user?.id;
    if (!senderId) return;

    const sender = await this.usersService.findById(senderId);
    const recipient = await this.usersService.findByEmail(data.recipientEmail);

    if (!sender || !recipient) {
      client.emit('error', { message: 'User not found' });
      return;
    }

    if (sender.id === recipient.id) {
      client.emit('error', { message: 'Cannot chat with yourself' });
      return;
    }

    const conversation = await this.conversationsService.findOrCreate(
      sender,
      recipient,
    );

    // Odśwież listę konwersacji dla nadawcy
    const conversations = await this.conversationsService.findByUser(senderId);
    const mapped = conversations.map((c) => ({
      id: c.id,
      userOne: { id: c.userOne.id, email: c.userOne.email },
      userTwo: { id: c.userTwo.id, email: c.userTwo.email },
      createdAt: c.createdAt,
    }));
    client.emit('conversationsList', mapped);

    // Automatycznie otwórz nową konwersację
    client.emit('openConversation', { conversationId: conversation.id });
  }

  // Pobierz historię wiadomości danej konwersacji
  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: number },
  ) {
    const messages = await this.messagesService.findByConversation(
      data.conversationId,
    );

    const mapped = messages.map((m) => ({
      id: m.id,
      content: m.content,
      senderId: m.sender.id,
      senderEmail: m.sender.email,
      conversationId: data.conversationId,
      createdAt: m.createdAt,
    }));

    client.emit('messageHistory', mapped);
  }

  // Pobierz listę konwersacji użytkownika
  @SubscribeMessage('getConversations')
  async handleGetConversations(@ConnectedSocket() client: Socket) {
    const userId: number = client.data.user?.id;
    if (!userId) return;

    const conversations =
      await this.conversationsService.findByUser(userId);

    const mapped = conversations.map((c) => ({
      id: c.id,
      userOne: { id: c.userOne.id, email: c.userOne.email },
      userTwo: { id: c.userTwo.id, email: c.userTwo.email },
      createdAt: c.createdAt,
    }));

    client.emit('conversationsList', mapped);
  }
}
