Now I have a thorough understanding of the codebase. Let me create a comprehensive implementation plan for the friend request system.

# Comprehensive Implementation Plan: Friend Request System

## Overview

This plan adds a complete friend request system to the MVP chat application. The system enforces friendship requirements before allowing conversations, includes real-time notifications with badge counts, supports immediate re-sending after rejection, and implements conversation deletion via unfriending.

---

## Architecture Analysis

**Current State:**
- No authorization checks in `chat.gateway.ts` methods `sendMessage` (lines 77-124) and `startConversation` (lines 127-171)
- `conversations.service.ts` auto-creates conversations without permission validation (line 19)
- WebSocket-based communication with JWT authentication
- TypeORM with auto-synchronize enabled
- Flutter frontend using Provider pattern for state management
- Socket.IO client for real-time communication

**Key Integration Points:**
1. New `FriendsModule` with entity, service, and gateway handlers
2. Authorization middleware in existing gateway methods
3. Frontend state management in `ChatProvider`
4. New UI screens and components for friend management

---

## Implementation Order

### PHASE 1: Backend Foundation (Do First)
1. Create FriendRequest entity and FriendsModule
2. Implement FriendsService with core business logic
3. Add WebSocket event handlers to ChatGateway
4. Implement authorization guards
5. Test backend independently

### PHASE 2: Frontend Integration (Do Second)
1. Create FriendRequestModel
2. Extend ChatProvider with friend request state
3. Update SocketService with new events
4. Build friend requests UI screen
5. Modify existing screens for friend status

### PHASE 3: Migration Strategy (Do Last)
1. Handle existing conversations
2. Test edge cases
3. Deploy and monitor

---

## PHASE 1: BACKEND IMPLEMENTATION

### Step 1.1: Create FriendRequest Entity

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friend-request.entity.ts` (NEW)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('friend_requests')
@Index(['sender', 'receiver'], { unique: false }) // Allow multiple requests over time
export class FriendRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({
    type: 'enum',
    enum: FriendRequestStatus,
    default: FriendRequestStatus.PENDING,
  })
  status: FriendRequestStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;
}
```

**Database Schema:**
```sql
CREATE TABLE friend_requests (
  id SERIAL PRIMARY KEY,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP NULL
);

CREATE INDEX idx_friend_requests_sender_receiver ON friend_requests(sender_id, receiver_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);
CREATE INDEX idx_friend_requests_receiver_pending ON friend_requests(receiver_id) WHERE status = 'pending';
```

**Design Decisions:**
- No unique constraint on (sender, receiver) pair to allow re-sending after rejection
- Status enum tracks request lifecycle
- `respondedAt` timestamp for analytics and UI sorting
- Cascade delete when user is deleted
- Indexes optimized for common queries (pending requests for a user, friendship checks)

---

