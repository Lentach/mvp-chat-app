# Explore: Explore codebase structure and key files

> Session: `3c20d712-bc58-404e-8c84-5725baedcdb4`
> Date: 2026-01-30
> Tokens: ~40,278

---

Perfect! Now I have all the information needed. Let me compile a comprehensive report of the codebase structure.

## Comprehensive Codebase Map - MVP Chat Application

### Project Overview
An MVP 1-on-1 chat application built with:
- **Backend**: NestJS (TypeScript) with TypeORM + PostgreSQL
- **Frontend**: Flutter (web, Android, iOS)
- **Real-time Communication**: WebSocket (Socket.IO)
- **Authentication**: JWT + bcrypt
- **Deployment**: Docker Compose

---

## Backend Structure (`/backend/src/`)

### Root Application Files
- **`app.module.ts`** — Main NestJS module importing all feature modules; configures TypeORM with PostgreSQL connection (host, port, credentials from env vars); enables auto-schema synchronization (dev mode)
- **`main.ts`** — Bootstrap entry point; initializes NestJS app with ValidationPipe (whitelist DTO properties); enables CORS; listens on PORT (default 3000)

### Core Modules

#### 1. **Auth Module** (`auth/`)
Handles user registration and login with JWT authentication.

**Files:**
- **`auth.module.ts`** — Imports PassportModule, JwtModule (configures JWT secret from env); exports AuthService
- **`auth.service.ts`** — RegisterDto/LoginDto validation; calls UsersService for signup; compares password hash on login; generates JWT token
- **`auth.controller.ts`** — Two REST endpoints:
  - `POST /auth/register` — Accepts email, username, password; validates; returns user (id, email, username)
  - `POST /auth/login` — Accepts email, password; returns JWT access_token
- **`jwt-auth.guard.ts`** — NestJS Guard for protecting routes (JWT verification)
- **`strategies/jwt.strategy.ts`** — Passport JWT strategy; extracts token from request; verifies and decodes JWT payload (sub=userId, email)

**DTOs:**
- **`dto/register.dto.ts`** — email (unique), username (unique, 1-50 chars), password (min 6 chars)
- **`dto/login.dto.ts`** — email, password

---

#### 2. **Users Module** (`users/`)
Manages user entity and basic user operations.

**Files:**
- **`users.module.ts`** — Exports UsersService (injected dependency for Auth, Chat, Friends modules)
- **`users.service.ts`** — Methods:
  - `create(email, username, password)` — Hashes password with bcrypt; saves to DB
  - `findByEmail(email)` — Queries user by email
  - `findById(id)` — Queries user by id
  - All methods called by Auth, Chat, and Friends services
- **`user.entity.ts`** — TypeORM entity:
  - Columns: id (PK), email (unique), username (unique), password (hashed), createdAt
  - Relations: None defined in entity (referenced as FK by other entities)

---

#### 3. **Friends Module** (`friends/`)
Manages friend requests system with acceptance/rejection logic.

**Files:**
- **`friends.module.ts`** — Exports FriendsService (injected into ChatGateway)
- **`friends.service.ts`** — Core friend request logic (9 methods):
  - `sendRequest(senderUserId, recipientEmail)` — Creates PENDING FriendRequest; checks for reverse pending request (mutual auto-accept); uses `relations: ['sender', 'receiver']` in queries
  - `acceptRequest(requestId, userId)` — Validates receiver; updates FriendRequest to ACCEPTED; includes relations for sender/receiver data
  - `rejectRequest(requestId, userId)` — Validates receiver; updates FriendRequest to REJECTED; includes relations
  - `areFriends(userId1, userId2)` — Boolean check for ACCEPTED FriendRequest (either direction); used before sending messages
  - `unfriend(userId1, userId2)` — **Uses find-then-remove pattern** (not .delete()) to handle bidirectional deletion of ACCEPTED FriendRequests; required because TypeORM `.delete()` cannot resolve relation conditions
  - `getPendingRequests(userId)` — Returns array of pending FriendRequests where user is receiver; includes relations
  - `getFriends(userId)` — Returns array of accepted friends (User objects); includes relations
  - `getPendingRequestCount(userId)` — Returns count of pending requests for badge
