# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY RULE: Keep This File Up To Date

**After EVERY code change (bug fix, new feature, refactor, config change), update this file immediately.** This is the single source of truth for future agents. Update the relevant sections: architecture, data flows, bug fixes, gotchas. A future agent must be able to read ONLY this file and understand the current state of the project without reading every source file.

## Project

MVP 1-on-1 chat application. NestJS backend + Flutter frontend + PostgreSQL + WebSocket (Socket.IO) + JWT auth + Docker.

## Project Structure

```
mvp-chat-app/
  backend/         # NestJS app (API + WebSocket)
  frontend/        # Flutter app (web, Android, iOS)
  docker-compose.yml
  README.md
  CLAUDE.md
```

## Commands

### Backend
```bash
cd backend
npm run build          # Compile TypeScript
npm run start:dev      # Run with hot-reload (needs local PostgreSQL)
npm run start          # Run compiled version
npm run lint           # ESLint
```

### Frontend
```bash
cd frontend
flutter pub get        # Install dependencies
flutter run -d chrome  # Run in Chrome (dev mode, backend on :3000)
flutter build web      # Build for production
```

### Docker (recommended)
```bash
docker-compose up --build   # Run PostgreSQL + backend + frontend
# Backend: http://localhost:3000
# Frontend: http://localhost:8080
```

## Architecture

**Backend — Monolith NestJS app** with these modules:

- `AuthModule` — registration (POST /auth/register) and login (POST /auth/login) with JWT. Uses Passport + bcrypt.
- `UsersModule` — User entity and service. Shared dependency for Auth, Chat, Friends.
- `FriendsModule` — Friend request system. FriendRequest entity + FriendsService with authorization logic.
- `ConversationsModule` — Conversation entity linking two users. findOrCreate pattern prevents duplicates.
- `MessagesModule` — Message entity with content, sender, conversation FK.
- `ChatModule` — WebSocket Gateway (Socket.IO). Handles real-time messaging + friend requests. Verifies JWT on connection via query param `?token=`.

**Frontend — Flutter app** with Provider state management:

- `providers/auth_provider.dart` — JWT token, login/register/logout, persists token via SharedPreferences.
- `providers/chat_provider.dart` — conversations list, messages, active conversation, friend requests, pending count, friends list, socket events. Has `consumePendingOpen()` for navigation after async WebSocket responses.
- `services/api_service.dart` — REST calls to /auth/register, /auth/login.
- `services/socket_service.dart` — Socket.IO wrapper for real-time events + friend request events.
- `screens/auth_screen.dart` — Login/register UI with RPG title, modern Material form.
- `screens/conversations_screen.dart` — Main hub: conversation list (mobile) or master-detail (desktop >=600px). Has friend request badge with red counter. Awaits return value from FriendRequestsScreen and NewChatScreen to auto-open chat.
- `screens/chat_detail_screen.dart` — Full chat view with messages and input bar. Used standalone (mobile) or embedded (desktop). Has unfriend PopupMenu button.
- `screens/new_chat_screen.dart` — Send friend request by email. Monitors `consumePendingOpen()` for mutual auto-accept navigation.
- `screens/friend_requests_screen.dart` — Full screen for managing pending friend requests. Accept/reject buttons. Monitors `consumePendingOpen()` and pops with conversationId to auto-open chat after accept.
- `models/friend_request_model.dart` — FriendRequest model with fromJson parsing.
- `theme/rpg_theme.dart` — Colors, ThemeData, `pressStart2P()` for titles, `bodyFont()` (Inter) for body text.

## Data Flows

### Friend Request Send (standard)
1. User A opens NewChatScreen, enters User B email, clicks Send
2. Frontend emits `sendFriendRequest` with `{recipientEmail}`
3. Backend creates PENDING FriendRequest in DB
4. Backend emits `friendRequestSent` to User A, `newFriendRequest` + `pendingRequestsCount` to User B (if online)
5. NewChatScreen shows SnackBar and pops after 500ms

