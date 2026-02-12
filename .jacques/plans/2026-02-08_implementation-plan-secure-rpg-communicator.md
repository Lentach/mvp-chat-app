# Implementation Plan: Secure RPG Communicator

Based on CLAUDE.md plan + user's vision: campfire scene with customizable pixel-art avatars, mobile-first, eventual E2E encryption.

## Decision log
- **Sprites**: Procedural (CSS/Canvas) initially, designed for easy swap to sprite sheets later
- **Frontend stack**: Decide before Phase 2 (vanilla JS vs framework). Phase 1 doesn't touch frontend significantly.
- **E2E encryption**: Deferred to post-Phase 4. Message `content` field treated as opaque string to ease future migration.

---

## Phase 1: Security Hardening

Execute exactly as described in CLAUDE.md sections 1.1–1.8. No changes to the plan.

**Summary of work:**
1. `@nestjs/config` — centralized config, `.env.example`, remove hardcoded secrets
2. Helmet — HTTP security headers
3. CORS lockdown — configured origin instead of `*`
4. `@nestjs/throttler` — rate limiting on auth endpoints + global
5. Input validation — WebSocket message validators
6. Refresh tokens — token rotation, 15min access / 7d refresh
7. WebSocket auth cleanup — `auth.token` only, remove query param fallback
8. Error handling — HTTP + WS exception filters, no stack traces leaked

**Install**: `npm install @nestjs/config helmet @nestjs/throttler`

**Files to create:**
- `src/config/configuration.ts`
- `.env.example`
- `src/common/validators.ts`
- `src/auth/entities/refresh-token.entity.ts`
- `src/auth/dto/refresh-token.dto.ts`
- `src/common/filters/http-exception.filter.ts`
- `src/common/filters/ws-exception.filter.ts`

**Files to modify:**
- `src/app.module.ts` — ConfigModule, ThrottlerModule, RefreshToken entity
- `src/main.ts` — helmet, CORS, global filter
- `src/auth/auth.module.ts` — JwtModule.registerAsync, 15min expiry, RefreshToken entity
- `src/auth/auth.service.ts` — refresh/logout logic, return refresh token from login
- `src/auth/auth.controller.ts` — POST /auth/refresh, POST /auth/logout, @Throttle
- `src/auth/strategies/jwt.strategy.ts` — ConfigService injection
- `src/chat/chat.gateway.ts` — validators, auth.token only, CORS from config, UseFilters
- `docker-compose.yml` — env_file, remove hardcoded secrets
- `.gitignore` — add .env
- `src/public/index.html` — refresh token flow, auth.token for socket

**Verify:** `docker-compose up --build`, register+login works, 6th rapid login → 429, response has helmet headers, refresh flow works.

---

## Phase 2: Core UX + Avatar System + Campfire Scene

### 2.1 Avatar data model & builder
**Backend:**
- Modify `src/users/user.entity.ts` — add fields:
  ```
  displayName: string (nullable)
  avatarRace: string (nullable) — 'human' | 'orc' | 'elf' | 'dwarf' | 'undead'
  avatarColor: string (nullable) — hex color for primary tint
  avatarAccessory: string (nullable) — 'none' | 'helmet' | 'hood' | 'crown' | 'horns'
  ```
- Create `src/users/dto/update-profile.dto.ts` — displayName, avatarRace, avatarColor, avatarAccessory
- Create `src/users/users.controller.ts` — GET /users/me, PATCH /users/me (with JwtAuthGuard)
- Modify `src/users/users.module.ts` — add controller
- Modify `src/auth/dto/register.dto.ts` — optional displayName
- Modify `src/auth/auth.service.ts` — pass displayName to create

**Frontend (avatar builder screen):**
- Character creation screen shown after first login (if no avatarRace set)
- Grid of race options with pixel-art preview (procedural CSS)
- Color picker (preset palette of 8-12 RPG-appropriate colors)
- Accessory selector
- Preview of avatar in real-time
- "Confirm" saves via PATCH /users/me

### 2.2 Campfire chat scene
**Core concept:** Instead of plain message list, the chat view shows:
- Top area (~40% of screen): Canvas/CSS scene with campfire center, two avatar positions (left/right of fire)
- Bottom area (~60%): Message bubbles + input bar

**Scene elements (procedural/CSS initially):**
- Campfire: animated CSS sprite (flickering flame, 3-4 frame loop)
- Avatar positions: left seat (current user), right seat (other user)
- Each avatar rendered based on their race/color/accessory data
- Status indicators:
  - Typing → speech bubble with animated "..." above avatar
  - AFK/offline → avatar grayed out or sleeping animation (zzZ)
  - Online → avatar in normal idle animation (subtle breathing/bob)
- Dark background with subtle star particles (CSS)

**Implementation approach:**
- Pure CSS + minimal JS for animations (no canvas needed for this complexity)
- CSS custom properties for avatar colors
- CSS animations for fire, idle bob, typing indicator
- Sprite-swap-ready: each avatar part is a separate CSS class, easily replaceable with background-image sprite sheet later