- **`friend-request.entity.ts`** — TypeORM entity:
  - Columns: id (PK), status (enum: PENDING, ACCEPTED, REJECTED), createdAt, respondedAt (nullable)
  - Relations: sender (FK→User, eager, CASCADE DELETE), receiver (FK→User, eager, CASCADE DELETE)
  - **Important**: No unique constraint on (sender_id, receiver_id) — allows resend after rejection

---

#### 4. **Conversations Module** (`conversations/`)
Manages conversation records linking two users.

**Files:**
- **`conversations.module.ts`** — Exports ConversationsService (injected into ChatGateway)
- **`conversations.service.ts`** — Methods:
  - `findOrCreate(userOne, userTwo)` — Queries for existing conversation (checks both directions); creates new record if not found; prevents duplicates
  - `delete(conversationId)` — Deletes conversation; cascades to delete all messages via TypeORM CASCADE
  - Called by ChatGateway for conversation operations
- **`conversation.entity.ts`** — TypeORM entity:
  - Columns: id (PK), createdAt
  - Relations: userOne (FK→User, eager), userTwo (FK→User, eager)
  - No unique constraint on user pair — deduplication done in `findOrCreate` method

---

#### 5. **Messages Module** (`messages/`)
Handles message storage and retrieval.

**Files:**
- **`messages.module.ts`** — Exports MessagesService (injected into ChatGateway)
- **`messages.service.ts`** — Methods:
  - `create(conversationId, senderId, content)` — Saves message to DB
  - `findByConversation(conversationId, limit=50)` — Queries last N messages (oldest first)
- **`message.entity.ts`** — TypeORM entity:
  - Columns: id (PK), content (text), createdAt
  - Relations: sender (FK→User, eager), conversation (FK→Conversation, lazy)

---

#### 6. **Chat Module** (`chat/`)
Real-time WebSocket gateway handling all socket events.

**Files:**
- **`chat.module.ts`** — Imports NestJS WebSocket modules; exports ChatGateway
- **`chat.gateway.ts`** — **Core of real-time communication** (28KB file, comprehensive):
  - **Gateway Setup**: `@WebSocketGateway()` with Socket.IO; stores online users in `Map<userId, socketId>` for presence tracking
  - **Connection Lifecycle**:
    - `handleConnection(client)` — Extracts JWT from query param `?token=XXX`; verifies token; maps userId to socketId; emits initial data (conversations, friends, pending requests count)
    - `handleDisconnect(client)` — Removes user from online map
  - **WebSocket Event Handlers** (14 @SubscribeMessage handlers):
    1. **`sendMessage`** — Payload: {recipientId, content}; checks `areFriends()`; finds/creates conversation; saves message; emits `messageSent` to sender, `newMessage` to recipient (if online)
    2. **`startConversation`** — Legacy/alternate conversation opener
    3. **`getMessages`** — Payload: {conversationId}; returns last 50 messages; emits `messageHistory`
    4. **`getConversations`** — Returns user's conversations; emits `conversationsList`
    5. **`deleteConversation`** — Payload: {conversationId}; **NOW calls `unfriend()` BEFORE deleting** to clean up FriendRequest; emits `unfriended` to other user; refreshes conversations and friends lists for both; added in latest fix (Round 5)
    6. **`sendFriendRequest`** — Payload: {recipientEmail}; calls `friendsService.sendRequest()`; emits `friendRequestSent` to sender; emits `newFriendRequest` + `pendingRequestsCount` to recipient; on mutual auto-accept: emits acceptance events + `openConversation` to both
    7. **`acceptFriendRequest`** — Payload: {requestId}; validates authorization; calls `acceptRequest()`; creates conversation via `findOrCreate()`; emits `friendRequestAccepted` + `conversationsList` + `friendsList` + `openConversation` + `friendRequestsList` + `pendingRequestsCount` to both users; **includes relations: ['sender', 'receiver']** (Round 3 fix)
    8. **`rejectFriendRequest`** — Payload: {requestId}; validates receiver; calls `rejectRequest()`; emits `friendRequestRejected` + `friendRequestsList` + `pendingRequestsCount` to receiver only
    9. **`getFriendRequests`** — Returns pending FriendRequests for user; emits `friendRequestsList` + `pendingRequestsCount`
    10. **`getFriends`** — Returns list of accepted friends; emits `friendsList`
    11. **`unfriend`** — Payload: {userId}; calls `unfriend()` (two-way deletion); emits `unfriended` to both; refreshes conversations and friends lists
    12-14. **Other handlers** — Helper/legacy endpoints
  - **Error Handling**: Single try/catch per handler; if any step fails, subsequent emits skipped (critical gotcha documented in CLAUDE.md)
  - **Diagnostic Logging**: Console.log statements for debugging friend requests and unfriend operations

