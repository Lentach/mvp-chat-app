# Explore: Explore backend API contracts

> Session: `a656a9b3-691e-42f1-8f7e-a9ba6dffd624`
> Date: 2026-01-29
> Tokens: ~31,938

---

Perfect! I now have all the API contract information. Let me compile a comprehensive summary for your Flutter implementation.

## NestJS Backend API Contracts - Complete Summary

### Overview
- **Base URL**: `http://localhost:3000` (dev) or configured via CORS_ORIGIN
- **Database**: PostgreSQL on port 5433 (mapped from 5432)
- **App Port**: 3000
- **Authentication**: JWT-based with refresh token mechanism
- **WebSocket**: Socket.IO with JWT in auth handshake

---

## 1. AUTH ENDPOINTS

### POST `/auth/register`
**Throttle**: 5 requests per 60 seconds

**Request**:
```json
{
  "username": "string (3-30 chars, alphanumeric + underscores)",
  "password": "string (min 6 chars)",
  "displayName": "string (optional, max 50 chars)"
}
```

**Response**:
```json
{
  "id": 1,
  "username": "john_doe",
  "displayName": "John Doe",
  "avatarUrl": "/uploads/avatars/hash.png",
  "avatarColor": "#4a8fc2",
  "accessToken": "jwt_token",
  "refreshToken": "uuid_string"
}
```

### POST `/auth/login`
**Throttle**: 5 requests per 60 seconds

**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**: Same as register (without displayName optional field)

### POST `/auth/refresh`
**Throttle**: 10 requests per 60 seconds

**Request**:
```json
{
  "refreshToken": "string"
}
```

**Response**:
```json
{
  "accessToken": "new_jwt_token",
  "refreshToken": "new_uuid_string"
}
```

### POST `/auth/logout`
**Request**:
```json
{
  "refreshToken": "string"
}
```

**Response**:
```json
{
  "message": "Logged out successfully"
}
```

---

## 2. USERS ENDPOINTS

**All require JWT authentication (Authorization header or Cookie)**

### GET `/users/me`
**Response**:
```json
{
  "id": 1,
  "username": "john_doe",
  "displayName": "John Doe",
  "avatarUrl": "/uploads/avatars/hash.png",
  "avatarColor": "#4a8fc2",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### PATCH `/users/me`
**Request**:
```json
{
  "displayName": "string (optional, max 50 chars)"
}
```

**Response**:
```json
{
  "id": 1,
  "username": "john_doe",
  "displayName": "Updated Name",
  "avatarUrl": "/uploads/avatars/hash.png",
  "avatarColor": "#4a8fc2"
}
```

### POST `/users/me/avatar`
**Content-Type**: `multipart/form-data`
**Field**: `avatar` (file)

**Constraints**:
- Max file size: 2MB
- Allowed types: image/jpeg, image/png, image/webp
- Storage: `./uploads/avatars/` directory (auto-created)

**Response**:
```json
{
  "avatarUrl": "/uploads/avatars/filename.png"
}
```

### DELETE `/users/me/avatar`
**Response**:
```json
{
  "message": "Avatar removed"
}
```

---

## 3. WEBSOCKET EVENTS (Socket.IO)

**Connection**:
```javascript
io('http://localhost:3000', {
  auth: {
    token: 'jwt_token'
  }
})
```

**CORS Origin**: From `cors.origin` config (default: `http://localhost:3000`)

### CLIENT → SERVER Events

#### `sendMessage`
```json
{
  "recipientId": 2,
  "content": "string (1-5000 chars, trimmed)"
}
```

#### `startConversation`
```json
{
  "recipientUsername": "string (3-30 alphanumeric + underscores)"
}
```

#### `getMessages`
```json
{
  "conversationId": 1,
  "before": 999 (optional, message ID),
  "limit": 50 (optional, max 100, default 50)
}
```

#### `getConversations`
(no payload)

#### `typing`
```json
{
  "conversationId": 1
}
```

#### `stopTyping`
```json
{
  "conversationId": 1
}
```

#### `markRead`
```json
{
  "conversationId": 1
}
```

#### `getOnlineUsers`
(no payload)

---

### SERVER → CLIENT Events

#### `messageSent`
```json
{
  "id": 1,
  "content": "message text",
  "senderId": 1,
  "senderUsername": "john_doe",
  "conversationId": 1,
  "createdAt": "2024-01-15T10:30:00Z",
  "readAt": null
}
```

#### `newMessage`
Same as `messageSent`

#### `messageHistory`
```json
{
  "messages": [
    {
      "id": 1,
      "content": "text",
      "senderId": 1,
      "senderUsername": "john_doe",
      "conversationId": 1,
      "createdAt": "2024-01-15T10:30:00Z",
      "readAt": "2024-01-15T10:31:00Z" or null
    }
  ],
  "hasMore": true
}
```

