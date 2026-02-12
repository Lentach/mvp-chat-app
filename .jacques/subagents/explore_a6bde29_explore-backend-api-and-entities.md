# Explore: Explore backend API and entities

> Session: `a8fba1b7-b076-483f-b0d2-5de2ff82fa77`
> Date: 2026-01-29
> Tokens: ~38,911

---

Perfect! Now I have all the information needed. Let me compile a comprehensive technical specification for your Flutter client.

---

## NestJS Chat Backend API Specification for Flutter Client

### Base URL
- **Development**: `http://localhost:3000`
- **Docker Compose**: Database exposed on port `5433` (PostgreSQL), app on port `3000`

---

## 1. REST API ENDPOINTS

### 1.1 Authentication Endpoints (`/auth`)

#### **POST /auth/register**
- **Route**: `/auth/register`
- **Method**: `POST`
- **Rate Limit**: 5 requests per 60 seconds
- **Request Body** (RegisterDto):
```json
{
  "username": "string",       // Required, 3-30 chars, alphanumeric + underscores only
  "password": "string",       // Required, min 6 chars
  "displayName": "string"     // Optional, max 50 chars
}
```
- **Success Response** (200):
```json
{
  "id": 1,
  "username": "john_doe"
}
```
- **Validation Rules**:
  - Username: `/^[a-zA-Z0-9_]+$/`, 3-30 characters
  - Password: Minimum 6 characters
  - DisplayName: Optional, max 50 characters

---

#### **POST /auth/login**
- **Route**: `/auth/login`
- **Method**: `POST`
- **Rate Limit**: 5 requests per 60 seconds
- **Request Body** (LoginDto):
```json
{
  "username": "string",
  "password": "string"
}
```
- **Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",  // JWT, expires in 15 minutes
  "refresh_token": "80-char-hex-string"       // Random token, expires in 7 days
}
```
- **Error Response** (401):
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

---

#### **POST /auth/refresh**
- **Route**: `/auth/refresh`
- **Method**: `POST`
- **Rate Limit**: 10 requests per 60 seconds
- **Request Body** (RefreshTokenDto):
```json
{
  "refreshToken": "string"
}
```
- **Success Response** (200):
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "new-80-char-hex-string"
}
```
- **Notes**: 
  - Implements token rotation - old refresh token is revoked when new pair is issued
  - Refresh tokens are hashed with bcrypt in database

---

#### **POST /auth/logout**
- **Route**: `/auth/logout`
- **Method**: `POST`
- **Request Body** (RefreshTokenDto):
```json
{
  "refreshToken": "string"
}
```
- **Success Response** (200):
```json
{
  "message": "Logged out"
}
```
- **Notes**: Revokes the refresh token in database

---

### 1.2 User Profile Endpoints (`/users`)

**All endpoints require JWT authentication** via `Authorization: Bearer <access_token>` header.

#### **GET /users/me**
- **Route**: `/users/me`
- **Method**: `GET`
- **Guard**: `JwtAuthGuard`
- **Success Response** (200):
```json
{
  "id": 1,
  "username": "john_doe",
  "displayName": "John Doe",          // nullable
  "avatarUrl": "/uploads/avatars/abc123.png",  // nullable
  "avatarColor": "#4a8fc2",           // nullable, hex color
  "createdAt": "2026-01-28T10:00:00.000Z"
}
```

---

#### **PATCH /users/me**
- **Route**: `/users/me`
- **Method**: `PATCH`
- **Guard**: `JwtAuthGuard`
- **Request Body** (UpdateProfileDto):
```json
{
  "displayName": "string"  // Optional, max 50 chars
}
```
- **Success Response** (200):
```json
{
  "id": 1,
  "username": "john_doe",
  "displayName": "Updated Name",
  "avatarUrl": "/uploads/avatars/abc123.png",
  "avatarColor": "#4a8fc2"
}
```

---

#### **POST /users/me/avatar**
- **Route**: `/users/me/avatar`
- **Method**: `POST`
- **Guard**: `JwtAuthGuard`
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - Field name: `avatar`
  - File type: `image/jpeg`, `image/png`, or `image/webp`
  - Max size: **2MB**
- **Success Response** (200):
```json
{
  "avatarUrl": "/uploads/avatars/abc123def456.png"
}
```
- **Error Response** (400):
```json
{
  "statusCode": 400,
  "message": "Only jpg, png, webp allowed"
}
```
- **Notes**: 
  - Deletes previous avatar if exists
  - Filename is random 32-char hex + original extension
  - Saved to `uploads/avatars/` directory

---

#### **DELETE /users/me/avatar**
- **Route**: `/users/me/avatar`
- **Method**: `DELETE`
- **Guard**: `JwtAuthGuard`
- **Success Response** (200):
```json
{
  "message": "Avatar removed"
}
```
- **Notes**: Deletes avatar file and sets `avatarUrl` to null

