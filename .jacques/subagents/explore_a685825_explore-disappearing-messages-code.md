# Explore: Explore disappearing messages code

> Session: `ebcaa403-d299-4ce0-b47e-7dd829bd61dd`
> Date: 2026-02-06
> Tokens: ~56,733

---

Excellent! Now I have a complete picture. Let me create a comprehensive summary document of my findings:

## Disappearing Messages Feature - Complete Data Flow Analysis

I have completed a thorough exploration of the disappearing messages feature across the entire codebase. Here is the comprehensive overview:

---

### 1. BACKEND DATA MODEL

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\messages\message.entity.ts`

The `Message` entity includes three fields essential for disappearing messages:

```typescript
@Column({ type: 'timestamp', nullable: true })
expiresAt: Date | null;

@Column({
  type: 'enum',
  enum: MessageType,
  default: MessageType.TEXT,
})
messageType: MessageType;

@Column({
  type: 'enum',
  enum: MessageDeliveryStatus,
  default: MessageDeliveryStatus.SENT,
})
deliveryStatus: MessageDeliveryStatus;
```

The entity also tracks message delivery status (SENDING, SENT, DELIVERED, READ) and message types (TEXT, PING, IMAGE, DRAWING).

---

### 2. BACKEND MESSAGE CREATION AND EXPIRATION FLOW

**Files:** 
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\messages\messages.service.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\services\chat-message.service.ts`

#### Message Creation with Expiration:

In `chat-message.service.ts` `handleSendMessage()` (lines 23-99):

1. Client sends message with optional `expiresIn` (seconds)
2. Backend calculates `expiresAt`:
   ```typescript
   const expiresAt = data.expiresIn
     ? new Date(Date.now() + data.expiresIn * 1000)
     : null;
   ```
3. Message is created via `messagesService.create()` with `expiresAt`
4. Server emits back `messageSent` with full payload including:
   - `expiresAt` (timestamp or null)
   - `deliveryStatus` (SENT)
   - `messageType` (TEXT by default)
   - `tempId` (for optimistic UI matching)

#### Message Retrieval:

In `handleGetMessages()` (lines 101-131):
- Messages are fetched via `messagesService.findByConversation()` with pagination (default 50 messages)
- All fields including `expiresAt` are mapped into response payload

---

### 3. BACKEND SCHEDULED CLEANUP

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\messages\message-cleanup.service.ts`

NestJS cron job runs **every minute**:

```typescript
@Cron(CronExpression.EVERY_MINUTE)
async deleteExpiredMessages() {
  const now = new Date();
  const expiredMessages = await this.messagesRepo.find({
    where: {
      expiresAt: LessThan(now),
    },
  });
  if (expiredMessages.length > 0) {
    await this.messagesRepo.remove(expiredMessages);
    this.logger.log(`Deleted ${expiredMessages.length} expired messages`);
  }
}
```

This is registered in `messages.module.ts` as a provider and enabled via `ScheduleModule.forRoot()` in `app.module.ts`.

**CRITICAL:** Expired messages are **deleted from the database every minute**. The frontend must handle this independently.

---

### 4. WEBSOCKET EVENT MAP

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts`

The gateway subscriptions relevant to disappearing messages:

```
@SubscribeMessage('sendMessage') -> handleSendMessage
  Emits: 'messageSent' (to sender), 'newMessage' (to recipient)
  Includes: expiresAt, deliveryStatus, messageType

@SubscribeMessage('messageDelivered')
  Updates: delivery status SENT -> DELIVERED
  Emits: 'messageDelivered' back to sender

@SubscribeMessage('markConversationRead')
  Updates: delivery status -> READ
  Emits: 'messageDelivered' with status READ to sender
```

---

### 5. FRONTEND MESSAGE MODEL

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\models\message_model.dart`

```dart
class MessageModel {
  final int id;
  final String content;
  final DateTime expiresAt?;
  final MessageDeliveryStatus deliveryStatus;
  final MessageType messageType;
  final String? mediaUrl;
  final String? tempId;
  
  static MessageDeliveryStatus parseDeliveryStatus(String? status) {
    // Parses 'SENDING', 'SENT', 'DELIVERED', 'READ' from backend
  }
  
  MessageModel copyWith({
    MessageDeliveryStatus? deliveryStatus,
    DateTime? expiresAt,
  }) { /* ... */ }
}
```

The model includes a **public static method** `parseDeliveryStatus()` for parsing delivery status strings from backend.

---

### 6. FRONTEND CHAT PROVIDER

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart`

#### Disappearing Timer State Management (lines 32, 48-59):

