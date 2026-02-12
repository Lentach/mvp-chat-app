I now have a complete understanding of the codebase. Here is the full implementation plan.

---

## Implementation Plan: MVP Chat App to Secure Daily-Use Communicator

### Current State Summary

The app is a clean NestJS monolith with 5 modules (Auth, Users, Conversations, Messages, Chat) and a single `index.html` frontend. The codebase is small (~20 source files, ~250 lines of backend code, ~750 lines of frontend). Key gaps: no rate limiting, CORS wide open, JWT secret hardcoded with fallback, no refresh tokens, no input length validation on WebSocket messages, no user display names, token sent in query string, no typing/read indicators, only 50 messages loaded with no pagination.

---

## PHASE 1: Security Hardening (Critical)

Implementation order matters here -- each step builds on the previous where noted.

### 1.1 Environment-based configuration with @nestjs/config (Small)

**Why first:** Every other security fix depends on proper config management.

**Dependency to add:** `@nestjs/config`

**Files to create/modify:**
- Create `C:\Users\Lentach\desktop\mvp-chat-app\.env.example` -- document all env vars with placeholder values
- Create `C:\Users\Lentach\desktop\mvp-chat-app\src\config\configuration.ts` -- centralized config factory function
- Modify `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- import `ConfigModule.forRoot({ isGlobal: true })` at the top of imports
- Modify `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.module.ts` -- use `JwtModule.registerAsync` pulling `JWT_SECRET` and `JWT_ACCESS_EXPIRY` from ConfigService instead of `process.env`
- Modify `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\strategies\jwt.strategy.ts` -- inject ConfigService for `secretOrKey`
- Modify `C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml` -- reference `.env` file or use `env_file:` directive, remove hardcoded JWT_SECRET
- Add `.env` to `.gitignore`

**Key config values:** `JWT_SECRET` (required, no fallback), `JWT_ACCESS_EXPIRY` (default 15m), `JWT_REFRESH_EXPIRY` (default 7d), `CORS_ORIGIN` (default http://localhost:3000), `DB_*` vars, `PORT`.

### 1.2 Helmet middleware for HTTP security headers (Small)

**Dependency to add:** `helmet` (express middleware, no NestJS wrapper needed)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- add `app.use(helmet())` before static assets. Import helmet. This adds X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, etc.

### 1.3 CORS lockdown (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- add `app.enableCors({ origin: configService.get('CORS_ORIGIN'), credentials: true })`. Get ConfigService from app container.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- change `@WebSocketGateway({ cors: { origin: '*' } })` to use the configured origin. Since decorators are static, use a factory approach: read `process.env.CORS_ORIGIN` directly in the decorator (acceptable here since ConfigModule loads `.env` before module init).

### 1.4 Rate limiting on auth endpoints (Small)

**Dependency to add:** `@nestjs/throttler`

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- import `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` (global default: 10 requests per minute)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.controller.ts` -- add `@Throttle({ default: { limit: 5, ttl: 60000 } })` on the register and login endpoints (stricter: 5 per minute for auth). Add `@UseGuards(ThrottlerGuard)`.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- the global ThrottlerGuard can optionally be set as a global guard via APP_GUARD provider instead.

### 1.5 Input validation and sanitization on messages (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- in `handleMessage`, validate `data.content`:
  - Check it is a string
  - Trim it
  - Reject if empty or exceeds 5000 characters
  - Reject if `data.recipientId` is not a positive integer
  - Emit an `error` event back with a descriptive message on validation failure
- Same validation in `handleStartConversation` for `recipientEmail` (must be a valid email string, max 254 chars)
- Consider creating a shared validation utility: `C:\Users\Lentach\desktop\mvp-chat-app\src\common\validators.ts`

### 1.6 Refresh token mechanism (Medium)