---

## 2. WEBSOCKET EVENTS (Socket.IO)

### Connection Details
- **URL**: Same as base URL (e.g., `http://localhost:3000`)
- **Protocol**: Socket.IO (WebSocket with fallback)
- **CORS Origin**: Configurable via `CORS_ORIGIN` env var
- **Authentication**: 
  - JWT token passed in `auth.token` field during connection:
  ```dart
  socket = io('http://localhost:3000', {
    'auth': {'token': 'your-jwt-access-token'},
    'transports': ['websocket']
  });
  ```
  - If token is invalid or missing, connection is immediately closed
  - Token is verified via `JwtService.verify()`

### Connection Lifecycle Events

#### **Connection Success**
- Server extracts user data and stores in `client.data.user`
- User is added to online users map
- If user just came online (first socket), broadcasts `userOnline` to all clients

#### **userOnline** (Server → All Clients)
```json
{
  "userId": 123
}
```

#### **userOffline** (Server → All Clients)
```json
{
  "userId": 123
}
```
- Emitted when user's last socket disconnects
- Server updates `lastSeenAt` timestamp in database

---

### 2.1 Messaging Events

#### **sendMessage** (Client → Server)
- **Event**: `sendMessage`
- **Payload**:
```json
{
  "recipientId": 456,
  "content": "Hello world"
}
```
- **Validation**:
  - `recipientId`: Must be positive integer
  - `content`: String, 1-5000 characters (trimmed)
- **Response Events**:
  1. **messageSent** (to sender):
  ```json
  {
    "id": 789,
    "content": "Hello world",
    "senderId": 123,
    "senderUsername": "john_doe",
    "conversationId": 50,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "readAt": null
  }
  ```
  2. **newMessage** (to recipient, if online):
  ```json
  {
    "id": 789,
    "content": "Hello world",
    "senderId": 123,
    "senderUsername": "john_doe",
    "conversationId": 50,
    "createdAt": "2026-01-29T10:00:00.000Z",
    "readAt": null
  }
  ```
- **Error Event** (on validation failure):
```json
{
  "message": "Message content must be between 1 and 5000 characters"
}
```

---

#### **startConversation** (Client → Server)
- **Event**: `startConversation`
- **Payload**:
```json
{
  "recipientUsername": "jane_smith"
}
```
- **Validation**:
  - Username: 3-30 chars, alphanumeric + underscores
  - Cannot start conversation with self
- **Response Events**:
  1. **conversationsList** (to sender) - full updated list
  2. **openConversation** (to sender):
  ```json
  {
    "conversationId": 50
  }
  ```

---

#### **getMessages** (Client → Server)
- **Event**: `getMessages`
- **Payload**:
```json
{
  "conversationId": 50,
  "before": 1000,     // Optional: message ID for pagination
  "limit": 50         // Optional: default 50, max 100
}
```
- **Response Event**: **messageHistory**
```json
{
  "messages": [
    {
      "id": 789,
      "content": "Hello",
      "senderId": 123,
      "senderUsername": "john_doe",
      "conversationId": 50,
      "createdAt": "2026-01-29T10:00:00.000Z",
      "readAt": "2026-01-29T10:05:00.000Z"
    }
  ],
  "hasMore": true  // Boolean: indicates if more messages exist
}
```
- **Notes**: 
  - Messages ordered by ID DESC (newest first in result)
  - Cursor-based pagination using message ID

---

#### **getConversations** (Client → Server)
- **Event**: `getConversations`
- **Payload**: None (empty object or no payload)
- **Response Event**: **conversationsList**
```json
[
  {
    "id": 50,
    "userOne": {
      "id": 123,
      "username": "john_doe",
      "displayName": "John Doe",
      "avatarUrl": "/uploads/avatars/abc.png",
      "avatarColor": "#4a8fc2"
    },
    "userTwo": {
      "id": 456,
      "username": "jane_smith",
      "displayName": null,
      "avatarUrl": null,
      "avatarColor": "#e84a4a"
    },
    "otherUser": {
      "id": 456,
      "username": "jane_smith",
      "displayName": null,
      "avatarUrl": null,
      "avatarColor": "#e84a4a",
      "isOnline": true,
      "lastSeenAt": null
    },
    "unreadCount": 3,
    "createdAt": "2026-01-28T10:00:00.000Z"
  }
]
```
- **Notes**: 
  - `otherUser` is the user that's NOT the current user
  - `isOnline` reflects real-time status
  - `lastSeenAt` is null if user is online or never disconnected

---

### 2.2 Typing Indicators

#### **typing** (Client → Server)
- **Event**: `typing`
- **Payload**:
```json
{
  "conversationId": 50
}
```
- **Relay Event**: **userTyping** (to other participant)
```json
{
  "userId": 123,
  "conversationId": 50
}
```