```dart
final Map<int, int?> _conversationTimers = {}; // conversationId -> seconds

int? get conversationDisappearingTimer {
  if (_activeConversationId == null) return null;
  return _conversationTimers[_activeConversationId];
}

void setConversationDisappearingTimer(int? seconds) {
  if (_activeConversationId == null) return;
  _conversationTimers[_activeConversationId!] = seconds;
  notifyListeners();
}
```

Each conversation can have its own disappearing timer setting (30s, 1m, 5m, 1h, 1d, or off).

#### Sending Messages with Expiration (lines 302-343):

```dart
void sendMessage(String content, {int? expiresIn}) {
  // Use conversation disappearing timer if expiresIn not provided
  final effectiveExpiresIn = expiresIn ?? conversationDisappearingTimer;
  
  // Generate tempId for optimistic UI matching
  final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}_$_currentUserId';
  
  // Create optimistic message with SENDING status and calculated expiresAt
  final tempMessage = MessageModel(
    id: -DateTime.now().millisecondsSinceEpoch,
    deliveryStatus: MessageDeliveryStatus.sending,
    expiresAt: effectiveExpiresIn != null
        ? DateTime.now().add(Duration(seconds: effectiveExpiresIn))
        : null,
    tempId: tempId,
  );
  
  _messages.add(tempMessage);
  notifyListeners();
  
  // Send via socket
  _socketService.sendMessage(recipientId, content, 
    expiresIn: effectiveExpiresIn, tempId: tempId);
}
```

#### Handling Incoming Messages (lines 71-96):

```dart
void _handleIncomingMessage(dynamic data) {
  final msg = MessageModel.fromJson(data as Map<String, dynamic>);
  
  // Replace optimistic temp message
  if (msg.senderId == _currentUserId && msg.tempId != null) {
    final tempIndex = _messages.indexWhere((m) => m.tempId == msg.tempId);
    if (tempIndex != -1) {
      _messages.removeAt(tempIndex);
    }
  }
  
  // Add confirmed message
  if (msg.conversationId == _activeConversationId) {
    _messages.add(msg);
  }
  
  _lastMessages[msg.conversationId] = msg;
  notifyListeners();
  
  // Send delivery status to sender
  if (msg.senderId != _currentUserId) {
    _socketService.emitMessageDelivered(msg.id);
    if (msg.conversationId == _activeConversationId) {
      markConversationRead(msg.conversationId);
    }
  }
}
```

#### Handling Delivery Status Updates (lines 384-409):

```dart
void _handleMessageDelivered(dynamic data) {
  final messageId = map['messageId'] as int;
  final status = map['deliveryStatus'] as String;
  
  // Update in active messages list
  final index = _messages.indexWhere((m) => m.id == messageId);
  if (index != -1) {
    _messages[index] = _messages[index].copyWith(
      deliveryStatus: MessageModel.parseDeliveryStatus(status),
    );
  }
  
  // Update in last messages map
  if (conversationId != null && _lastMessages[conversationId]?.id == messageId) {
    _lastMessages[conversationId] = 
        _lastMessages[conversationId]!.copyWith(deliveryStatus: newStatus);
  }
}
```

---

### 7. FRONTEND SOCKET SERVICE

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\socket_service.dart`

#### Sending Message with Expiration (lines 75-92):

```dart
void sendMessage(
  int recipientId,
  String content, {
  int? expiresIn,
  String? tempId,
}) {
  final payload = {
    'recipientId': recipientId,
    'content': content,
  };
  if (expiresIn != null) {
    payload['expiresIn'] = expiresIn;
  }
  if (tempId != null) {
    payload['tempId'] = tempId;
  }
  _socket?.emit('sendMessage', payload);
}
```

#### Event Listeners (lines 49-66):

```dart
_socket!.on('messageSent', onMessageSent);
_socket!.on('newMessage', onNewMessage);
_socket!.on('messageDelivered', onMessageDelivered);
_socket!.on('newPing', onPingReceived);
```

#### Delivery and Read Status (lines 100-110):

```dart
void emitMessageDelivered(int messageId) {
  _socket?.emit('messageDelivered', {
    'messageId': messageId,
  });
}

void emitMarkConversationRead(int conversationId) {
  _socket?.emit('markConversationRead', {
    'conversationId': conversationId,
  });
}
```

---

### 8. FRONTEND UI: MESSAGE BUBBLE WITH TIMER DISPLAY

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\chat_message_bubble.dart`

#### Timer Text Calculation (lines 48-63):

```dart
String? _getTimerText() {
  if (message.expiresAt == null) return null;
  
  final now = DateTime.now();
  final remaining = message.expiresAt!.difference(now);
  
  if (remaining.isNegative) return 'Expired';
  
  if (remaining.inHours > 0) {
    return '${remaining.inHours}h';
  } else if (remaining.inMinutes > 0) {
    return '${remaining.inMinutes}m';
  } else {
    return '${remaining.inSeconds}s';
  }
}
```