---

### Configuration Files

**Backend Root:**
- **`package.json`** — Dependencies: NestJS 11, TypeORM, Socket.IO, JWT, Passport, bcrypt, PostgreSQL driver; Scripts: build, start:dev, lint, test
- **`tsconfig.json`** — ES2023 target, moduleResolution: nodenext, decorators enabled, outDir: ./dist
- **`nest-cli.json`** — NestJS CLI config; sourceRoot: src; deleteOutDir: true
- **`eslint.config.mjs`** — ESLint configuration
- **`.prettierrc`** — Code formatting rules
- **`Dockerfile`** — Multi-stage build for backend (Node.js base, npm install, build, run)

### Database

**TypeORM Configuration** (in `app.module.ts`):
- **Database**: PostgreSQL (host/port/credentials from env)
- **Entities**: User, Conversation, Message, FriendRequest
- **Synchronize**: true (auto-creates tables in dev; disable in production)
- **Relations**: Eager loading on User/FriendRequest; lazy on Conversation.messages

**Tables:**
- `users` — id, email, username, password, createdAt
- `conversations` — id, user_one_id, user_two_id, createdAt
- `messages` — id, content, sender_id, conversation_id, createdAt
- `friend_requests` — id, sender_id, receiver_id, status, createdAt, respondedAt

---

## Frontend Structure (`/frontend/lib/`)

### Root Entry Point
- **`main.dart`** — Initializes Flutter app; creates MultiProvider with AuthProvider + ChatProvider; sets up MaterialApp with RpgTheme; renders AuthGate (conditional login/main screen)

### Core Directories

#### 1. **Providers** (`providers/`)
State management using Provider (ChangeNotifier pattern).

**Files:**
- **`auth_provider.dart`** — Authentication state:
  - Properties: `_token`, `_userId`, `_email`, `_isLoggedIn`
  - Methods:
    - `login(email, password)` — Calls ApiService; stores JWT; decodes token; saves to SharedPreferences; sets isLoggedIn=true
    - `register(email, username, password)` — Calls ApiService; auto-logs in
    - `logout()` — Clears token and SharedPreferences
    - `restoreToken()` — Called on app start; restores token from SharedPreferences; validates expiry via JwtDecoder
  - State notifies all listeners on changes