### 2.3 Online/offline status
- Modify `src/chat/chat.gateway.ts`:
  - Track `Map<userId, Set<socketId>>` (multi-device support)
  - Broadcast `userOnline` / `userOffline` events
  - `getOnlineUsers` handler
  - Include `isOnline` in conversation list
- Frontend: avatar state changes (normal vs grayed) based on online status

### 2.4 Typing indicators
- Modify `src/chat/chat.gateway.ts` — `typing` / `stopTyping` events relayed to other party
- Frontend: debounce input (300ms), show speech bubble with "..." over other user's avatar

### 2.5 Read receipts + unread count
- Modify `src/messages/message.entity.ts` — add `readAt: Date | null`
- Modify `src/messages/messages.service.ts` — `markAsRead()`, `getUnreadCount()`
- Modify `src/chat/chat.gateway.ts` — `markRead` handler, emit `messagesRead`
- Frontend: auto-mark-read when viewing conversation, badge on conversation list

### 2.6 Message pagination (cursor-based)
- Modify `src/messages/messages.service.ts` — cursor-based query with `before` param
- Modify `src/chat/chat.gateway.ts` — updated getMessages handler
- Frontend: scroll-to-top loads older messages

### 2.7 Sound notifications
- Web Audio API oscillator beep on newMessage when tab hidden or different conversation
- Mute toggle in header, persisted to localStorage

### 2.8 Mobile-responsive layout
- Mobile-first design: sidebar and chat as separate views with navigation
- Campfire scene scales down proportionally on small screens
- Touch-friendly targets (min 44px)
- Back button to return to conversation list on mobile

**Files to create (Phase 2):**
- `src/users/users.controller.ts`
- `src/users/dto/update-profile.dto.ts`

**Files to modify (Phase 2):**
- `src/users/user.entity.ts` — avatar fields
- `src/users/users.module.ts` — controller
- `src/users/users.service.ts` — update profile method
- `src/auth/dto/register.dto.ts` — optional displayName
- `src/auth/auth.service.ts` — pass displayName
- `src/messages/message.entity.ts` — readAt
- `src/messages/messages.service.ts` — pagination, markAsRead, unreadCount
- `src/chat/chat.gateway.ts` — online status, typing, read receipts, pagination
- `src/public/index.html` — avatar builder, campfire scene, mobile layout, typing, read receipts, pagination, sound

**Verify:** Avatar builder works, campfire scene renders with two avatars, typing shows bubble, read receipts update, pagination loads older messages, mobile layout toggles between sidebar/chat.

---

## Phase 3: Essential Chat Features

### 3.1 Message editing and deletion
- Modify message entity — `editedAt`, `isDeleted` fields
- Modify messages service — edit/delete with sender verification
- Gateway handlers + broadcast
- Frontend: long-press context menu on own messages, "(edited)" label, "[Message deleted]"

### 3.2 User search/discovery
- Users service — `searchByEmail()` ILIKE query
- Users controller — GET /users/search?q= (guarded)
- Frontend: search input with debounced fetch, click to start conversation

### 3.3 User avatars (profile pictures — optional alongside procedural avatars)
- Skip traditional file upload avatars — the procedural RPG avatar IS the avatar
- Render mini avatar (race/color/accessory) as 32px icon in conversation list
- No file upload needed at this stage

### 3.4 Last seen timestamps
- User entity — `lastSeenAt` field
- Gateway — update on disconnect
- Frontend: "last seen X ago" under avatar in campfire scene

### 3.5 Message search
- Messages service — full-text search across user's conversations
- Gateway handler
- Frontend: search bar, results with conversation context

### 3.6 File/image sharing
- Create uploads module (MulterModule, 10MB limit, validation)
- Message entity — `fileUrl`, `fileType` fields
- Frontend: attachment button, inline image preview, download links

### 3.7 Emoji support
- Inline emoji picker (no external lib), common emoji grid
- Insert at cursor position

**Verify:** Edit/delete works, search users, upload image displays inline, emoji picker inserts correctly.

---

## Phase 4: Production Readiness

### 4.1 Database migrations
- TypeORM CLI config, migration scripts, `synchronize: false`

### 4.2 Logging (nestjs-pino)
- Structured logging replacing all console.log

### 4.3 Health check
- GET /health with TypeORM indicator

### 4.4 Swagger API docs
- All controllers and DTOs decorated

### 4.5 Unit tests
- Auth, chat gateway, messages, conversations services

### 4.6 PWA
- manifest.json, service worker, offline caching
- Installable on phones — this is critical for the "smartphone communicator" goal

**Verify:** Health endpoint works, Swagger loads, tests pass, PWA install prompt appears, app works from home screen.

---

## Post-Phase 4: E2E Encryption (future)

Not in scope now, but design considerations baked in:
- `content` field stays as opaque text (will hold ciphertext later)
- No server-side content indexing/search that would break with encryption
- Message search (3.5) will need to move client-side when encryption is added
- Key exchange and device management to be designed separately

---

## Verification checklist (after each phase)

1. `docker-compose up --build` — no errors
2. Register + login works
3. Two-tab messaging works
4. Phase-specific checks as listed above