**CRITICAL:** This method calculates remaining time on **every build** using `DateTime.now()`. No persistent timer state.

#### Timer Display in Message Bubble (lines 181-189):

```dart
if (_getTimerText() != null) ...[
  const SizedBox(width: 6),
  Icon(Icons.timer_outlined, size: 10, color: timeColor),
  const SizedBox(width: 2),
  Text(
    _getTimerText()!,
    style: RpgTheme.bodyFont(fontSize: 10, color: timeColor),
  ),
],
```

Timer icon (⏱️) and remaining time displayed bottom-right of message bubble.

---

### 9. FRONTEND UI: CHAT DETAIL SCREEN TIMER REFRESH

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\chat_detail_screen.dart`

#### Timer Refresh Mechanism (lines 68-75):

```dart
// Refresh every second to update countdown
_timerCountdownRefresh = Timer.periodic(
  const Duration(seconds: 1),
  (_) {
    if (mounted) setState(() {});
  },
);
```

This forces a rebuild of the entire chat screen **every second** to update the timer countdown text.

---

### 10. FRONTEND UI: DISAPPEARING MESSAGE TIMER DIALOG

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\chat_action_tiles.dart`

#### Timer Dialog Options (lines 208-215):

```dart
final _options = [
  {'label': '30 seconds', 'value': 30},
  {'label': '1 minute', 'value': 60},
  {'label': '5 minutes', 'value': 300},
  {'label': '1 hour', 'value': 3600},
  {'label': '1 day', 'value': 86400},
  {'label': 'Off', 'value': null},
];
```

#### Setting Timer (lines 246-251):

```dart
TextButton(
  onPressed: () {
    final chat = context.read<ChatProvider>();
    chat.setConversationDisappearingTimer(_selectedSeconds);
    Navigator.pop(context);
  },
  child: const Text('Set'),
),
```

#### Sending Message with Timer (in chat_input_bar.dart, lines 50-63):

```dart
void _send() {
  final text = _controller.text.trim();
  if (text.isEmpty) return;
  
  final chat = context.read<ChatProvider>();
  final expiresIn = chat.conversationDisappearingTimer;
  chat.sendMessage(text, expiresIn: expiresIn);
  
  _controller.clear();
}
```

---

### 11. DTOs

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\dto\chat.dto.ts`

#### SendMessageDto (lines 11-29):

```typescript
export class SendMessageDto {
  @IsNumber()
  @IsPositive()
  recipientId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  expiresIn?: number; // seconds until message expires

  @IsOptional()
  @IsString()
  tempId?: string; // Client-generated ID for optimistic message matching
}
```

---

### 12. DATA FLOW DIAGRAM

```
USER ACTION
    ↓
[Chat Timer Dialog] "Set disappearing timer to 5 minutes"
    ↓
ChatProvider.setConversationDisappearingTimer(300)
    ↓
[ChatInputBar] User types message and taps Send
    ↓
ChatProvider.sendMessage(content, expiresIn: null)
    ├─ expiresIn = conversationDisappearingTimer (300 seconds)
    ├─ Create optimistic message:
    │  ├─ id: -timestamp
    │  ├─ tempId: "temp_..."
    │  ├─ deliveryStatus: SENDING
    │  └─ expiresAt: now + 300 seconds
    ├─ Add to _messages
    ├─ notifyListeners() [UI Updates: Message appears with countdown]
    └─ SocketService.sendMessage(recipientId, content, expiresIn: 300, tempId)
       ↓
       WEBSOCKET EMIT
       ↓
       BACKEND: ChatGateway.handleSendMessage()
       ├─ Validate SendMessageDto
       ├─ Calculate expiresAt = now + (expiresIn * 1000 ms)
       ├─ MessagesService.create(content, sender, conversation, {expiresAt})
       ├─ Save to PostgreSQL
       └─ Emit 'messageSent' to sender (with expiresAt, deliveryStatus: SENT)
          Emit 'newMessage' to recipient (with expiresAt)
       ↓
       FRONTEND: SocketService listeners
       ├─ onMessageSent(_handleIncomingMessage)
       ├─ Find and remove optimistic message (by tempId)
       ├─ Add confirmed message from server
       └─ _lastMessages[conversationId] = message
       ↓
       FRONTEND: ChatDetailScreen
       ├─ Timer.periodic(1 second) triggers setState()
       ├─ ChatMessageBubble.build() called
       ├─ _getTimerText() calculates remaining time
       └─ UI displays: "⏱️ 4m 59s", "⏱️ 4m 58s", ...
       ↓
       BACKEND: MessageCleanupService
       ├─ Every minute: DELETE FROM messages WHERE expiresAt < NOW()
       └─ Deleted messages are gone from database
       ↓
       FRONTEND: If message still in local list
       ├─ When user scrolls or opens chat again
       ├─ getMessages() fetches from backend
       └─ Expired messages NOT included in response
       ↓
       When expiresAt < NOW()
       ├─ ChatMessageBubble._getTimerText() returns "Expired"
       ├─ Database DELETE runs every minute
       └─ Message disappears from recipient too (on refresh)