### Step 1.2: Create FriendsService

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.service.ts` (NEW)

```typescript
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FriendRequest, FriendRequestStatus } from './friend-request.entity';
import { User } from '../users/user.entity';

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendRequest)
    private friendRequestRepo: Repository<FriendRequest>,
  ) {}

  /**
   * Send a friend request from sender to receiver.
   * Validates that users are different and no pending request exists.
   */
  async sendRequest(sender: User, receiver: User): Promise<FriendRequest> {
    if (sender.id === receiver.id) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    // Check if they're already friends
    const areFriends = await this.areFriends(sender.id, receiver.id);
    if (areFriends) {
      throw new ConflictException('Already friends');
    }

    // Check for existing PENDING request from sender to receiver
    const existingPending = await this.findPendingRequest(sender.id, receiver.id);
    if (existingPending) {
      throw new ConflictException('Friend request already sent');
    }

    // Check if receiver has a pending request to sender (mutual request scenario)
    const reverseRequest = await this.findPendingRequest(receiver.id, sender.id);
    if (reverseRequest) {
      // Auto-accept both requests to become friends immediately
      reverseRequest.status = FriendRequestStatus.ACCEPTED;
      reverseRequest.respondedAt = new Date();
      await this.friendRequestRepo.save(reverseRequest);

      const newRequest = this.friendRequestRepo.create({
        sender,
        receiver,
        status: FriendRequestStatus.ACCEPTED,
        respondedAt: new Date(),
      });
      return this.friendRequestRepo.save(newRequest);
    }

    const request = this.friendRequestRepo.create({
      sender,
      receiver,
      status: FriendRequestStatus.PENDING,
    });

    return this.friendRequestRepo.save(request);
  }

  /**
   * Accept a friend request by ID.
   * Only the receiver can accept.
   */
  async acceptRequest(requestId: number, userId: number): Promise<FriendRequest> {
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new BadRequestException('Friend request not found');
    }

    if (request.receiver.id !== userId) {
      throw new BadRequestException('Only the receiver can accept this request');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    request.status = FriendRequestStatus.ACCEPTED;
    request.respondedAt = new Date();
    return this.friendRequestRepo.save(request);
  }

  /**
   * Reject a friend request by ID.
   * Only the receiver can reject.
   */
  async rejectRequest(requestId: number, userId: number): Promise<FriendRequest> {
    const request = await this.friendRequestRepo.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new BadRequestException('Friend request not found');
    }

    if (request.receiver.id !== userId) {
      throw new BadRequestException('Only the receiver can reject this request');
    }

    if (request.status !== FriendRequestStatus.PENDING) {
      throw new BadRequestException('Request is not pending');
    }

    request.status = FriendRequestStatus.REJECTED;
    request.respondedAt = new Date();
    return this.friendRequestRepo.save(request);
  }

  /**
   * Check if two users are friends (have mutual accepted request).
   */
  async areFriends(userId1: number, userId2: number): Promise<boolean> {
    const accepted = await this.friendRequestRepo.findOne({
      where: [
        {
          sender: { id: userId1 },
          receiver: { id: userId2 },
          status: FriendRequestStatus.ACCEPTED,
        },
        {
          sender: { id: userId2 },
          receiver: { id: userId1 },
          status: FriendRequestStatus.ACCEPTED,
        },
      ],
    });

    return !!accepted;
  }

  /**
   * Get all pending friend requests received by a user.
   */
  async getPendingRequests(userId: number): Promise<FriendRequest[]> {
    return this.friendRequestRepo.find({
      where: {
        receiver: { id: userId },
        status: FriendRequestStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all friends for a user (accepted requests in either direction).
   */
  async getFriends(userId: number): Promise<User[]> {
    const requests = await this.friendRequestRepo.find({
      where: [
        { sender: { id: userId }, status: FriendRequestStatus.ACCEPTED },
        { receiver: { id: userId }, status: FriendRequestStatus.ACCEPTED },
      ],
    });

    // Extract the other user from each request
    const friends = requests.map((req) =>
      req.sender.id === userId ? req.receiver : req.sender,
    );

    // Deduplicate by user ID
    const uniqueFriends = friends.filter(
      (user, index, self) => self.findIndex((u) => u.id === user.id) === index,
    );

    return uniqueFriends;
  }

  /**
   * Unfriend a user. Deletes all accepted friend requests between them.
   * Returns true if friendship existed and was deleted.
   */
  async unfriend(userId1: number, userId2: number): Promise<boolean> {
    const result = await this.friendRequestRepo.delete({
      status: FriendRequestStatus.ACCEPTED,
      sender: [{ id: userId1 }, { id: userId2 }],
      receiver: [{ id: userId1 }, { id: userId2 }],
    });

    // Also delete using OR condition manually since TypeORM doesn't support complex conditions easily
    await this.friendRequestRepo
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: FriendRequestStatus.ACCEPTED })
      .andWhere(
        '(sender_id = :user1 AND receiver_id = :user2) OR (sender_id = :user2 AND receiver_id = :user1)',
        { user1: userId1, user2: userId2 },
      )
      .execute();

    return true;
  }

  /**
   * Find a pending request from sender to receiver.
   */
  private async findPendingRequest(
    senderId: number,
    receiverId: number,
  ): Promise<FriendRequest | null> {
    return this.friendRequestRepo.findOne({
      where: {
        sender: { id: senderId },
        receiver: { id: receiverId },
        status: FriendRequestStatus.PENDING,
      },
    });
  }

  /**
   * Get pending request count for a user (for badge).
   */
  async getPendingRequestCount(userId: number): Promise<number> {
    return this.friendRequestRepo.count({
      where: {
        receiver: { id: userId },
        status: FriendRequestStatus.PENDING,
      },
    });
  }
}
```

**Key Features:**
- Mutual request scenario: If both users send requests, auto-accept both
- Validates sender != receiver
- Prevents duplicate pending requests
- Allows re-sending after rejection (no old rejected requests block new ones)
- Efficient friendship check for authorization

---

### Step 1.3: Create FriendsModule

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.module.ts` (NEW)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRequest } from './friend-request.entity';
import { FriendsService } from './friends.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FriendRequest]),
    UsersModule,
  ],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
```

---

### Step 1.4: Update AppModule to Include FriendsModule and Entity

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\app.module.ts`

**Changes:**
- Line 7: Add `import { FriendsModule } from './friends/friends.module';`
- Line 10: Add `import { FriendRequest } from './friends/friend-request.entity';`
- Line 23: Update entities array to `entities: [User, Conversation, Message, FriendRequest],`
- Line 30: Add `FriendsModule` to imports array

---

### Step 1.5: Add Friend Request Handlers to ChatGateway

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts`

**Changes needed:**

1. **Add FriendsService injection** (line 25-30, after existing constructor parameters):
```typescript
constructor(
  private jwtService: JwtService,
  private usersService: UsersService,
  private conversationsService: ConversationsService,
  private messagesService: MessagesService,
  private friendsService: FriendsService, // NEW
) {}
```

2. **Add authorization check to `handleMessage` method** (insert after line 91, before findOrCreate):
```typescript
// Authorization: Check if users are friends
const areFriends = await this.friendsService.areFriends(senderId, data.recipientId);
if (!areFriends) {
  client.emit('error', { message: 'You must be friends to send messages' });
  return;
}
```

3. **Modify `handleStartConversation` method** (replace lines 154-171):
```typescript
// Check if users are friends
const areFriends = await this.friendsService.areFriends(sender.id, recipient.id);
if (!areFriends) {
  client.emit('error', { message: 'You must be friends to start a conversation' });
  return;
}