This is the most involved security change.

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\entities\refresh-token.entity.ts` -- new TypeORM entity: `id` (uuid PK), `token` (hashed string, indexed), `userId` (FK to User), `expiresAt` (Date), `createdAt` (Date), `isRevoked` (boolean, default false)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\refresh-token.dto.ts` -- DTO with `@IsString() refreshToken: string`

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.module.ts` -- register RefreshToken entity in TypeOrmModule.forFeature, change access token expiry to 15 minutes
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.service.ts` -- major changes:
  - `login()` returns both `access_token` and `refresh_token`
  - New `refresh(refreshToken: string)` method: validates the refresh token, issues new access + refresh token pair, revokes the old refresh token (rotation)
  - New `logout(refreshToken: string)` method: revokes the refresh token
  - New private `generateRefreshToken(userId: number)` method: generates a crypto random token, hashes it with bcrypt, stores in DB with 7-day expiry
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.controller.ts` -- add:
  - `POST /auth/refresh` endpoint (accepts refresh token, returns new pair)
  - `POST /auth/logout` endpoint (revokes refresh token)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- add RefreshToken to entities array in TypeORM config
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- update frontend to:
  - Store refresh token in memory (not localStorage for security)
  - Set up a timer to refresh the access token before it expires (e.g., at 13 minutes)
  - On 401 from the socket, attempt token refresh before reconnecting
  - Update logout to call `/auth/logout`

### 1.7 Move WebSocket auth from query param to auth handshake (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- in `handleConnection`, prefer `client.handshake.auth?.token` over `client.handshake.query.token`. Remove query param support entirely. The current code already reads `auth.token` as a fallback -- flip the priority and remove query param.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- remove `query: { token }` from the socket.io connection options, keep only `auth: { token }`.

### 1.8 Proper error handling (Small)

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\common\filters\http-exception.filter.ts` -- global exception filter that returns consistent JSON error format `{ statusCode, message, timestamp }` and does NOT leak stack traces
- `C:\Users\Lentach\desktop\mvp-chat-app\src\common\filters\ws-exception.filter.ts` -- WebSocket exception filter for the gateway

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- register the global HTTP exception filter
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- add `@UseFilters(WsExceptionFilter)` to the gateway class

---

## PHASE 2: Core UX & Features (High Priority)

### 2.1 Username/display name support (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\user.entity.ts` -- add `@Column({ nullable: true }) displayName: string` column
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\register.dto.ts` -- add `@IsOptional() @IsString() @MaxLength(30) displayName?: string`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.service.ts` -- pass displayName to user creation
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.service.ts` -- update `create()` to accept and store displayName. Add `updateProfile(userId, dto)` method.
- Create `C:\Users\Lentach\desktop\mvp-chat-app\src\users\dto\update-profile.dto.ts` -- DTO for profile updates
- Create `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.controller.ts` -- `GET /users/me` (get own profile), `PATCH /users/me` (update display name), both guarded with JwtAuthGuard
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.module.ts` -- register controller
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- include displayName in all message payloads and conversation list data
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- show displayName (fall back to email prefix) in conversations list and messages

### 2.2 Online/offline status indicators (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` --
  - In `handleConnection`: after adding to onlineUsers, broadcast `userOnline` event with userId to all connected sockets
  - In `handleDisconnect`: broadcast `userOffline` event with userId
  - Add `@SubscribeMessage('getOnlineUsers')` handler that returns the list of currently online user IDs
  - In `handleGetConversations` and conversation list responses, include an `isOnline` boolean for each participant
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- add a green/gray dot CSS indicator next to each conversation in the sidebar. Listen for `userOnline`/`userOffline` events and update the dot.

### 2.3 Typing indicators (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- add:
  - `@SubscribeMessage('typing')` handler: receives `{ conversationId }`, finds the other user in the conversation, emits `userTyping` with `{ conversationId, userId }` to their socket if online
  - `@SubscribeMessage('stopTyping')` handler: same pattern, emits `userStoppedTyping`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- 
  - Debounce: emit `typing` on keydown in message input (with 2-second cooldown)
  - Emit `stopTyping` after 3 seconds of no typing or on message send
  - Show "User is typing..." animation below the messages area when `userTyping` is received, hide on `userStoppedTyping` or after a 4-second timeout