- **`chat_provider.dart`** — Real-time chat state (extensive, 200+ lines):
  - Properties:
    - `_conversations` — List of ConversationModel
    - `_messages` — Map<conversationId, List<MessageModel>>
    - `_activeConversationId` — Currently viewing conversation
    - `_friendRequests` — List of pending FriendRequestModel
    - `_pendingRequestsCount` — Badge count (int)
    - `_friends` — List of accepted friends (UserModel[])
    - `_pendingOpenConversationId` — For auto-navigation (set by backend `openConversation` event)
  - Methods:
    - `connect(token)` — Initializes Socket.IO client; registers all WebSocket event listeners; calls initial data fetch methods; **critical: includes all event callbacks for real-time updates**
    - `sendMessage(recipientId, content)` — Emits `sendMessage` event
    - `openConversation(conversationId)` — Sets activeConversationId; emits `getMessages` to load history
    - `consumePendingOpen()` — Returns and clears `_pendingOpenConversationId` (used by screens for navigation)
    - `sendFriendRequest(recipientEmail)` — Emits `sendFriendRequest` event
    - `acceptFriendRequest(requestId)` — Emits `acceptFriendRequest` event
    - `rejectFriendRequest(requestId)` — Emits `rejectFriendRequest` event
    - `fetchConversations()` — Emits `getConversations` event
    - `fetchMessages(conversationId)` — Emits `getMessages` event
    - `fetchFriendRequests()` — Emits `getFriendRequests` event
    - `fetchFriends()` — Emits `getFriends` event
    - `deleteConversation(conversationId)` — Emits `deleteConversation` event
    - `unfriend(userId)` — Emits `unfriend` event
    - Event Callbacks (called by SocketService):
      - `onConversationsList()`, `onMessageHistory()`, `onNewMessage()`, `onFriendRequestsList()`, `onPendingRequestsCount()`, `onFriendsList()`, `onOpenConversation()`, `onUnfriended()`, etc.
  - **Navigation Pattern**: `consumePendingOpen()` returns pending conversationId set by backend `openConversation` event; used by screens to auto-navigate

---

#### 2. **Models** (`models/`)
Data models (Dart classes with JSON parsing).

**Files:**
- **`user_model.dart`** — UserModel: id, email, username
- **`conversation_model.dart`** — ConversationModel: id, userOne (UserModel), userTwo (UserModel), createdAt; methods: `getOtherUser(currentUserId)`, `fromJson()`
- **`message_model.dart`** — MessageModel: id, content, sender (UserModel), conversationId, createdAt; method: `fromJson()`
- **`friend_request_model.dart`** — FriendRequestModel: id, sender (UserModel), receiver (UserModel), status (String: "pending"/"accepted"/"rejected"), createdAt; method: `fromJson()`

---

#### 3. **Services** (`services/`)
Low-level API/WebSocket communication.

**Files:**
- **`api_service.dart`** — REST client (using http package):
  - `baseUrl` — Defaults to `http://localhost:3000`; uses `AppConfig.baseUrl` on web builds
  - Methods:
    - `register(email, username, password)` — POST /auth/register
    - `login(email, password)` — POST /auth/login; returns {access_token}
    - Returns JSON responses as Map<String, dynamic>
- **`socket_service.dart`** — Socket.IO wrapper (using socket_io_client package):
  - `connect(token, onData callbacks)` — Initializes Socket.IO client with `?token=XXX` query param; registers all event listeners (17 events: conversationsList, messageHistory, newMessage, friendRequestsList, pendingRequestsCount, friendsList, openConversation, messageSent, newMessage, friendRequestSent, friendRequestAccepted, friendRequestRejected, unfriended, etc.); passes callbacks to ChatProvider
  - `emit(event, data)` — Sends event to server
  - Lifecycle: `connect()` called once; disconnects on logout

---

#### 4. **Screens** (`screens/`)
Full-screen UI widgets representing app routes.

**Files:**

**`auth_screen.dart`** — Login/Register screen:
- Displays RPG-themed title ("RPG Chat") with Press Start 2P font
- Two tab sections: Login form and Register form
- Uses `auth_form.dart` widget for input fields
- Methods:
  - `_login(email, password)` — Calls `AuthProvider.login()`; navigates to ConversationsScreen on success
  - `_register(email, username, password)` — Calls `AuthProvider.register()`; navigates to ConversationsScreen on success

**`conversations_screen.dart`** — Main hub (11KB file):
- **Responsive layout**: LayoutBuilder checks width >=600px
  - Mobile (<600px): ListView of conversation tiles; tapping pushes ChatDetailScreen
  - Desktop (>=600px): SplitView (left: conversation list, right: embedded ChatDetailScreen)