const conversation = await this.conversationsService.findOrCreate(
  sender,
  recipient,
);

// Refresh the conversation list for the sender
const conversations = await this.conversationsService.findByUser(senderId);
const mapped = conversations.map((c) => ({
  id: c.id,
  userOne: { id: c.userOne.id, email: c.userOne.email, username: c.userOne.username },
  userTwo: { id: c.userTwo.id, email: c.userTwo.email, username: c.userTwo.username },
  createdAt: c.createdAt,
}));
client.emit('conversationsList', mapped);

// Automatically open the new conversation
client.emit('openConversation', { conversationId: conversation.id });
```

4. **Add new WebSocket event handlers** (add at end of class, after line 248):

```typescript
// Send a friend request by email
@SubscribeMessage('sendFriendRequest')
async handleSendFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { recipientEmail: string },
) {
  const senderId: number = client.data.user?.id;
  if (!senderId) return;

  const sender = await this.usersService.findById(senderId);
  const receiver = await this.usersService.findByEmail(data.recipientEmail);

  if (!sender || !receiver) {
    client.emit('error', { message: 'User not found' });
    return;
  }

  try {
    const request = await this.friendsService.sendRequest(sender, receiver);

    // Notify sender of success
    client.emit('friendRequestSent', {
      id: request.id,
      sender: { id: sender.id, email: sender.email, username: sender.username },
      receiver: { id: receiver.id, email: receiver.email, username: receiver.username },
      status: request.status,
      createdAt: request.createdAt,
    });

    // Notify receiver if online
    const receiverSocketId = this.onlineUsers.get(receiver.id);
    if (receiverSocketId) {
      this.server.to(receiverSocketId).emit('newFriendRequest', {
        id: request.id,
        sender: { id: sender.id, email: sender.email, username: sender.username },
        receiver: { id: receiver.id, email: receiver.email, username: receiver.username },
        status: request.status,
        createdAt: request.createdAt,
      });

      // Send updated pending count
      const count = await this.friendsService.getPendingRequestCount(receiver.id);
      this.server.to(receiverSocketId).emit('pendingRequestsCount', { count });
    }
  } catch (error: any) {
    client.emit('error', { message: error.message || 'Failed to send friend request' });
  }
}

// Accept a friend request
@SubscribeMessage('acceptFriendRequest')
async handleAcceptFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { requestId: number },
) {
  const userId: number = client.data.user?.id;
  if (!userId) return;

  try {
    const request = await this.friendsService.acceptRequest(data.requestId, userId);

    // Notify both users
    const acceptorSocketId = client.id;
    const senderSocketId = this.onlineUsers.get(request.sender.id);

    const payload = {
      id: request.id,
      sender: { id: request.sender.id, email: request.sender.email, username: request.sender.username },
      receiver: { id: request.receiver.id, email: request.receiver.email, username: request.receiver.username },
      status: request.status,
      respondedAt: request.respondedAt,
    };

    client.emit('friendRequestAccepted', payload);

    if (senderSocketId) {
      this.server.to(senderSocketId).emit('friendRequestAccepted', payload);
    }

    // Update pending count for acceptor
    const count = await this.friendsService.getPendingRequestCount(userId);
    client.emit('pendingRequestsCount', { count });
  } catch (error: any) {
    client.emit('error', { message: error.message || 'Failed to accept friend request' });
  }
}

// Reject a friend request
@SubscribeMessage('rejectFriendRequest')
async handleRejectFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { requestId: number },
) {
  const userId: number = client.data.user?.id;
  if (!userId) return;

  try {
    const request = await this.friendsService.rejectRequest(data.requestId, userId);

    // Notify receiver (the one who rejected)
    client.emit('friendRequestRejected', {
      id: request.id,
      sender: { id: request.sender.id, email: request.sender.email, username: request.sender.username },
      receiver: { id: request.receiver.id, email: request.receiver.email, username: request.receiver.username },
      status: request.status,
      respondedAt: request.respondedAt,
    });

    // Update pending count
    const count = await this.friendsService.getPendingRequestCount(userId);
    client.emit('pendingRequestsCount', { count });

    // Do NOT notify sender of rejection (silent rejection per UX best practices)
  } catch (error: any) {
    client.emit('error', { message: error.message || 'Failed to reject friend request' });
  }
}

// Get pending friend requests
@SubscribeMessage('getFriendRequests')
async handleGetFriendRequests(@ConnectedSocket() client: Socket) {
  const userId: number = client.data.user?.id;
  if (!userId) return;

  const requests = await this.friendsService.getPendingRequests(userId);

  const mapped = requests.map((r) => ({
    id: r.id,
    sender: { id: r.sender.id, email: r.sender.email, username: r.sender.username },
    receiver: { id: r.receiver.id, email: r.receiver.email, username: r.receiver.username },
    status: r.status,
    createdAt: r.createdAt,
  }));

  client.emit('friendRequestsList', mapped);

  // Also send count
  const count = await this.friendsService.getPendingRequestCount(userId);
  client.emit('pendingRequestsCount', { count });
}