### 2.4 Read receipts (Medium)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\message.entity.ts` -- add `@Column({ nullable: true }) readAt: Date`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.ts` -- add `markAsRead(messageIds: number[], userId: number)` method that sets readAt on messages where the user is NOT the sender
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` --
  - Add `@SubscribeMessage('markRead')` handler: receives `{ conversationId }`, marks all unread messages in that conversation as read, emits `messagesRead` to the sender with the message IDs and timestamp
  - Include `readAt` in message payloads
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- 
  - Emit `markRead` when opening a conversation or receiving a new message in the active conversation
  - Show checkmark indicators on sent messages (single check = delivered, double check = read)

### 2.5 Unread message count (Small, depends on 2.4)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.ts` -- add `getUnreadCount(conversationId: number, userId: number): Promise<number>` using a COUNT query where `readAt IS NULL AND sender_id != userId`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- in `handleGetConversations`, include unread count for each conversation in the response
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- show a badge/counter on conversation items in the sidebar with unread count. Style it as a small colored number.

### 2.6 Proper message pagination (Medium)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.ts` -- change `findByConversation` to accept `{ conversationId, before?: Date, limit?: number }`. Use cursor-based pagination (messages before a given timestamp). Default limit 30.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- update `handleGetMessages` to accept optional `before` timestamp and `limit`. Return a `hasMore` boolean.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- implement infinite scroll: detect when user scrolls to the top of the messages area, request older messages with the oldest visible message's timestamp as the `before` cursor. Prepend messages without losing scroll position.

### 2.7 Sound notifications (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- 
  - Use the Web Audio API to generate a simple notification beep (no external files needed): create an OscillatorNode for a short tone
  - Play the sound on `newMessage` event when the message is not in the currently active conversation OR the browser tab is not focused
  - Add a mute toggle button in the chat header
  - Use `document.hidden` (Page Visibility API) to detect if tab is focused

### 2.8 Mobile-responsive UI (Medium)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- CSS and minor JS changes:
  - Add media queries for screens below 768px
  - On mobile: sidebar takes full width, tapping a conversation hides sidebar and shows chat area, add a "back" button to return to conversation list
  - Make auth screen responsive (currently fixed 400px width)
  - Chat screen: currently fixed 700x520px -- make it fluid with max-width and vh/vw units
  - Increase touch targets for buttons
  - Consider switching the RPG pixel font to something more readable on mobile at small sizes, or increase base font-size in media queries

---

## PHASE 3: Essential Chat Features (Medium Priority)

### 3.1 Message editing and deletion (Medium)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\message.entity.ts` -- add `@Column({ nullable: true }) editedAt: Date` and `@Column({ default: false }) isDeleted: boolean`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.ts` -- add:
  - `editMessage(messageId: number, senderId: number, newContent: string)` -- only the sender can edit, sets editedAt
  - `deleteMessage(messageId: number, senderId: number)` -- soft delete, sets isDeleted=true, clears content
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- add:
  - `@SubscribeMessage('editMessage')` handler: validates ownership, calls service, emits `messageEdited` to both parties
  - `@SubscribeMessage('deleteMessage')` handler: validates ownership, calls service, emits `messageDeleted` to both parties
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- add context menu (right-click or long-press) on own messages with Edit/Delete options. On edit, replace message content with an input field. On delete, show confirmation. Update message rendering to show "(edited)" indicator and "[Message deleted]" for deleted messages.