#### `conversationsList`
```json
[
  {
    "id": 1,
    "userOne": {
      "id": 1,
      "username": "john_doe",
      "displayName": "John",
      "avatarUrl": "/uploads/avatars/hash.png",
      "avatarColor": "#4a8fc2"
    },
    "userTwo": {
      "id": 2,
      "username": "jane_smith",
      "displayName": "Jane",
      "avatarUrl": null,
      "avatarColor": "#7f5af0"
    },
    "otherUser": {
      "id": 2,
      "username": "jane_smith",
      "displayName": "Jane",
      "avatarUrl": null,
      "avatarColor": "#7f5af0",
      "isOnline": true,
      "lastSeenAt": "2024-01-15T10:25:00Z" or null
    },
    "unreadCount": 2,
    "createdAt": "2024-01-14T08:00:00Z"
  }
]
```

#### `userTyping`
```json
{
  "userId": 2,
  "conversationId": 1
}
```

#### `userStoppedTyping`
```json
{
  "userId": 2,
  "conversationId": 1
}
```

#### `messagesRead`
```json
{
  "conversationId": 1,
  "readAt": "2024-01-15T10:32:00Z"
}
```

#### `userOnline`
```json
{
  "userId": 2
}
```

#### `userOffline`
```json
{
  "userId": 2
}
```

#### `openConversation`
```json
{
  "conversationId": 1
}
```

#### `onlineUsers`
```json
[1, 2, 3]
```

#### `error`
```json
{
  "message": "Error description"
}
```

---

## 4. DATA MODELS

### User Entity
```
id: number (primary key)
username: string (unique, 3-30 chars, alphanumeric + underscores)
password: string (hashed with bcrypt)
displayName: string | null (optional, max 50)
avatarUrl: string | null (path like "/uploads/avatars/hash.png")
avatarColor: string | null (hex color like "#4a8fc2", generated from user ID hash)
lastSeenAt: Date | null (updated on disconnect)
createdAt: Date (auto-created)
```

### Message Entity
```
id: number (primary key)
content: string (1-5000 chars)
sender: User (relation, eager loaded)
conversation: Conversation (relation)
readAt: Date | null (null = unread)
createdAt: Date (auto-created)
```

### Conversation Entity
```
id: number (primary key)
userOne: User (relation, eager loaded)
userTwo: User (relation, eager loaded)
createdAt: Date (auto-created)
```

---

## 5. CONFIGURATION & DEPLOYMENT

### Environment Variables (from docker-compose.yml)
```
DB_HOST=db (Docker) or localhost (local dev)
DB_PORT=5432 (internal) or 5433 (external)
DB_USER=postgres (default)
DB_PASS=postgres (default)
DB_NAME=chatdb (default)
PORT=3000
CORS_ORIGIN=* (Docker) or http://localhost:3000 (recommended for prod)
```

### Static Files
- **Frontend**: Served from `/` (index.html from `src/public/`)
- **Uploads**: Served from `/uploads/` prefix (avatars in `/uploads/avatars/`)

### Docker Services
- **db**: PostgreSQL 16-alpine on port 5433 (mapped from 5432)
- **app**: NestJS on port 3000
- Volumes: `pgdata` for database persistence

---

## 6. KEY BEHAVIORS FOR FLUTTER CLIENT

### Authentication Flow
1. POST `/auth/register` or `/auth/login` → receive `accessToken` + `refreshToken`
2. Store `refreshToken` securely (e.g., iOS Keychain, Android Secure Storage)
3. Use `accessToken` in:
   - REST: `Authorization: Bearer <accessToken>`
   - WebSocket: `auth: { token: accessToken }`
4. On 401: POST `/auth/refresh` with `refreshToken` to get new pair
5. On logout: POST `/auth/logout` with `refreshToken`

### WebSocket Connection Lifecycle
1. Connect with JWT in `auth` handshake
2. Immediately emit `getConversations` to populate list
3. Emit `getMessages` for each conversation to load history (with pagination support)
4. Listen for real-time events (`newMessage`, `userOnline`, etc.)
5. Emit `typing` / `stopTyping` as user types
6. Emit `markRead` when conversation is viewed
7. On disconnect (network loss), reconnect with same token or refresh if expired

### Error Handling
- HTTP errors: response includes `statusCode`, `message`, no stack traces
- WebSocket errors: emitted as `error` event with `message` field
- Validation errors: response body includes field-level error messages

### Pagination
- Cursor-based pagination for messages
- Use `before: messageId` to load older messages
- Response includes `hasMore` boolean to know if end reached
- Default limit: 50, max: 100

### Avatar Display
- If `avatarUrl` is present: download and display as circular image
- If `avatarUrl` is null: render solid color circle (use `avatarColor` hex value)
- Display user's first initial in pixel font on color circle

### Online Status
- Listen to `userOnline` / `userOffline` events
- Check `isOnline` boolean in conversation's `otherUser` object
- Use `lastSeenAt` timestamp when offline (format as "X time ago")

---

## File Paths Reference

```
C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.controller.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\login.dto.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\register.dto.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\refresh-token.dto.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.controller.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\users\user.entity.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\users\dto\update-profile.dto.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\messages\message.entity.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\conversations\conversation.entity.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts
C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts
C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml
```

This should provide everything needed to implement the Flutter client with proper API integration!