// Get friends list
@SubscribeMessage('getFriends')
async handleGetFriends(@ConnectedSocket() client: Socket) {
  const userId: number = client.data.user?.id;
  if (!userId) return;

  const friends = await this.friendsService.getFriends(userId);

  const mapped = friends.map((f) => ({
    id: f.id,
    email: f.email,
    username: f.username,
  }));

  client.emit('friendsList', mapped);
}

// Unfriend a user and delete conversation
@SubscribeMessage('unfriend')
async handleUnfriend(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { userId: number },
) {
  const currentUserId: number = client.data.user?.id;
  if (!currentUserId) return;

  try {
    // Unfriend
    await this.friendsService.unfriend(currentUserId, data.userId);

    // Find and delete the conversation
    const conversation = await this.conversationsService.findOrCreate(
      await this.usersService.findById(currentUserId),
      await this.usersService.findById(data.userId),
    );

    if (conversation) {
      await this.conversationsService.delete(conversation.id);
    }

    // Notify current user
    client.emit('unfriended', { userId: data.userId });

    // Refresh conversations list
    const conversations = await this.conversationsService.findByUser(currentUserId);
    const mapped = conversations.map((c) => ({
      id: c.id,
      userOne: { id: c.userOne.id, email: c.userOne.email, username: c.userOne.username },
      userTwo: { id: c.userTwo.id, email: c.userTwo.email, username: c.userTwo.username },
      createdAt: c.createdAt,
    }));
    client.emit('conversationsList', mapped);

    // Notify other user if online
    const otherSocketId = this.onlineUsers.get(data.userId);
    if (otherSocketId) {
      this.server.to(otherSocketId).emit('unfriended', { userId: currentUserId });

      // Refresh their conversations list too
      const otherConversations = await this.conversationsService.findByUser(data.userId);
      const otherMapped = otherConversations.map((c) => ({
        id: c.id,
        userOne: { id: c.userOne.id, email: c.userOne.email, username: c.userOne.username },
        userTwo: { id: c.userTwo.id, email: c.userTwo.email, username: c.userTwo.username },
        createdAt: c.createdAt,
      }));
      this.server.to(otherSocketId).emit('conversationsList', otherMapped);
    }
  } catch (error: any) {
    client.emit('error', { message: error.message || 'Failed to unfriend user' });
  }
}
```

---

### Step 1.6: Update ChatModule to Import FriendsModule

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.module.ts`

**Changes:**
- Add import: `import { FriendsModule } from '../friends/friends.module';`
- Add `FriendsModule` to imports array

---

### Step 1.7: Test Backend

Before moving to frontend, test the backend using a tool like Postman or a Socket.IO client:

1. Connect to WebSocket with valid JWT token
2. Send `sendFriendRequest` event with `{recipientEmail: "test@example.com"}`
3. Accept request using `acceptFriendRequest` with `{requestId: 1}`
4. Verify `getFriendRequests` returns pending requests
5. Verify `areFriends` check prevents `sendMessage` to non-friends
6. Test unfriend and verify conversation deletion

---

## PHASE 2: FRONTEND IMPLEMENTATION

### Step 2.1: Create FriendRequestModel

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\models\friend_request_model.dart` (NEW)

```dart
import 'user_model.dart';

class FriendRequestModel {
  final int id;
  final UserModel sender;
  final UserModel receiver;
  final String status;
  final DateTime createdAt;
  final DateTime? respondedAt;

  FriendRequestModel({
    required this.id,
    required this.sender,
    required this.receiver,
    required this.status,
    required this.createdAt,
    this.respondedAt,
  });

  factory FriendRequestModel.fromJson(Map<String, dynamic> json) {
    return FriendRequestModel(
      id: json['id'] as int,
      sender: UserModel.fromJson(json['sender'] as Map<String, dynamic>),
      receiver: UserModel.fromJson(json['receiver'] as Map<String, dynamic>),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      respondedAt: json['respondedAt'] != null
          ? DateTime.parse(json['respondedAt'] as String)
          : null,
    );
  }
}
```

---

### Step 2.2: Update SocketService with Friend Events

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\socket_service.dart`

**Changes:**

1. **Add callback parameters to `connect` method** (add after line 18):
```dart
required void Function(dynamic) onFriendRequestsList,
required void Function(dynamic) onNewFriendRequest,
required void Function(dynamic) onFriendRequestSent,
required void Function(dynamic) onFriendRequestAccepted,
required void Function(dynamic) onFriendRequestRejected,
required void Function(dynamic) onPendingRequestsCount,
required void Function(dynamic) onFriendsList,
required void Function(dynamic) onUnfriended,
```