### 3.2 User search/discovery (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.service.ts` -- add `searchByEmail(query: string, currentUserId: number): Promise<User[]>` using ILIKE pattern matching, limit 10 results, exclude current user
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.controller.ts` -- add `GET /users/search?q=query` endpoint (guarded)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- replace the "new chat email" input with a search-as-you-type field. Debounce 300ms, show results dropdown, clicking a result starts the conversation.

### 3.3 User profiles with avatars (Medium)

**Dependency to add:** `multer` (already included with @nestjs/platform-express)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\user.entity.ts` -- add `@Column({ nullable: true }) avatarUrl: string`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.controller.ts` -- add `POST /users/me/avatar` endpoint using `@UseInterceptors(FileInterceptor('avatar'))` with file size limit (2MB) and type validation (png/jpg/webp). Store in `src/public/avatars/` or a configurable upload directory.
- Create `C:\Users\Lentach\desktop\mvp-chat-app\src\public\avatars\` directory
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- show avatar circles in conversation list and message headers. Use initials as fallback when no avatar is set. Add profile settings panel accessible from the header.

### 3.4 Last seen timestamps (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\user.entity.ts` -- add `@Column({ nullable: true }) lastSeenAt: Date`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.service.ts` -- add `updateLastSeen(userId: number)` method
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- call `updateLastSeen` in `handleDisconnect`. Include `lastSeenAt` in conversation list responses for offline users.
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- show "last seen X minutes ago" under the conversation partner's name when they are offline

### 3.5 Message search (Medium)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.ts` -- add `searchMessages(userId: number, query: string, conversationId?: number): Promise<Message[]>` using ILIKE on content column with conversation access check
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- add `@SubscribeMessage('searchMessages')` handler
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- add a search bar above the messages area (toggle with a search icon). Show results inline with conversation context. Clicking a result scrolls to that message.

### 3.6 File/image sharing (Large)