---

#### **stopTyping** (Client → Server)
- **Event**: `stopTyping`
- **Payload**:
```json
{
  "conversationId": 50
}
```
- **Relay Event**: **userStoppedTyping** (to other participant)
```json
{
  "userId": 123,
  "conversationId": 50
}
```

---

### 2.3 Read Receipts

#### **markRead** (Client → Server)
- **Event**: `markRead`
- **Payload**:
```json
{
  "conversationId": 50
}
```
- **Database Action**: 
  - Updates all messages in conversation where `sender != current user` and `readAt IS NULL`
  - Sets `readAt = NOW()`
- **Relay Event**: **messagesRead** (to sender of messages)
```json
{
  "conversationId": 50,
  "readAt": "2026-01-29T10:05:00.000Z"
}
```

---

### 2.4 Online Status

#### **getOnlineUsers** (Client → Server)
- **Event**: `getOnlineUsers`
- **Payload**: None
- **Response Event**: **onlineUsers**
```json
[123, 456, 789]  // Array of user IDs currently online
```
- **Notes**: Multi-device support - user is online if ANY socket is connected

---

## 3. DATABASE ENTITIES

### 3.1 User Entity
- **Table**: `users`
- **Fields**:
```typescript
{
  id: number,                    // Primary key, auto-increment
  username: string,              // Unique, indexed
  password: string,              // Bcrypt hashed
  displayName: string | null,    // Max 50 chars
  avatarUrl: string | null,      // Path to uploaded file
  avatarColor: string | null,    // Hex color (e.g., "#4a8fc2")
  lastSeenAt: Date | null,       // Timestamp, updated on disconnect
  createdAt: Date                // Auto-generated timestamp
}
```

---

### 3.2 Conversation Entity
- **Table**: `conversations`
- **Fields**:
```typescript
{
  id: number,           // Primary key, auto-increment
  userOne: User,        // ManyToOne relation (eager loaded)
  userTwo: User,        // ManyToOne relation (eager loaded)
  createdAt: Date       // Auto-generated timestamp
}
```
- **Notes**: 
  - 1-on-1 only (no groups)
  - `findOrCreate` pattern prevents duplicates
  - Order of userOne/userTwo doesn't matter (symmetric)

---

### 3.3 Message Entity
- **Table**: `messages`
- **Fields**:
```typescript
{
  id: number,              // Primary key, auto-increment
  content: string,         // TEXT field (up to 5000 chars)
  sender: User,            // ManyToOne relation (eager loaded)
  conversation: Conversation,  // ManyToOne relation
  readAt: Date | null,     // Timestamp when marked as read
  createdAt: Date          // Auto-generated timestamp
}
```
- **Foreign Keys**:
  - `sender_id` → `users.id`
  - `conversation_id` → `conversations.id`

---

### 3.4 RefreshToken Entity
- **Table**: `refresh_tokens`
- **Fields**:
```typescript
{
  id: string,              // UUID, primary key
  hashedToken: string,     // Bcrypt hash of raw token
  user: User,              // ManyToOne relation (CASCADE delete)
  userId: number,          // Foreign key
  expiresAt: Date,         // Expiry timestamp (7 days from creation)
  isRevoked: boolean,      // Default false, set true on logout/rotation
  createdAt: Date          // Auto-generated timestamp
}
```

---

## 4. AUTHENTICATION FLOW

### 4.1 JWT Strategy
- **Strategy**: Passport JWT
- **Token Extraction**: From `Authorization: Bearer <token>` header
- **Secret**: From `ConfigService` (`jwt.secret` env var)
- **Access Token Expiry**: **15 minutes** (configured in auth.module.ts)
- **Payload Structure**:
```json
{
  "sub": 123,              // User ID
  "username": "john_doe",
  "iat": 1738155600,       // Issued at timestamp
  "exp": 1738156500        // Expiry timestamp (15 min later)
}
```

### 4.2 Refresh Token Flow
1. **Login/Register**: Receive `access_token` + `refresh_token`
2. **Store Tokens**: 
   - Access token: In memory or secure storage (expires 15 min)
   - Refresh token: Secure storage (expires 7 days)
3. **Auto-Refresh**: Before access token expires (e.g., every 14 minutes), call `/auth/refresh`
4. **Token Rotation**: Server revokes old refresh token, issues new pair
5. **On 401 Error**: Try refresh flow, if fails → logout

### 4.3 WebSocket Authentication
- Pass access token in connection options:
```dart
IO.Socket socket = IO.io('http://localhost:3000', 
  IO.OptionBuilder()
    .setAuth({'token': accessToken})
    .setTransports(['websocket'])
    .build()
);
```
- Server verifies token in `handleConnection`
- Invalid token → immediate disconnect
- Valid token → user data stored in `client.data.user`