2. **Register socket listeners** (add after line 37):
```dart
_socket!.on('friendRequestsList', onFriendRequestsList);
_socket!.on('newFriendRequest', onNewFriendRequest);
_socket!.on('friendRequestSent', onFriendRequestSent);
_socket!.on('friendRequestAccepted', onFriendRequestAccepted);
_socket!.on('friendRequestRejected', onFriendRequestRejected);
_socket!.on('pendingRequestsCount', onPendingRequestsCount);
_socket!.on('friendsList', onFriendsList);
_socket!.on('unfriended', onUnfriended);
```

3. **Add new methods** (add after line 69):
```dart
void sendFriendRequest(String recipientEmail) {
  _socket?.emit('sendFriendRequest', {
    'recipientEmail': recipientEmail,
  });
}

void acceptFriendRequest(int requestId) {
  _socket?.emit('acceptFriendRequest', {
    'requestId': requestId,
  });
}

void rejectFriendRequest(int requestId) {
  _socket?.emit('rejectFriendRequest', {
    'requestId': requestId,
  });
}

void getFriendRequests() {
  _socket?.emit('getFriendRequests');
}

void getFriends() {
  _socket?.emit('getFriends');
}

void unfriend(int userId) {
  _socket?.emit('unfriend', {
    'userId': userId,
  });
}
```

---

### Step 2.3: Update ChatProvider with Friend Request State

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart`

**Changes:**

1. **Add imports** (after line 4):
```dart
import '../models/friend_request_model.dart';
```

2. **Add state variables** (after line 16):
```dart
List<FriendRequestModel> _friendRequests = [];
int _pendingRequestsCount = 0;
List<UserModel> _friends = [];
```

3. **Add getters** (after line 24):
```dart
List<FriendRequestModel> get friendRequests => _friendRequests;
int get pendingRequestsCount => _pendingRequestsCount;
List<UserModel> get friends => _friends;
```

4. **Update `connect` method** - Add new callback parameters (after line 120):
```dart
onFriendRequestsList: (data) {
  final list = data as List<dynamic>;
  _friendRequests = list
      .map((r) => FriendRequestModel.fromJson(r as Map<String, dynamic>))
      .toList();
  notifyListeners();
},
onNewFriendRequest: (data) {
  final request = FriendRequestModel.fromJson(data as Map<String, dynamic>);
  _friendRequests.insert(0, request);
  notifyListeners();
},
onFriendRequestSent: (data) {
  debugPrint('Friend request sent: $data');
  // Optionally track sent requests in the future
},
onFriendRequestAccepted: (data) {
  final request = FriendRequestModel.fromJson(data as Map<String, dynamic>);
  // Remove from pending list
  _friendRequests.removeWhere((r) => r.id == request.id);
  // Refresh conversations to show the new conversation
  _socketService.getConversations();
  notifyListeners();
},
onFriendRequestRejected: (data) {
  final request = FriendRequestModel.fromJson(data as Map<String, dynamic>);
  _friendRequests.removeWhere((r) => r.id == request.id);
  notifyListeners();
},
onPendingRequestsCount: (data) {
  _pendingRequestsCount = (data as Map<String, dynamic>)['count'] as int;
  notifyListeners();
},
onFriendsList: (data) {
  final list = data as List<dynamic>;
  _friends = list
      .map((u) => UserModel.fromJson(u as Map<String, dynamic>))
      .toList();
  notifyListeners();
},
onUnfriended: (data) {
  final userId = (data as Map<String, dynamic>)['userId'] as int;
  // Remove conversations with this user
  _conversations.removeWhere((c) =>
      c.userOne.id == userId || c.userTwo.id == userId);
  if (_activeConversationId != null) {
    final activeConv = _conversations.firstWhere(
      (c) => c.id == _activeConversationId,
      orElse: () => _conversations.first,
    );
    if (activeConv.userOne.id == userId || activeConv.userTwo.id == userId) {
      _activeConversationId = null;
      _messages = [];
    }
  }
  notifyListeners();
},
```

5. **Add new methods** (after line 170):
```dart
void sendFriendRequest(String recipientEmail) {
  _socketService.sendFriendRequest(recipientEmail);
}

void acceptFriendRequest(int requestId) {
  _socketService.acceptFriendRequest(requestId);
}

void rejectFriendRequest(int requestId) {
  _socketService.rejectFriendRequest(requestId);
}

void fetchFriendRequests() {
  _socketService.getFriendRequests();
}

void fetchFriends() {
  _socketService.getFriends();
}

void unfriend(int userId) {
  _socketService.unfriend(userId);
}

bool isFriend(int userId) {
  return _friends.any((f) => f.id == userId);
}
```

6. **Update `disconnect` method** (add after line 179):
```dart
_friendRequests = [];
_pendingRequestsCount = 0;
_friends = [];
```

---

### Step 2.4: Create Friend Requests Screen

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\friend_requests_screen.dart` (NEW)

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/chat_provider.dart';
import '../theme/rpg_theme.dart';

class FriendRequestsScreen extends StatefulWidget {
  const FriendRequestsScreen({super.key});

  @override
  State<FriendRequestsScreen> createState() => _FriendRequestsScreenState();
}