- **Components**:
  - Top AppBar with logout button + friend request badge (red counter)
  - Conversation list with avatar circles and last message (client-side tracking)
  - Floating action buttons: "New Chat" (green) + "Friend Requests" (red badge)
- **Navigation**:
  - Tapping conversation: mobile = push ChatDetailScreen, desktop = set activeConversationId
  - "Friend Requests" button: async push to FriendRequestsScreen; awaits return value (conversationId); calls `_openChat()` if result is not null
  - "New Chat" button: async push to NewChatScreen; awaits return value (conversationId); calls `_openChat()` if result is not null
- **Methods**:
  - `_openChat(conversationId)` — Sets active conversation; conditionally pushes ChatDetailScreen (mobile only)
  - `_openFriendRequests()` — Awaits FriendRequestsScreen push result
  - `_startNewChat()` — Awaits NewChatScreen push result
  - Uses ChatProvider listeners for real-time updates

**`chat_detail_screen.dart`** — Full chat view (7KB):
- Displays conversation with another user
- Components:
  - AppBar with avatar, username, unfriend PopupMenu button
  - Messages list (bubbles with sender color coding)
  - InputBar for typing and sending
- **Methods**:
  - `_sendMessage()` — Calls ChatProvider.sendMessage()
  - `_unfriend()` — Confirms action; calls ChatProvider.unfriend(); pops to ConversationsScreen
- Parameters: Optional conversationId (if provided, opens that conversation)

**`friend_requests_screen.dart`** — Manage pending friend requests (7KB):
- Full-screen UI (push route) for accepting/rejecting requests
- **Critical Navigation Pattern**: Monitors `consumePendingOpen()` to auto-navigate after accept
  - Uses `_navigatingToChat` flag to prevent double-pop
  - On accept: backend emits `openConversation`; provider sets `_pendingOpenConversationId`; screen's `build()` calls `consumePendingOpen()`; calls `Navigator.pop(conversationId)`
- **Components**:
  - List of pending FriendRequests (sender avatar, email, accept/reject buttons)
  - Red badge showing count
- **Methods**:
  - `_acceptRequest(requestId)` — Calls ChatProvider.acceptFriendRequest()
  - `_rejectRequest(requestId)` — Calls ChatProvider.rejectFriendRequest()

**`new_chat_screen.dart`** — Send friend request by email (4KB):
- Full-screen UI (push route) for initiating new chats
- **Form**: Email input field
- **Submission**: 
  - Calls ChatProvider.sendFriendRequest()
  - Shows SnackBar
  - Monitors `consumePendingOpen()` for mutual auto-accept navigation (no `_navigatingToChat` guard; uses `mounted` check)
  - Pops with conversationId if mutual accept detected
- **Methods**:
  - `_sendRequest(email)` — Emits `sendFriendRequest` event

**`settings_screen.dart`** — Settings/profile screen (not actively used in main flow)

---

#### 5. **Widgets** (`widgets/`)
Reusable UI components.

**Files:**
- **`auth_form.dart`** — Reusable form for email/password input; used by AuthScreen for both login and register sections
- **`avatar_circle.dart`** — Circular avatar display; shows user initials or default avatar
- **`chat_input_bar.dart`** — Message input field with send button; handles text input and submission
- **`chat_message_bubble.dart`** — Message bubble UI (sender = right-aligned blue, receiver = left-aligned gray); includes timestamp
- **`conversation_tile.dart`** — Conversation list item; shows avatar, other user's name, last message preview, timestamp; tappable
- **`message_date_separator.dart`** — Date divider between message groups (e.g., "Jan 30")

---