### Friend Request Accept (standard) — auto-opens chat
1. User B opens FriendRequestsScreen, clicks Accept
2. Frontend emits `acceptFriendRequest` with `{requestId}`
3. Backend: acceptRequest() updates status to ACCEPTED (with `relations: ['sender', 'receiver']`)
4. Backend: emits `friendRequestAccepted` to both users
5. Backend: creates conversation via `findOrCreate(senderUser, receiverUser)`
6. Backend: emits `conversationsList` to both users
7. Backend: emits `friendRequestsList` + `pendingRequestsCount` to accepting user
8. Backend: emits `friendsList` to both users
9. Backend: emits `openConversation` with `{conversationId}` to both users
10. Frontend ChatProvider: `onOpenConversation` sets `_pendingOpenConversationId`, calls `notifyListeners()`
11. FriendRequestsScreen: `build()` calls `consumePendingOpen()`, gets conversationId, calls `Navigator.pop(conversationId)`
12. ConversationsScreen: receives return value from `_openFriendRequests()`, calls `_openChat(conversationId)`
13. Chat opens (push on mobile, embedded on desktop)

### Mutual Auto-Accept — auto-opens chat for both
1. User A sends request to User B, User B sends request to User A (before seeing A's request)
2. Backend `sendRequest()` detects reverse pending request, auto-accepts BOTH
3. Backend creates conversation via `findOrCreate(sender, recipient)`
4. Backend emits to both: `friendRequestAccepted`, `friendsList`, `conversationsList`, `openConversation`, `pendingRequestsCount`
5. Both users get auto-navigated to chat via `consumePendingOpen()` pattern

### Sending a Message
1. Frontend checks active conversation, determines recipientId
2. Frontend emits `sendMessage` with `{recipientId, content}`
3. Backend checks `areFriends(senderId, recipientId)` — if false: emit error
4. Backend finds/creates conversation, saves message
5. Backend emits `messageSent` to sender, `newMessage` to recipient (if online)

## Navigation Pattern: `consumePendingOpen()`

Used by NewChatScreen and FriendRequestsScreen to navigate after async WebSocket responses.

**How it works:**
1. Backend emits `openConversation` with `{conversationId}`
2. ChatProvider `onOpenConversation` sets `_pendingOpenConversationId`, calls `notifyListeners()`
3. Screen's `build()` calls `chat.consumePendingOpen()` which returns the ID and clears it
4. Screen calls `Navigator.pop(conversationId)` via `addPostFrameCallback`
5. ConversationsScreen awaits the push result, receives conversationId, calls `_openChat()`

**Both screens that use this pattern:**
- `NewChatScreen` — for mutual auto-accept (no `_navigatingToChat` guard needed, uses `mounted` check)
- `FriendRequestsScreen` — for standard accept (has `_navigatingToChat` flag to prevent double-pop)

## WebSocket Events

### Client -> Server
| Event | Payload | Response Events |
|-------|---------|-----------------|
| `sendMessage` | `{recipientId: int, content: string}` | `messageSent` to sender, `newMessage` to recipient |
| `startConversation` | `{recipientEmail: string}` | `conversationsList` + `openConversation` to sender |
| `getMessages` | `{conversationId: int}` | `messageHistory` (last 50 messages, oldest first) |
| `getConversations` | (no payload) | `conversationsList` |
| `deleteConversation` | `{conversationId: int}` | `conversationsList` (refreshed list) |
| `sendFriendRequest` | `{recipientEmail: string}` | `friendRequestSent` to sender, `newFriendRequest` + `pendingRequestsCount` to recipient. If mutual: acceptance events + `openConversation` to both |
| `acceptFriendRequest` | `{requestId: int}` | `friendRequestAccepted` + `conversationsList` + `friendsList` + `openConversation` to both, `friendRequestsList` + `pendingRequestsCount` to acceptor |
| `rejectFriendRequest` | `{requestId: int}` | `friendRequestRejected` + `friendRequestsList` + `pendingRequestsCount` to receiver |
| `getFriendRequests` | (no payload) | `friendRequestsList` + `pendingRequestsCount` |
| `getFriends` | (no payload) | `friendsList` |
| `unfriend` | `{userId: int}` | `unfriended` to both, `conversationsList` refreshed for both |

### Server -> Client
| Event | Payload |
|-------|---------|
| `conversationsList` | `ConversationModel[]` |
| `messageHistory` | `MessageModel[]` |
| `messageSent` | `MessageModel` (confirmation) |
| `newMessage` | `MessageModel` (incoming from other user) |
| `openConversation` | `{conversationId: int}` |
| `error` | `{message: string}` |
| `newFriendRequest` | `FriendRequestModel` |
| `friendRequestSent` | `FriendRequestModel` (confirmation) |
| `friendRequestAccepted` | `FriendRequestModel` (to both users) |
| `friendRequestRejected` | `FriendRequestModel` (to receiver only) |
| `friendRequestsList` | `FriendRequestModel[]` (pending requests) |
| `pendingRequestsCount` | `{count: int}` (for badge) |
| `friendsList` | `UserModel[]` (all accepted friends) |
| `unfriended` | `{userId: int}` |

**Connection**: Socket.IO with JWT token via query param `?token=xxx`. Server tracks online users via `Map<userId, socketId>`.

## Database

PostgreSQL with TypeORM. `synchronize: true` auto-creates tables (dev only).
Four tables: `users`, `conversations`, `messages`, `friend_requests`.

**Tables:**
- `users`: id, email (unique), username (unique), password (bcrypt), createdAt
- `conversations`: id, user_one_id (FK), user_two_id (FK), createdAt
- `messages`: id, content, sender_id (FK), conversation_id (FK), createdAt
- `friend_requests`: id, sender_id (FK), receiver_id (FK), status (enum: pending/accepted/rejected), createdAt, respondedAt

## Entity Models (Backend)

```
User: id (PK), email (unique), username (unique), password (bcrypt), createdAt

Conversation: id (PK), userOne (FK->User, eager), userTwo (FK->User, eager), createdAt

Message: id (PK), content (text), sender (FK->User, eager), conversation (FK->Conversation, lazy), createdAt

FriendRequest:
  id (PK)
  sender (FK->User, eager, CASCADE DELETE)
  receiver (FK->User, eager, CASCADE DELETE)
  status (enum: PENDING, ACCEPTED, REJECTED) -- default PENDING
  createdAt (auto timestamp)
  respondedAt (nullable, set on accept/reject)
  Index: (sender_id, receiver_id) -- no unique constraint, allows resend after rejection
```

## Environment variables

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`, `PORT` -- all have defaults for local dev.

Frontend uses `BASE_URL` dart define (defaults to `http://localhost:3000`). In Docker, nginx proxies API/WebSocket requests to the backend.

## REST Endpoints (only 2 exist)
- `POST /auth/register` -- Body: `{email, username, password}` -> Returns `{id, email, username}`. Password min 6 chars. Username must be unique.
- `POST /auth/login` -- Body: `{email, password}` -> Returns `{access_token}`.

**There are NO other REST endpoints.** All chat operations use WebSocket.

## Quick Reference (Find Stuff Fast)

### I want to modify friend request logic
-> `backend/src/friends/friends.service.ts` (9 methods: sendRequest, accept, reject, areFriends, etc.)
-> `backend/src/chat/chat.gateway.ts` (6 handlers: sendFriendRequest, acceptFriendRequest, etc.)

### I want to add a new WebSocket event
-> Add handler in `backend/src/chat/chat.gateway.ts` (use @SubscribeMessage decorator)
-> Add listener in `frontend/lib/services/socket_service.dart` (socket.on() in connect())
-> Add callback in `frontend/lib/providers/chat_provider.dart` (pass to socketService.connect())

### I want to change the badge appearance
-> `frontend/lib/screens/conversations_screen.dart` (search "Stack" for badge UI in both layouts)

### I want to modify friend request UI
-> `frontend/lib/screens/friend_requests_screen.dart` (entire screen for accept/reject)

### I want to add database column to FriendRequest
-> Edit `backend/src/friends/friend-request.entity.ts` (TypeORM will auto-migrate if synchronize: true)
-> Add corresponding field to `FriendRequestModel` in `frontend/lib/models/friend_request_model.dart`

### I want to modify auto-open chat after accept
-> `backend/src/chat/chat.gateway.ts` — `handleAcceptFriendRequest` emits `openConversation`
-> `frontend/lib/screens/friend_requests_screen.dart` — monitors `consumePendingOpen()` in build()
-> `frontend/lib/screens/conversations_screen.dart` — `_openFriendRequests()` awaits result and calls `_openChat()`

### I want to debug friend authorization
-> Check backend console for `acceptFriendRequest:` log lines (added in latest fix)
-> Check `backend/src/friends/friends.service.ts` for areFriends() logic

### I want to modify unfriend logic
-> `backend/src/friends/friends.service.ts` — `unfriend()` method (TWO separate deletes for bidirectional cleanup)
-> `backend/src/chat/chat.gateway.ts` — `handleUnfriend()` orchestrates deletion + events
-> `backend/src/conversations/conversations.service.ts` — `delete()` handles messages + conversation

### I want to test unfriend flow
-> Call `unfriend(userId)` from ChatProvider -> triggers ChatGateway.handleUnfriend()
-> Checks: deletion of FriendRequest + deletion of Conversation + deletion of Messages (cascade)
-> Both users get `unfriended` event + `conversationsList` refreshed

## Frontend Architecture Notes

### State Management
- **Provider** (ChangeNotifier) pattern. Two providers: `AuthProvider` + `ChatProvider`.
- `AuthProvider` handles JWT lifecycle: login -> decode JWT (`sub`=userId, `email`) -> save to SharedPreferences -> auto-restore on app start (checks expiry via JwtDecoder).
- `ChatProvider` handles WebSocket: connect with token -> listen to all events -> manage conversations/messages state. The `openConversation()` method clears messages and fetches history. The `consumePendingOpen()` method returns and clears `_pendingOpenConversationId` for navigation.

### Navigation Flow
```
main.dart -> AuthGate (watches AuthProvider.isLoggedIn)
  -> false: AuthScreen (login/register)
  -> true: ConversationsScreen (main hub)
    -> Mobile: Navigator.push -> ChatDetailScreen
    -> Desktop (>=600px): side-by-side layout (list + embedded chat)
    -> FriendRequestsScreen: push, awaits return value (conversationId or null)
    -> NewChatScreen: push, awaits return value (conversationId or null)
```

### Responsive Design
- Breakpoint at **600px width** -- below = mobile (push navigation), above = desktop (master-detail)
- Use `LayoutBuilder` in `ConversationsScreen` to switch layouts
- All screens use `SafeArea` for phone notches/gesture bars

### Theme System (`rpg_theme.dart`)
- RPG color palette: background `#0A0A2E`, gold `#FFCC00`, purple `#7B7BF5`, border `#4A4AE0`, etc.
- `RpgTheme.themeData` -- full `ThemeData` for MaterialApp
- `pressStart2P()` -- retro font, use ONLY for titles/headers/logos
- `bodyFont()` -- readable `Inter` font for body text, messages, form fields
- Rounded corners (8px for inputs, 16px for message bubbles)

### Dependencies (pubspec.yaml)
- `provider ^6.1.2` -- state management
- `socket_io_client ^2.0.3+1` -- WebSocket (Socket.IO)
- `http ^1.2.2` -- REST calls
- `jwt_decoder ^2.0.1` -- JWT parsing
- `shared_preferences ^2.3.4` -- token persistence
- `google_fonts ^6.2.1` -- Press Start 2P + Inter fonts

## Backend Limitations
- No user search/discovery -- must know exact email to send friend request
- No user profiles beyond basic info
- No typing indicators, read receipts, or message editing/deletion
- No pagination -- `getMessages` always returns last 50
- No last message included in `conversationsList` -- must track client-side
- `conversations` table has no unique constraint on user pair in DB, deduplication done in `findOrCreate`
- Friend requests have no unique constraint on (sender, receiver) -- intentional, allows resend after rejection

## Critical Gotchas

### TypeORM Relations -- ALWAYS specify `relations` explicitly
**Despite `eager: true` on FriendRequest entity, TypeORM does NOT reliably load relations.** Every `findOne()` and `find()` on `friendRequestRepository` MUST include `relations: ['sender', 'receiver']`. Without this, `fr.sender` and `fr.receiver` may be empty objects (only `id`, no `email`/`username`), causing crashes like `Cannot read property 'email' of undefined` that are caught silently by try/catch in the gateway.

**All FriendsService methods that load FriendRequest entities now have explicit `relations`:**
- `sendRequest()` -- auto-accept findOne (line ~88)
- `acceptRequest()` -- both findOne calls (lines ~102, ~123)
- `rejectRequest()` -- both findOne calls (lines ~134, ~155)
- `getPendingRequests()` -- find call (line ~182)
- `getFriends()` -- find call (line ~193)
- `areFriends()` -- does NOT need relations (only checks existence)
- `getPendingRequestCount()` -- does NOT need relations (only counts)

### TypeORM .delete() Does NOT Support Relation Conditions

**TypeORM `.delete()` cannot resolve nested relation objects** like `sender: { id: X }` to FK columns. It generates raw SQL without JOINs, so relation conditions silently produce no matches.

**WRONG (silently deletes nothing):**
```typescript
await repository.delete({
  sender: { id: userId1 },    // relation condition — NOT supported by .delete()
  receiver: { id: userId2 },
  status: 'accepted',
});
```

**RIGHT (find-then-remove pattern):**
```typescript
const records = await repository.find({
  where: [
    { sender: { id: userId1 }, receiver: { id: userId2 }, status: 'accepted' },
    { sender: { id: userId2 }, receiver: { id: userId1 }, status: 'accepted' },
  ],
});
if (records.length > 0) {
  await repository.remove(records);  // deletes by primary key — always works
}
```

**Rule:** For any delete involving FK/relation conditions, always use `.find()` first (supports JOINs), then `.remove()` (uses primary key).

### Gateway Error Handling
The `handleAcceptFriendRequest` handler has a single try/catch. If ANY step crashes (e.g. `getFriends()` without relations), ALL subsequent emits are skipped -- including `friendsList` and `openConversation`. This was the root cause of "users don't get added and chat doesn't open" bug.

### Socket.IO Data Types
- Events return `dynamic` data -- always cast to `Map<String, dynamic>` or `List<dynamic>` before parsing
- `onOpenConversation` casts `data['conversationId'] as int`

### Frontend Navigation
- `onOpenConversation` fires inside ChatProvider (not in widget tree) -- cannot call `Navigator.push` from provider. Use reactive `consumePendingOpen()` pattern watched by the screen's `build()` method.
- FriendRequestsScreen has `_navigatingToChat` flag to prevent double-navigation
- ConversationsScreen `_openFriendRequests()` and `_startNewChat()` both use `async` + `await Navigator.push<int>()` to receive return value

### Other
- `AppConfig.baseUrl` falls back to `Uri.base.origin` on web builds -- important for Docker/nginx deployment
- When deleting old widget files, make sure no imports reference them
- `flutter analyze` should pass with zero issues before committing
- Platform is Windows -- use `cd frontend &&` or `cd backend &&` prefix for commands
- `friendRequestRejected` event sent ONLY to receiver (silent rejection) -- sender gets no notification
- No unique constraint on (sender_id, receiver_id) in friend_requests table -- intentional, allows resend after rejection
- Mutual requests auto-accept both directions in `sendRequest()` -- check for existing reverse pending before creating new request
- `unfriend()` deletes ONLY accepted FriendRequests, not pending or rejected ones
- Badge count fetched on connect and updated per `pendingRequestsCount` event -- ensure ChatProvider.connect() calls `fetchFriendRequests()`
- FriendRequestsScreen emits `getFriendRequests` in initState -- be aware of double-emits if screen is revisited

## Bug Fix History

### 2026-01-30 (Round 5): CRITICAL - "Already Friends" Bug After Deleting Conversation

**Problem:** User A sends friend request to User B, User B accepts, they can chat. User A deletes the chat. When User A tries to send a new friend request to User B, the system shows "Already friends" error and the request is not sent or displayed to User B. This made it impossible to re-friend someone after deleting a conversation.

**Root cause:** When a user clicked "delete chat", the frontend called `deleteConversation` event, which **ONLY deleted the Conversation record, but left the FriendRequest record with status=ACCEPTED in the database**. When trying to send a new friend request, `sendRequest()` checked for existing ACCEPTED FriendRequests and found the old one, throwing "Already friends" error.

**Flow that caused the bug:**
1. User A sends friend request → FriendRequest(sender=A, receiver=B, status=PENDING)
2. User B accepts → FriendRequest updated to status=ACCEPTED
3. **User A deletes chat** → `deleteConversation` event → Only Conversation deleted, **FriendRequest(status=ACCEPTED) still exists**
4. User A sends new friend request → `sendRequest()` finds existing ACCEPTED record → throws "Already friends" error

**Key insight:** There were TWO ways to "remove" a user:
- `unfriend` event: Properly deleted BOTH FriendRequest AND Conversation
- `deleteConversation` event: Only deleted Conversation, left FriendRequest orphaned

Users were calling `deleteConversation` (the obvious "delete chat" action), not `unfriend`, causing the bug.

**Fix applied:**
- `backend/src/chat/chat.gateway.ts` - `handleDeleteConversation()`:
  1. Now calls `friendsService.unfriend()` BEFORE deleting the conversation
  2. Notifies other user with `unfriended` event
  3. Refreshes conversations list for both users
  4. Refreshes friends list for both users
  5. Added comprehensive error handling and diagnostic logging
  6. This makes `deleteConversation` behave identically to `unfriend` - both now properly clean up the friendship

**Impact:** This was the root cause of the "Already friends" bug that persisted through 3 previous fix attempts. The issue wasn't with the `unfriend()` method itself (which was working correctly), but with users calling `deleteConversation` instead, which didn't clean up the friendship.

**Verification steps:**
1. Backend logs now show: `deleteConversation: userId=X, otherUserId=Y, conversationId=Z`
2. Backend logs show: `unfriend: found N ACCEPTED records` and `unfriend: removed N records`
3. Test flow: A sends request → B accepts → A deletes chat → A sends new request → Should work without "Already friends" error

### 2026-01-30 (Round 4): Unfriend Bugs - TypeORM .delete() Cannot Resolve Relation Conditions

**Problem:** Unfriend button didn't actually delete anything. After unfriending, users couldn't send new friend requests ("Already friends" error). Both bugs had the same root cause.

**Root cause:** `FriendsService.unfriend()` used TypeORM `.delete()` with nested relation conditions like `sender: { id: userId1 }`. TypeORM's `.delete()` generates a simple `DELETE FROM ... WHERE ...` SQL and **cannot resolve relation objects** to their FK columns. The delete silently failed (no error, no rows deleted), leaving ACCEPTED FriendRequest records in the database.

**Key insight:** TypeORM `.find()` and `.findOne()` support `sender: { id: X }` because they use JOINs. But `.delete()` does NOT — it cannot translate relation objects to column names. This is a fundamental TypeORM limitation, not a syntax error.

**Impact:**
- Bug 7: Existing ACCEPTED records blocked re-invitation via `sendRequest()` check
- Bug 8: Unfriend button appeared to work (no error thrown) but friendship never got deleted from database

**Fix applied:**
- `backend/src/friends/friends.service.ts`: Replaced `.delete()` with find-then-remove pattern:
  1. `.find()` with relation conditions (works — uses JOINs) to locate ACCEPTED records
  2. `.remove(entities)` to delete found entities by primary key (always works)
  3. Added diagnostic `console.log` for monitoring
- This pattern is safe because `.find()` with `where: [...]` array syntax IS supported (OR conditions via JOINs)

**Verification:**
- Backend console now logs `unfriend: found N ACCEPTED records` and `unfriend: removed N records`
- Confirmed `ConversationsService.delete()` already deletes messages explicitly
- Confirmed `ChatGateway.handleUnfriend()` properly orchestrates deletion + events

### 2026-01-30 (Round 3): Auto-Open Chat + Relations Fix

**Problem:** After accepting a friend request, users were not added as friends and the chat window did not open. The entire accept flow was silently failing.

**Root causes found:**
1. **`getFriends()` missing `relations: ['sender', 'receiver']`** -- crashed the accept handler's try/catch, preventing `friendsList` and `openConversation` from being emitted. This was the MAIN bug causing "users don't get added".
2. **`getPendingRequests()` missing `relations`** -- same pattern, could crash gateway mapping.
3. **`sendRequest()` auto-accept `findOne` missing `relations`** -- returned partial FriendRequest object.
4. **Auto-accept in `handleSendFriendRequest` never created a conversation** -- `findByUsers()` returned null, `openConversation` not emitted.
5. **No `pendingRequestsCount` update after accept/auto-accept** -- badge count stale.
6. **No `openConversation` event after accept** -- frontend had no signal to auto-navigate.
7. **FriendRequestsScreen didn't monitor `consumePendingOpen()`** -- no navigation after accept.
8. **ConversationsScreen `_openFriendRequests()` didn't await return value** -- navigation result lost.

**Fixes applied:**
- `backend/src/friends/friends.service.ts`: Added `relations: ['sender', 'receiver']` to `sendRequest()` auto-accept findOne, `getPendingRequests()`, `getFriends()`
- `backend/src/chat/chat.gateway.ts`:
  - `handleAcceptFriendRequest`: Added `openConversation` emit to both users, added `pendingRequestsCount` emit, added diagnostic logging
  - `handleSendFriendRequest` auto-accept: Added `findOrCreate()` to create conversation, added `openConversation` emit to both users, added `pendingRequestsCount` emit
- `frontend/lib/screens/friend_requests_screen.dart`: Added `_navigatingToChat` flag, added `consumePendingOpen()` monitoring in `build()`, pops with conversationId
- `frontend/lib/screens/conversations_screen.dart`: `_openFriendRequests()` now async, awaits `Navigator.push<int>()`, calls `_openChat()` on result

### 2026-01-30 (Round 2): Friend Requests System - Critical Issues

**5 bugs fixed:**
1. Missing relations in `acceptRequest()` and `rejectRequest()` -- added `relations: ['sender', 'receiver']`
2. Missing `friendsList` events in `handleAcceptFriendRequest()` -- added `getFriends()` + emit
3. Mutual auto-accept not emitting events -- added status check + emit acceptance events
4. Frontend not requesting friends list update -- added `_socketService.getFriends()` in `onFriendRequestAccepted`
5. Missing relations in `rejectRequest()` -- consistency fix