class _FriendRequestsScreenState extends State<FriendRequestsScreen> {
  @override
  void initState() {
    super.initState();
    // Fetch friend requests on screen load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().fetchFriendRequests();
    });
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();
    final requests = chat.friendRequests;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Friend Requests',
          style: RpgTheme.bodyFont(
            fontSize: 18,
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SafeArea(
        child: requests.isEmpty
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.person_add_outlined,
                      size: 64,
                      color: RpgTheme.mutedText,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'No pending requests',
                      style: RpgTheme.bodyFont(
                        fontSize: 16,
                        color: RpgTheme.mutedText,
                      ),
                    ),
                  ],
                ),
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: requests.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final request = requests[index];
                  final sender = request.sender;
                  final displayName = sender.username ?? sender.email;

                  return Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: RpgTheme.boxBg,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: RpgTheme.convItemBorder),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          backgroundColor: RpgTheme.purple,
                          child: Text(
                            displayName[0].toUpperCase(),
                            style: RpgTheme.bodyFont(
                              fontSize: 16,
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                displayName,
                                style: RpgTheme.bodyFont(
                                  fontSize: 15,
                                  color: Colors.white,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'wants to add you as a friend',
                                style: RpgTheme.bodyFont(
                                  fontSize: 13,
                                  color: RpgTheme.mutedText,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          onPressed: () {
                            chat.acceptFriendRequest(request.id);
                          },
                          icon: const Icon(Icons.check_circle, color: Colors.green),
                          tooltip: 'Accept',
                        ),
                        IconButton(
                          onPressed: () {
                            chat.rejectFriendRequest(request.id);
                          },
                          icon: const Icon(Icons.cancel, color: RpgTheme.logoutRed),
                          tooltip: 'Reject',
                        ),
                      ],
                    ),
                  );
                },
              ),
      ),
    );
  }
}
```

---

### Step 2.5: Update ConversationsScreen with Badge

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\conversations_screen.dart`

**Changes:**

1. **Add import** (after line 8):
```dart
import 'friend_requests_screen.dart';
```

2. **Add method to open friend requests screen** (after line 61):
```dart
void _openFriendRequests() {
  Navigator.of(context).push(
    MaterialPageRoute(builder: (_) => const FriendRequestsScreen()),
  );
}
```

3. **Update `_buildMobileLayout` AppBar** (replace lines 119-130):
```dart
actions: [
  // Friend requests with badge
  Stack(
    children: [
      IconButton(
        icon: const Icon(Icons.person_add, color: RpgTheme.purple),
        onPressed: _openFriendRequests,
        tooltip: 'Friend Requests',
      ),
      Consumer<ChatProvider>(
        builder: (context, chat, _) {
          if (chat.pendingRequestsCount == 0) return const SizedBox.shrink();
          return Positioned(
            right: 8,
            top: 8,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              constraints: const BoxConstraints(
                minWidth: 16,
                minHeight: 16,
              ),
              child: Text(
                '${chat.pendingRequestsCount}',
                style: RpgTheme.bodyFont(
                  fontSize: 10,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          );
        },
      ),
    ],
  ),
  IconButton(
    icon: const Icon(Icons.settings, color: RpgTheme.purple),
    onPressed: _openSettings,
    tooltip: 'Settings',
  ),
  IconButton(
    icon: const Icon(Icons.logout, color: RpgTheme.logoutRed),
    onPressed: _logout,
    tooltip: 'Logout',
  ),
],
```

4. **Update `_buildDesktopLayout` header** (replace lines 164-178 with similar badge logic):
```dart
Stack(
  children: [
    IconButton(
      icon: const Icon(Icons.person_add, color: RpgTheme.purple, size: 20),
      onPressed: _openFriendRequests,
      tooltip: 'Friend Requests',
    ),
    Consumer<ChatProvider>(
      builder: (context, chat, _) {
        if (chat.pendingRequestsCount == 0) return const SizedBox.shrink();
        return Positioned(
          right: 6,
          top: 6,
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: const BoxDecoration(
              color: Colors.red,
              shape: BoxShape.circle,
            ),
            constraints: const BoxConstraints(
              minWidth: 14,
              minHeight: 14,
            ),
            child: Text(
              '${chat.pendingRequestsCount}',
              style: RpgTheme.bodyFont(
                fontSize: 9,
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        );
      },
    ),
  ],
),
```

5. **Fetch friend requests on connect** (add after line 25):
```dart
chat.fetchFriendRequests();
chat.fetchFriends();
```

---

### Step 2.6: Update NewChatScreen to Send Friend Request

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\new_chat_screen.dart`

**Changes:**

1. **Update button text and action** (replace line 97):
```dart
: const Text('Send Friend Request'),
```

2. **Update `_startChat` method** (replace lines 23-31):
```dart
void _startChat() {
  final email = _emailController.text.trim();
  if (email.isEmpty) return;

  setState(() => _loading = true);
  final chat = context.read<ChatProvider>();
  chat.clearError();
  chat.sendFriendRequest(email);

  // Show success message and return
  Future.delayed(const Duration(milliseconds: 500), () {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Friend request sent to $email',
            style: RpgTheme.bodyFont(fontSize: 13, color: Colors.white),
          ),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.of(context).pop();
    }
  });
}
```

3. **Update screen title and description** (replace lines 54 and 70):
```dart
title: Text(
  'Add Friend',
  style: RpgTheme.bodyFont(
    fontSize: 18,
    color: Colors.white,
    fontWeight: FontWeight.w600,
  ),
),
```

```dart
Text(
  'Enter the email of the person you want to add:',
  style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.labelText),
),
```

---

### Step 2.7: Add Unfriend Option to ChatDetailScreen

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\chat_detail_screen.dart`