#### 6. **Theme** (`theme/`)
- **`rpg_theme.dart`** — Comprehensive Material theme:
  - **Colors**: Background (#0A0A2E), Gold (#FFCC00), Purple (#7B7BF5), Border (#4A4AE0)
  - **Fonts**:
    - `pressStart2P()` — Retro bitmap font (Press Start 2P) for titles/headers/logos
    - `bodyFont()` — Inter font (readable) for body text, messages, form fields
  - **ThemeData**: Defines all Material colors, text styles, input decoration, button styling
  - **Border Radius**: 8px for inputs, 16px for bubbles

---

#### 7. **Config** (`config/`)
- **`app_config.dart`** — Configuration constants:
  - `baseUrl` — API base URL; defaults to `http://localhost:3000`; uses `Uri.base.origin` on web for Docker/nginx compatibility

---

### Configuration Files

**Frontend Root:**
- **`pubspec.yaml`** — Flutter project manifest:
  - Dependencies: flutter, provider, socket_io_client, http, google_fonts, jwt_decoder, shared_preferences, cupertino_icons
  - SDK: >=3.10.7
- **`analysis_options.yaml`** — Dart linter configuration
- **`Dockerfile`** — Multi-stage Flutter web build (Node.js base, Flutter setup, build, nginx serve)
- **`nginx.conf`** — Nginx config for serving built Flutter web app; proxies /api/* and /socket.io/* to backend
- **`README.md`** — Quick Flutter project notes

### Test Files
- **`test/widget_test.dart`** — Sample Flutter widget test (boilerplate)

---

## Root Project Files

- **`package.json`** — Minimal root package (dependencies: axios, socket.io-client; used by test scripts)
- **`docker-compose.yml`** — Orchestrates three services:
  - `db` — PostgreSQL 16-alpine (port 5433, persistent pgdata volume)
  - `backend` — NestJS app (port 3000, depends on db)
  - `frontend` — Flutter web via nginx (port 8080, depends on backend)
- **`CLAUDE.md`** — Comprehensive project documentation (27KB):
  - Architecture overview
  - WebSocket event reference table
  - Data flows for key operations (friend requests, mutual auto-accept, unfriend)
  - Critical gotchas (TypeORM relations, .delete() limitations, error handling)
  - Bug fix history (5 rounds of fixes, detailed explanations)
  - Quick reference guide for common modifications
- **`README.md`** — High-level project description

---

## Test Files

**In Root:**
- **`test-complete-flow.js`** — End-to-end test script (Node.js with socket.io-client)
- **`test-delete-conversation-fix.js`** — Specific test for deleteConversation fix
- **`test-friend-requests.js`** — Friend request system integration tests
- **`test-friend-system.js`** — Comprehensive friend system tests
- **`backend/test-friends.js`** — Friends module unit tests
- **`backend/test/app.e2e-spec.ts`** — NestJS e2e test template

**Frontend:**
- **`frontend/test/widget_test.dart`** — Boilerplate Flutter widget test

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Backend TypeScript files | 28 files across 7 modules |
| Frontend Dart files | 21 files across 6 categories |
| Configuration files | 10+ (docker-compose, pubspec.yaml, tsconfig, etc.) |
| Test files | 6+ test scripts |
| Total source files | ~60+ files |

---

## Key Architectural Patterns

1. **Monolithic Backend**: Single NestJS app with feature modules (Auth, Users, Friends, Conversations, Messages, Chat)
2. **WebSocket-First Communication**: All chat operations via Socket.IO; only auth uses REST
3. **Provider State Management**: Flutter uses ChangeNotifier pattern with two global providers (Auth, Chat)
4. **Responsive UI**: Desktop (>=600px) uses master-detail; mobile (<600px) uses stacked navigation
5. **Reactive Navigation**: `consumePendingOpen()` pattern for backend-initiated navigation
6. **Eager/Lazy Relations**: TypeORM entities configured with appropriate relation loading strategies
7. **Find-Then-Remove**: Used for deletions involving FK conditions (TypeORM limitation workaround)
8. **JWT with Query Param**: Socket.IO connection verified via `?token=XXX` query parameter

This structure supports rapid iteration on the MVP while maintaining clean separation of concerns across backend modules and frontend feature areas.