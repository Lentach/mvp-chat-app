# Plan: Secure Daily-Use Communicator

Transform the MVP chat app into a secure communicator people want to use daily.
Four phases — security first, then UX, then features, then production hardening.

---

## Phase 1: Security Hardening

### 1.1 Environment-based config (`@nestjs/config`)
- Create `src/config/configuration.ts` — centralized config factory
- Create `.env.example` — document all env vars
- Modify `src/app.module.ts` — add `ConfigModule.forRoot({ isGlobal: true })`
- Modify `src/auth/auth.module.ts` — `JwtModule.registerAsync` with ConfigService
- Modify `src/auth/strategies/jwt.strategy.ts` — inject ConfigService
- Modify `docker-compose.yml` — use `env_file:`, remove hardcoded secrets
- Add `.env` to `.gitignore`

### 1.2 Helmet for HTTP security headers
- Install `helmet`
- Modify `src/main.ts` — add `app.use(helmet())`

### 1.3 CORS lockdown
- Modify `src/main.ts` — `app.enableCors({ origin: configuredOrigin, credentials: true })`
- Modify `src/chat/chat.gateway.ts` — replace `cors: { origin: '*' }` with configured origin

### 1.4 Rate limiting (`@nestjs/throttler`)
- Modify `src/app.module.ts` — import ThrottlerModule (10 req/min global)
- Modify `src/auth/auth.controller.ts` — stricter limit on login/register (5 req/min)

### 1.5 Input validation on WebSocket messages
- Modify `src/chat/chat.gateway.ts` — validate message content (string, trimmed, max 5000 chars), validate recipientId (positive integer), validate recipientEmail (valid format, max 254 chars)
- Create `src/common/validators.ts` — shared validation helpers

### 1.6 Refresh token mechanism
- Create `src/auth/entities/refresh-token.entity.ts` — id (uuid), hashed token, userId FK, expiresAt, isRevoked
- Create `src/auth/dto/refresh-token.dto.ts`
- Modify `src/auth/auth.module.ts` — register entity, set access token to 15min
- Modify `src/auth/auth.service.ts` — login returns access + refresh tokens, add `refresh()` and `logout()` methods with token rotation
- Modify `src/auth/auth.controller.ts` — add `POST /auth/refresh` and `POST /auth/logout`
- Modify `src/app.module.ts` — register RefreshToken entity
- Modify `src/public/index.html` — auto-refresh access token on timer, handle 401 with refresh, store refresh token as httpOnly cookie
- **Decision**: Use httpOnly cookie for refresh token (survives page refresh, secure)

### 1.7 WebSocket auth cleanup
- Modify `src/chat/chat.gateway.ts` — use only `client.handshake.auth.token`, remove query param support
- Modify `src/public/index.html` — connect with `auth: { token }` only

### 1.8 Error handling
- Create `src/common/filters/http-exception.filter.ts` — consistent JSON errors, no stack traces
- Create `src/common/filters/ws-exception.filter.ts` — WebSocket error filter
- Modify `src/main.ts` — register global HTTP filter
- Modify `src/chat/chat.gateway.ts` — add `@UseFilters(WsExceptionFilter)`

**New packages:** `@nestjs/config`, `helmet`, `@nestjs/throttler`

---

## Phase 2: Core UX & Features

### 2.1 Username / display name
- Modify `src/users/user.entity.ts` — add `displayName` column (nullable)
- Modify `src/auth/dto/register.dto.ts` — add optional displayName field
- Modify `src/auth/auth.service.ts` — pass displayName on create
- Create `src/users/users.controller.ts` — `GET /users/me`, `PATCH /users/me`
- Create `src/users/dto/update-profile.dto.ts`
- Modify `src/users/users.module.ts` — register controller
- Modify `src/chat/chat.gateway.ts` — include displayName in payloads
- Modify `src/public/index.html` — show displayName (fallback to email prefix)

### 2.2 Online/offline status indicators
- Modify `src/chat/chat.gateway.ts` — broadcast `userOnline`/`userOffline` events, add `getOnlineUsers` handler, include `isOnline` in conversation list
- Modify `src/public/index.html` — green/gray dot next to conversations

### 2.3 Typing indicators
- Modify `src/chat/chat.gateway.ts` — add `typing`/`stopTyping` handlers, relay to other party
- Modify `src/public/index.html` — debounced typing emission, "User is typing..." display

### 2.4 Read receipts
- Modify `src/messages/message.entity.ts` — add `readAt` column
- Modify `src/messages/messages.service.ts` — add `markAsRead()` method
- Modify `src/chat/chat.gateway.ts` — add `markRead` handler, emit `messagesRead`
- Modify `src/public/index.html` — emit markRead on open, show checkmarks on sent messages