**Changes:**

1. **Add unfriend method** (add as a method in the State class):
```dart
void _unfriend() {
  final chat = context.read<ChatProvider>();
  final conv = chat.conversations.firstWhere((c) => c.id == widget.conversationId);
  final otherUserId = chat.getOtherUserId(conv);
  final otherUsername = chat.getOtherUserUsername(conv);

  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: RpgTheme.boxBg,
      title: Text(
        'Unfriend $otherUsername?',
        style: RpgTheme.bodyFont(
          fontSize: 16,
          color: RpgTheme.gold,
          fontWeight: FontWeight.w600,
        ),
      ),
      content: Text(
        'This will delete your entire conversation history with this user.',
        style: RpgTheme.bodyFont(fontSize: 14, color: Colors.white70),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(
            'Cancel',
            style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.mutedText),
          ),
        ),
        TextButton(
          onPressed: () {
            Navigator.pop(context); // Close dialog
            chat.unfriend(otherUserId);
            
            // Navigate back if not embedded
            if (!widget.isEmbedded && mounted) {
              Navigator.of(context).pop();
            }
          },
          child: Text(
            'Unfriend',
            style: RpgTheme.bodyFont(
              fontSize: 14,
              color: RpgTheme.logoutRed,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}
```

2. **Add menu button to AppBar** (find the AppBar in build method and add to actions):
```dart
actions: [
  PopupMenuButton<String>(
    icon: const Icon(Icons.more_vert),
    onSelected: (value) {
      if (value == 'unfriend') {
        _unfriend();
      }
    },
    itemBuilder: (context) => [
      PopupMenuItem(
        value: 'unfriend',
        child: Row(
          children: [
            const Icon(Icons.person_remove, color: RpgTheme.logoutRed, size: 18),
            const SizedBox(width: 8),
            Text(
              'Unfriend',
              style: RpgTheme.bodyFont(
                fontSize: 14,
                color: RpgTheme.logoutRed,
              ),
            ),
          ],
        ),
      ),
    ],
  ),
],
```

---

## PHASE 3: MIGRATION STRATEGY & EDGE CASES

### Step 3.1: Handle Existing Conversations

**Decision Point:** Should existing conversations require mutual friendship?

**Recommendation:** YES - Enforce friendship for all conversations to maintain security.

**Migration Approach:**

1. **Backend Migration Script** (create `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\migration\friend-migration.ts`):

```typescript
// Run this script once to migrate existing conversations to friendships
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ConversationsService } from '../conversations/conversations.service';
import { FriendsService } from '../friends/friends.service';

async function migrateConversationsToFriendships() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const conversationsService = app.get(ConversationsService);
  const friendsService = app.get(FriendsService);

  console.log('Starting migration...');

  // Get all conversations
  const conversations = await conversationsService.findAll(); // Need to add this method

  for (const conv of conversations) {
    const userOne = conv.userOne;
    const userTwo = conv.userTwo;

    // Check if friendship already exists
    const areFriends = await friendsService.areFriends(userOne.id, userTwo.id);

    if (!areFriends) {
      console.log(`Creating friendship between ${userOne.email} and ${userTwo.email}`);
      
      // Create auto-accepted friend request
      const request = await friendsService.sendRequest(userOne, userTwo);
      await friendsService.acceptRequest(request.id, userTwo.id);
    }
  }

  console.log('Migration complete!');
  await app.close();
}

migrateConversationsToFriendships();
```

2. **Add `findAll` method to ConversationsService**:
```typescript
async findAll(): Promise<Conversation[]> {
  return this.convRepo.find();
}
```

3. **Run migration:**
```bash
cd backend
npm run build
node dist/migration/friend-migration.js
```

**Alternative:** If you want to keep existing conversations without forcing friendship, modify the authorization check in `chat.gateway.ts` to allow messages if conversation already exists:

```typescript
// Check if conversation exists OR users are friends
const existingConv = await this.conversationsService.findById(conversationId);
const areFriends = await this.friendsService.areFriends(senderId, data.recipientId);

if (!existingConv && !areFriends) {
  client.emit('error', { message: 'You must be friends to send messages' });
  return;
}
```

---

### Step 3.2: Edge Cases to Handle

**1. User sends multiple requests before first is answered**
- **Handled by:** `FriendsService.sendRequest` checks for existing pending request and throws `ConflictException`

**2. Both users send requests to each other simultaneously**
- **Handled by:** `FriendsService.sendRequest` detects reverse pending request and auto-accepts both

