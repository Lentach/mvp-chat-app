# Explore: Explore backend API endpoints

> Session: `c64e528e-e9d5-4dea-ac57-487ada3b19ad`
> Date: 2026-01-29
> Tokens: ~23,791

---

Perfect! Now I have a comprehensive understanding of the backend. Let me provide you with a complete analysis:

## Backend Architecture Summary

Based on my exploration of the NestJS backend at `C:\Users\Lentach\desktop\mvp-chat-app\backend`, here's what exists:

### 1. REST API Endpoints (Auth Controller)

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\auth.controller.ts`

- **POST `/auth/register`**
  - Body: `{ email: string (valid email), password: string (min 6 chars) }`
  - Returns: `{ id: number, email: string }` (user created)
  - Error: ConflictException if email already exists

- **POST `/auth/login`**
  - Body: `{ email: string, password: string }`
  - Returns: `{ access_token: string }` (JWT token)
  - Error: UnauthorizedException if credentials invalid

**Note:** There are **NO other REST endpoints**. The auth controller is the only one. All other operations happen via WebSocket events.

---

### 2. WebSocket Events (Chat Gateway)

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts`

| Event | Sent By | Data Sent | Receives |
|-------|---------|-----------|----------|
| `sendMessage` | Client | `{ recipientId: number, content: string }` | Server saves message, emits `messageSent` to sender, `newMessage` to recipient (if online) |
| `startConversation` | Client | `{ recipientEmail: string }` | Server finds/creates conversation, emits `conversationsList` + `openConversation` |
| `getMessages` | Client | `{ conversationId: number }` | Server emits `messageHistory` with last 50 messages (oldest first) |
| `getConversations` | Client | (no body) | Server emits `conversationsList` |
| `newMessage` | Server | `{ id, content, senderId, senderEmail, conversationId, createdAt }` | Recipient (if online) |
| `messageSent` | Server | `{ id, content, senderId, senderEmail, conversationId, createdAt }` | Sender (confirmation) |
| `messageHistory` | Server | Array of messages | Requester |
| `conversationsList` | Server | Array of conversations | Requester |
| `openConversation` | Server | `{ conversationId: number }` | Sender (after startConversation) |
| `error` | Server | `{ message: string }` | Client (on failure) |

**Connection:** Client connects with JWT token via query param `?token=xxx` or auth header. Server tracks online users with a Map of userId -> socketId.

---

### 3. Entity Models & Relationships

**User Entity** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\user.entity.ts`)
```
- id: number (PK, auto-increment)
- email: string (unique)
- password: string (bcrypt hash, 10 rounds)
- createdAt: Date (auto-set)
```

**Conversation Entity** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\conversations\conversation.entity.ts`)
```
- id: number (PK)
- userOne: User (FK, eager loaded)
- userTwo: User (FK, eager loaded)
- createdAt: Date (auto-set)
```
1-on-1 only. findOrCreate pattern prevents duplicates regardless of user order.

**Message Entity** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\messages\message.entity.ts`)
```
- id: number (PK)
- content: string (text)
- sender: User (FK, eager loaded)
- conversation: Conversation (FK, lazy loaded)
- createdAt: Date (auto-set)
```

---

### 4. Services Available

**UsersService** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\users.service.ts`)
- `create(email, password)` — Register user with bcrypt hashing
- `findByEmail(email)` — Case-insensitive lookup
- `findById(id)` — Get user by ID

**ConversationsService** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\conversations\conversations.service.ts`)
- `findOrCreate(userOne, userTwo)` — Prevents duplicate 1-on-1 chats
- `findById(id)` — Get conversation by ID
- `findByUser(userId)` — All conversations for a user

**MessagesService** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\messages\messages.service.ts`)
- `create(content, sender, conversation)` — Save message to DB
- `findByConversation(conversationId)` — Last 50 messages (oldest first)

**AuthService** (`C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\auth.service.ts`)
- `register(email, password)` — Create user + return safe data
- `login(email, password)` — Verify + return JWT token

---

### 5. User Search / Contacts / Friends Feature

**Status: NOT IMPLEMENTED**

There is **no endpoint for searching users** or adding friends/contacts. The backend currently lacks:
- GET endpoint to search users by email or name
- Friend/contact list management
- User profile info beyond id and email
- User presence/status information (only socket-based online tracking)

To start a conversation, the frontend must already know the recipient's email address and send it via the `startConversation` WebSocket event. There's no discovery mechanism.

---

### Summary for Professional Messenger Frontend

The backend provides a **minimal but functional foundation**:

**What works:**
- User registration/login with JWT
- 1-on-1 real-time messaging via WebSocket
- Conversation history (last 50 messages)
- Online status tracking

**What's missing for a professional app:**
- User search/discovery
- Contacts/friends list management
- User profiles (avatar, bio, status)
- Typing indicators
- Message read receipts
- Group chat support
- Blocking/muting users
- Message deletion/editing
- Pagination for message history

You'll need to extend the backend with additional REST endpoints or WebSocket events to support these features.