### 2.5 Unread message count (depends on 2.4)
- Modify `src/messages/messages.service.ts` — add `getUnreadCount()` query
- Modify `src/chat/chat.gateway.ts` — include unread count in conversation list
- Modify `src/public/index.html` — badge on conversation items

### 2.6 Message pagination (cursor-based)
- Modify `src/messages/messages.service.ts` — accept `{ before, limit }`, return `hasMore`
- Modify `src/chat/chat.gateway.ts` — update getMessages handler
- Modify `src/public/index.html` — infinite scroll (load older on scroll-to-top)

### 2.7 Sound notifications
- Modify `src/public/index.html` — Web Audio API beep on new message (when tab unfocused or different conversation active), mute toggle button

### 2.8 Mobile-responsive UI
- Modify `src/public/index.html` — media queries for <768px, full-width sidebar with back button, fluid layout, larger touch targets

---

## Phase 3: Essential Chat Features

### 3.1 Message editing and deletion
- Modify `src/messages/message.entity.ts` — add `editedAt`, `isDeleted` columns
- Modify `src/messages/messages.service.ts` — add `editMessage()`, `deleteMessage()` (soft delete)
- Modify `src/chat/chat.gateway.ts` — add `editMessage`/`deleteMessage` handlers
- Modify `src/public/index.html` — context menu on own messages, "(edited)" label, "[Message deleted]" placeholder

### 3.2 User search/discovery
- Modify `src/users/users.service.ts` — add `searchByEmail()` with ILIKE
- Modify `src/users/users.controller.ts` — add `GET /users/search?q=`
- Modify `src/public/index.html` — search-as-you-type with dropdown results

### 3.3 User avatars
- Modify `src/users/user.entity.ts` — add `avatarUrl` column
- Modify `src/users/users.controller.ts` — add `POST /users/me/avatar` (2MB limit, png/jpg/webp)
- Modify `src/public/index.html` — avatar circles in conversations and messages, initials fallback

### 3.4 Last seen timestamps
- Modify `src/users/user.entity.ts` — add `lastSeenAt` column
- Modify `src/chat/chat.gateway.ts` — update lastSeen on disconnect, include in conversation data
- Modify `src/public/index.html` — "last seen X min ago" for offline users

### 3.5 Message search
- Modify `src/messages/messages.service.ts` — add `searchMessages()` with ILIKE
- Modify `src/chat/chat.gateway.ts` — add `searchMessages` handler
- Modify `src/public/index.html` — search bar with inline results

### 3.6 File/image sharing
- Create `src/uploads/uploads.module.ts`, `uploads.controller.ts`, `uploads.service.ts`
- Modify `src/messages/message.entity.ts` — add `fileUrl`, `fileType` columns
- Modify `src/app.module.ts` — import UploadsModule
- Modify `src/public/index.html` — attachment button, inline image rendering, download links
- **New package:** `uuid`

### 3.7 Emoji support
- Modify `src/public/index.html` — emoji picker popup, font-family fallback for emoji rendering

---

## Phase 4: Production Readiness

### 4.1 Database migrations
- Create `src/config/typeorm.config.ts` — DataSource for CLI
- Create `src/migrations/` directory
- Modify `src/app.module.ts` — `synchronize: false`, `migrationsRun: true`
- Modify `package.json` — add migration scripts

### 4.2 Logging (nestjs-pino)
- Modify `src/app.module.ts` — import LoggerModule
- Modify `src/main.ts` — set pino logger
- Modify `src/chat/chat.gateway.ts` — replace console.log with Logger
- **New packages:** `nestjs-pino`, `pino-pretty`

### 4.3 Health check endpoint (`@nestjs/terminus`)
- Create `src/health/health.module.ts`, `health.controller.ts`
- Modify `src/app.module.ts` — import HealthModule
- Modify `docker-compose.yml` — add healthcheck

### 4.4 Swagger API docs (`@nestjs/swagger`)
- Modify `src/main.ts` — set up SwaggerModule at `/api/docs`
- Add decorators to controllers and DTOs

### 4.5 Unit tests for critical paths
- Create `src/auth/auth.service.spec.ts`
- Create `src/chat/chat.gateway.spec.ts`
- Create `src/messages/messages.service.spec.ts`
- Create `src/conversations/conversations.service.spec.ts`

---

## Verification

After each phase:
1. `docker-compose up --build` — app starts without errors
2. Register + login works
3. Send messages between two users (two browser tabs)
4. Phase-specific checks:
   - **Phase 1**: Verify rate limiting (6th rapid login fails), helmet headers in response, refresh token flow
   - **Phase 2**: Typing indicator shows, read receipts update, pagination loads older messages, mobile layout works on phone
   - **Phase 3**: Edit/delete a message, search users, upload an image, use emoji picker
   - **Phase 4**: `GET /health` returns ok, `/api/docs` shows Swagger UI, migrations run on startup


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\e7414b5c-f3eb-4e08-93fe-86fc93cd4741.jsonl