---

## 5. STATIC FILES CONFIGURATION

### From `main.ts`:
```typescript
app.useStaticAssets(join(__dirname, '..', 'src', 'public'));
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
```

### Accessible URLs:
- **Public assets**: `http://localhost:3000/<filename>` (serves from `src/public/`)
- **Uploaded files**: `http://localhost:3000/uploads/<path>` (serves from `uploads/` directory)
  - Example: `http://localhost:3000/uploads/avatars/abc123.png`

---

## 6. DOCKER COMPOSE SETUP

### Services:
1. **db** (PostgreSQL):
   - Image: `postgres:16-alpine`
   - Port: `5433:5432` (host:container)
   - Environment:
     - `POSTGRES_USER`: From `.env` or default `postgres`
     - `POSTGRES_PASSWORD`: From `.env` or default `postgres`
     - `POSTGRES_DB`: From `.env` or default `chatdb`
   - Volume: `pgdata` (persistent storage)

2. **app** (NestJS):
   - Build: From `Dockerfile` in project root
   - Port: `3000:3000`
   - Environment:
     - Reads from `.env` file
     - Overrides: `DB_HOST=db`, `DB_PORT=5432`, `CORS_ORIGIN=*`
   - Depends on: `db` service

### Start Command:
```bash
docker-compose up --build
```

---

## 7. ENVIRONMENT VARIABLES

From `.env.example`:
```bash
# Database
DB_HOST=localhost          # Use 'db' in Docker
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=chatdb

# JWT
JWT_SECRET=change-me-to-a-strong-random-string
JWT_REFRESH_SECRET=change-me-to-another-strong-random-string

# Server
PORT=3000

# CORS
CORS_ORIGIN=http://localhost:3000  # Or '*' for development
```

---

## 8. RATE LIMITING

Configured via `@nestjs/throttler`:
- **Default**: 10 requests per 60 seconds
- **Auth endpoints** (`/auth/register`, `/auth/login`): 5 requests per 60 seconds
- **Refresh endpoint** (`/auth/refresh`): 10 requests per 60 seconds
- **Response on violation**: HTTP 429 (Too Many Requests)

---

## 9. VALIDATION RULES SUMMARY

### Username:
- Regex: `/^[a-zA-Z0-9_]+$/`
- Length: 3-30 characters
- Unique in database

### Password:
- Minimum: 6 characters
- Hashed with bcrypt (10 rounds)

### Message Content:
- Type: String
- Length: 1-5000 characters (after trimming)

### Display Name:
- Optional
- Maximum: 50 characters

### Avatar File:
- Types: JPEG, PNG, WebP
- Max Size: 2MB
- Storage: `uploads/avatars/` with random 32-char hex filename

---

## 10. ERROR HANDLING

### HTTP Exception Filter
- Catches all `HttpException` instances
- Returns standardized format:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```
- **No stack traces** in production

### WebSocket Exception Filter
- Catches all errors in gateway handlers
- Emits `error` event to client:
```json
{
  "message": "Error description"
}
```

---

## 11. MULTI-DEVICE SUPPORT

The gateway implements multi-device tracking:
- **Online Users Map**: `Map<userId, Set<socketId>>`
- User is online if ANY socket is connected
- `userOnline` broadcast only when first socket connects
- `userOffline` broadcast only when last socket disconnects
- Messages/events are delivered to ALL user's sockets via `emitToUser()` helper

---

## 12. FLUTTER IMPLEMENTATION CHECKLIST

For your Flutter client, you'll need:

1. **HTTP Client** (e.g., `dio` or `http` package):
   - Base URL configuration
   - Interceptor for `Authorization: Bearer <token>` header
   - 401 error handling → trigger refresh flow
   - 429 error handling → backoff/retry logic

2. **WebSocket Client** (`socket_io_client` package):
   - Connection with auth token in options
   - Event listeners for all server events
   - Reconnection logic with token refresh
   - Multi-device awareness

3. **State Management**:
   - User authentication state (tokens, profile)
   - Conversations list with real-time updates
   - Messages per conversation with pagination
   - Online status tracking
   - Typing indicators per conversation
   - Unread counts

4. **File Upload**:
   - `multipart/form-data` request builder
   - Image picker integration
   - Progress tracking for uploads

5. **Persistent Storage**:
   - Secure storage for refresh token
   - Local cache for messages/conversations
   - Token expiry tracking

6. **Background Services**:
   - Auto-refresh timer (every 14 minutes)
   - WebSocket reconnection on network changes
   - Message queue for offline sending

---

This specification covers all endpoints, events, data models, and authentication flows in the NestJS backend. All file paths referenced are absolute paths from the project root: `C:\Users\Lentach\desktop\mvp-chat-app\`