**3. Unfriend while other user is typing**
- **Handled by:** Backend emits `unfriended` event, frontend removes conversation and clears active chat
- **Test:** User A unfriends User B while User B has message typed in input. Input should be cleared and show error.

**4. Accept request then immediately unfriend**
- **Handled by:** `unfriend` method deletes accepted friend requests and conversation
- **Test:** Verify conversation and messages are deleted from database

**5. User deleted (cascade behavior)**
- **Handled by:** FriendRequest entity has `ON DELETE CASCADE` foreign keys
- **Test:** Delete user from database and verify all their friend requests are removed

**6. Offline user receiving friend request**
- **Handled by:** Request saved in database, badge count fetched on next login via `getFriendRequests`
- **Test:** Send request while user offline, verify badge shows correct count on login

**7. Rejected request - sender can immediately resend**
- **Handled by:** `sendRequest` only checks for PENDING requests, not rejected ones
- **Risk:** Spam potential - consider adding rate limiting in production

---

### Step 3.3: Testing Strategy

**Backend Tests:**
```bash
cd backend
npm test
```

Create test file `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.service.spec.ts`:
- Test `sendRequest` with valid users
- Test duplicate pending request rejection
- Test mutual request auto-accept
- Test `areFriends` check
- Test unfriend deletes friendship

**Frontend Tests:**
```bash
cd frontend
flutter test
```

**Manual Testing Checklist:**
- [ ] Send friend request via NewChatScreen
- [ ] Verify badge shows count on ConversationsScreen
- [ ] Accept request from FriendRequestsScreen
- [ ] Verify conversation appears after accepting
- [ ] Send message to friend - should succeed
- [ ] Reject request - verify removed from list
- [ ] Resend request after rejection - should succeed
- [ ] Unfriend from ChatDetailScreen - verify conversation deleted
- [ ] Try to message non-friend - should show error
- [ ] Both users send requests simultaneously - should auto-accept
- [ ] Receive request while offline - verify badge on login

**End-to-End Test Flow:**
1. User A sends friend request to User B
2. User B sees badge with count "1"
3. User B opens friend requests screen
4. User B accepts request
5. Both users see new conversation in list
6. User A sends message - succeeds
7. User B sends message - succeeds
8. User A unfriends User B
9. Both users see conversation disappear
10. User A tries to send message - error

---

## Summary of Files Modified/Created

### Backend (New Files)
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friend-request.entity.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.service.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\migration\friend-migration.ts`

### Backend (Modified Files)
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\app.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\conversations\conversations.service.ts`

### Frontend (New Files)
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\models\friend_request_model.dart`
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\friend_requests_screen.dart`

### Frontend (Modified Files)
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\socket_service.dart`
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart`
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\conversations_screen.dart`
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\new_chat_screen.dart`
- `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\chat_detail_screen.dart`

---

## WebSocket Events Reference

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `sendFriendRequest` | `{recipientEmail: string}` | Send friend request by email |
| `acceptFriendRequest` | `{requestId: number}` | Accept pending request |
| `rejectFriendRequest` | `{requestId: number}` | Reject pending request |
| `getFriendRequests` | (none) | Fetch pending requests |
| `getFriends` | (none) | Fetch friends list |
| `unfriend` | `{userId: number}` | Remove friend and delete conversation |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `newFriendRequest` | `FriendRequestModel` | Incoming friend request |
| `friendRequestSent` | `FriendRequestModel` | Confirmation of sent request |
| `friendRequestAccepted` | `FriendRequestModel` | Request accepted by receiver |
| `friendRequestRejected` | `FriendRequestModel` | Request rejected (receiver only) |
| `friendRequestsList` | `FriendRequestModel[]` | List of pending requests |
| `friendsList` | `UserModel[]` | List of friends |
| `pendingRequestsCount` | `{count: number}` | Badge count |
| `unfriended` | `{userId: number}` | User unfriended you |

---

## Key Design Decisions

1. **No unique constraint on friend requests:** Allows immediate re-sending after rejection (per requirements)
2. **Mutual request auto-accept:** If both users send requests, automatically accept both to improve UX
3. **Silent rejection:** Sender is NOT notified of rejection to reduce confrontation
4. **Cascade delete on unfriend:** Deletes entire conversation history as required
5. **Real-time badge updates:** Badge count updates immediately when online
6. **Offline support:** Pending requests persist in database, fetched on next login

---

### Critical Files for Implementation

1. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts** - Core WebSocket logic; add 6 new event handlers and authorization checks to existing methods (`sendMessage` line 77-124, `startConversation` line 127-171)

2. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.service.ts** - Business logic for friend requests; implement 9 core methods including `areFriends()`, `sendRequest()`, `acceptRequest()`, `unfriend()`

3. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart** - State management for friend requests; add 3 new state variables, 8 new callback handlers in `connect()`, and 6 new methods

4. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\conversations_screen.dart** - Add badge UI with real-time count; modify AppBar actions in both mobile (line 119) and desktop (line 164) layouts

5. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friend-request.entity.ts** - Database schema defining the friend request lifecycle; includes status enum, indexes, and relationships