**Dependency to add:** `uuid` (for unique filenames)

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\uploads\uploads.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\uploads\uploads.controller.ts` -- `POST /uploads` with JwtAuthGuard, FileInterceptor, 10MB limit, allowed types (image/*, pdf, doc, txt)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\uploads\uploads.service.ts` -- file storage logic, generates unique filename, returns URL

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\message.entity.ts` -- add `@Column({ nullable: true }) fileUrl: string` and `@Column({ nullable: true }) fileType: string` (image, document, etc.)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- import UploadsModule
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- update message payloads to include file data
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- add attachment button next to the message input. Upload file via REST, then send message with fileUrl via WebSocket. Render images inline, other files as download links.

### 3.7 Emoji support (Small)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` -- This is purely a frontend feature:
  - Add an emoji picker button next to the message input
  - Build a simple emoji grid popup with common emoji categories (can use a lightweight lib like `emoji-mart` via CDN, or build a simple one with a curated list)
  - Clicking an emoji inserts it at cursor position in the input
  - Ensure the message rendering handles emoji display properly (the RPG pixel font won't render emoji -- use a font-family fallback stack that includes system emoji fonts)

---

## PHASE 4: Production Readiness

### 4.1 Database migrations (Medium)

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\config\typeorm.config.ts` -- TypeORM DataSource config for CLI migrations (separate from app config, reads same env vars)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\migrations\` directory -- generated migration files

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- set `synchronize: false`, set `migrations: ['dist/migrations/*.js']`, set `migrationsRun: true`
- `C:\Users\Lentach\desktop\mvp-chat-app\package.json` -- add scripts:
  - `"typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli"`
  - `"migration:generate": "npm run typeorm -- migration:generate -d src/config/typeorm.config.ts"`
  - `"migration:run": "npm run typeorm -- migration:run -d src/config/typeorm.config.ts"`

### 4.2 Logging framework (Small)

**Dependency to add:** `nestjs-pino`, `pino-pretty` (dev)

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- import `LoggerModule.forRoot({ pinoHttp: { transport: { target: 'pino-pretty' } } })` for dev, structured JSON in production
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- set `app.useLogger(app.get(Logger))` to replace NestJS default logger
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` -- replace all `console.log` calls with injected Logger service

### 4.3 Health check endpoint (Small)

**Dependency to add:** `@nestjs/terminus`

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\health\health.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\health\health.controller.ts` -- `GET /health` endpoint using `HealthCheckService` with `TypeOrmHealthIndicator` to verify DB connection

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\app.module.ts` -- import HealthModule
- `C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml` -- add healthcheck to app service: `test: ["CMD", "curl", "-f", "http://localhost:3000/health"]`

### 4.4 API documentation with Swagger (Small)

**Dependency to add:** `@nestjs/swagger`

**Files to modify:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` -- set up SwaggerModule with `DocumentBuilder`, serve at `/api/docs`
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.controller.ts` -- add `@ApiTags('auth')`, `@ApiOperation`, `@ApiResponse` decorators
- `C:\Users\Lentach\desktop\mvp-chat-app\src\users\users.controller.ts` -- add Swagger decorators
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\register.dto.ts` -- add `@ApiProperty` decorators
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\dto\login.dto.ts` -- add `@ApiProperty` decorators

### 4.5 Unit tests for critical paths (Medium)

**Files to create:**
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.service.spec.ts` -- test register (happy path, duplicate email), login (valid, invalid password, non-existent user), refresh token flow
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.spec.ts` -- test handleConnection (valid token, invalid token, no token), handleMessage (valid, missing content, too-long content, non-existent recipient)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\messages.service.spec.ts` -- test create, findByConversation with pagination, markAsRead
- `C:\Users\Lentach\desktop\mvp-chat-app\src\conversations\conversations.service.spec.ts` -- test findOrCreate (new, existing, reverse order)

Use `@nestjs/testing` with `Test.createTestingModule`. Mock repositories with `getRepositoryToken`.

---

## Dependency Summary

**Phase 1 new npm packages:**
- `@nestjs/config`
- `helmet`
- `@nestjs/throttler`

**Phase 3 new npm packages:**
- `uuid` (for file uploads)

**Phase 4 new npm packages:**
- `nestjs-pino`, `pino-pretty`
- `@nestjs/terminus`
- `@nestjs/swagger`

---

## Risk Notes and Decisions

1. **Single HTML file frontend**: This architecture holds for Phases 1-3 but will become painful. At ~1500+ lines of HTML/JS/CSS in one file, consider splitting the JS into a separate `app.js` file at minimum during Phase 2. This is NOT a framework migration -- just extracting `<script>` content to a separate served static file.

2. **Refresh tokens in memory**: Since the frontend is a single HTML page with no persistent client-side storage strategy, refresh tokens stored only in JS memory will be lost on page refresh. Practical options: (a) use an httpOnly cookie for the refresh token (most secure, requires a small server change), or (b) accept that users re-login on page refresh (acceptable for MVP). Recommendation: httpOnly cookie.

3. **File uploads storage**: For a single-server deployment, local disk storage works. The plan stores files in `src/public/uploads/`. For future scalability, this could move to S3/MinIO, but that is out of scope for this plan.

4. **Database entity changes**: Since `synchronize: true` is on during Phases 1-3, adding columns to entities will auto-create them. Phase 4 disables this and moves to migrations. Run the migration generator against the final schema to create the initial migration.

5. **The RPG theme**: The plan keeps the existing RPG visual identity. The UI improvements in Phase 2 work within the existing aesthetic rather than replacing it. The pixel font limitation for emoji is handled via CSS font-family fallbacks.

---

### Critical Files for Implementation

- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` - Central hub for all real-time features; most modifications across all phases happen here (typing, read receipts, online status, validation, message edit/delete)
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.service.ts` - Must be reworked for refresh token mechanism, the most impactful security change
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` - Single frontend file; every UX feature (typing indicators, read receipts, pagination, mobile responsiveness, emoji) requires changes here
- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` - Bootstrap file where Helmet, CORS, Swagger, Logger, and global filters get registered
- `C:\Users\Lentach\desktop\mvp-chat-app\src\messages\message.entity.ts` - Entity that needs readAt, editedAt, isDeleted, fileUrl columns added across multiple phases