```

---

### 13. KEY IMPLEMENTATION DETAILS

#### Optimistic UI:
- Client creates temporary message with negative ID and tempId
- Server confirms message and returns with real ID
- Client replaces temp message with confirmed version

#### Timer Countdown:
- ChatDetailScreen uses `Timer.periodic(1 second)` to trigger rebuilds
- Each rebuild calls `_getTimerText()` which calculates remaining time fresh
- No persistent timer state on frontend; calculated from `expiresAt` DateTime

#### Delivery Status Progression:
- SENDING → SENT (server received and saved)
- SENT/DELIVERED (one check icon ✓ grey)
- READ (two check icons ✓✓ blue, when recipient opens chat and emits markConversationRead)

#### Backend Cleanup:
- Every minute, cron job deletes messages where `expiresAt < NOW()`
- Frontend must handle expiration independently (can't rely on server to notify)
- When user reopens chat, expired messages are absent from `getMessages()` response

#### Conversation-level Timer:
- Each conversation stores its own `conversationDisappearingTimer` setting
- All messages sent in that conversation use that timer (unless overridden)
- Timer is per-conversation, not global

---

### 14. FILES SUMMARY TABLE

| File | Purpose | Relevant Functions/Classes |
|------|---------|----------------------------|
| `backend/src/messages/message.entity.ts` | Data model | `Message` entity with `expiresAt`, `deliveryStatus`, `messageType` |
| `backend/src/messages/messages.service.ts` | Core message logic | `create()` with options, `findByConversation()`, `updateDeliveryStatus()` |
| `backend/src/chat/services/chat-message.service.ts` | WebSocket handlers | `handleSendMessage()` (calculates expiresAt), `handleGetMessages()` |
| `backend/src/messages/message-cleanup.service.ts` | Scheduled cleanup | `@Cron(EVERY_MINUTE)` deletes expired messages |
| `backend/src/chat/chat.gateway.ts` | WebSocket gateway | Subscribes to message events, emits responses |
| `backend/src/chat/dto/chat.dto.ts` | Input validation | `SendMessageDto` with optional `expiresIn` |
| `frontend/lib/models/message_model.dart` | Data model | `MessageModel` with `expiresAt`, delivery status parsing |
| `frontend/lib/providers/chat_provider.dart` | State management | Conversation timers, optimistic messages, delivery tracking |
| `frontend/lib/services/socket_service.dart` | Socket communication | `sendMessage()` with expiresIn, event listeners |
| `frontend/lib/widgets/chat_message_bubble.dart` | Message display | `_getTimerText()` calculates countdown |
| `frontend/lib/screens/chat_detail_screen.dart` | Chat UI | `Timer.periodic(1s)` for countdown refresh |
| `frontend/lib/widgets/chat_input_bar.dart` | Input UI | Sends message with conversation timer |
| `frontend/lib/widgets/chat_action_tiles.dart` | Action menu | Timer dialog for setting disappearing timer |

---

### 15. CRITICAL GOTCHAS AND LIMITATIONS

1. **No Server-Side Notification:** When backend deletes expired messages (every minute), frontend is NOT notified. If user has chat open and message expires, the UI will still show it with "Expired" text until user refreshes or reopens.

2. **Timer Refresh Overhead:** ChatDetailScreen rebuilds every second globally to update countdown. This is CPU-intensive but acceptable for MVP. Should be optimized to only rebuild affected message bubbles.

3. **Conversation-Specific Timer:** The timer is set per-conversation, not per-message. All messages sent to a conversation use the same disappearing timer setting until changed.

4. **Client-Side Time Calculation:** Frontend calculates remaining time on every build using `DateTime.now()`. No persistent countdown timer. Clock skew between client and server could cause display issues (e.g., showing "-5s remaining" if client time is ahead of server).

5. **No Cron Error Handling:** If the cleanup cron job fails, expired messages remain in database indefinitely.

6. **Database Cleanup Every Minute:** For high-volume production, querying all messages with `expiresAt < NOW()` every minute could be slow. Should consider index on `expiresAt` column.

---

This completes the thorough exploration of the disappearing messages feature across the entire codebase.