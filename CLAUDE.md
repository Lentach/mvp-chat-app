# CLAUDE.md — MVP Chat App

**Last updated:** 2026-02-01

**Rule:** Update this file after every code change. Single source of truth for agents.

**Session rule:** Read `.cursor/session-summaries/LATEST.md` at start; write `YYYY-MM-DD-session.md` and update `LATEST.md` at end. `.cursor/rules/session-summaries.mdc`

**Code rule:** All code in English (vars, functions, comments, commits). `.cursor/rules/code-in-english.mdc`

---

## 1. Critical — Read First

| Rule | Why |
|------|-----|
| **TypeORM relations** | Always `relations: ['sender','receiver']` on friendRequestRepository. Without: empty objects, crashes. |
| **TypeORM .delete()** | Cannot use nested relation conditions. Use find-then-remove: `.find()` then `.remove()`. |
| **Socket.IO (Dart)** | Use `enableForceNew()` when reconnecting with new JWT (logout→login). Caches by URL otherwise. |
| **Provider→Navigator** | `ChatProvider` can't call `Navigator.push`. Use `consumePendingOpen()`: set ID, notifyListeners, screen pops in build. |
| **Multiple backends** | If frontend shows weird data vs backend logs: kill local `node.exe`, use Docker only. |

---

## 2. Quick Start

**Stack:** NestJS + Flutter + PostgreSQL + Socket.IO + JWT. 1-on-1 chat.

**Structure:** `backend/` :3000, `frontend/` :8080 (nginx in Docker). Manual E2E scripts in `scripts/` (see `scripts/README.md`).

**Run:**
```bash
# .env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
docker-compose up --build
```

**Before run:** `tasklist | findstr node` → kill if needed. One backend only.

---

## 3. Quick Reference — Find Code

| Task | Location |
|------|----------|
| Friend logic | `friends/friends.service.ts` + `chat/services/chat-friend-request.service.ts` |
| Message logic | `messages/messages.service.ts` + `chat/services/chat-message.service.ts` |
| Conversation logic | `conversations/conversations.service.ts` + `chat/services/chat-conversation.service.ts` |
| Gateway | `chat/chat.gateway.ts` (delegates to services) |
| Add WebSocket event | Service handler → gateway @SubscribeMessage → socket_service.dart → chat_provider.dart |
| Add user endpoint | users.service → users.controller @UseGuards(JwtAuthGuard) → api_service → auth_provider → settings_screen |
| Add FriendRequest column | friend-request.entity.ts → friend_request_model.dart (TypeORM sync) |
| Settings UI | `screens/settings_screen.dart`, `widgets/dialogs/` |
| Avatar/Cloudinary | `cloudinary/cloudinary.service.ts`, `users/users.controller.ts`, `avatar_circle.dart` |
| Theme | `RpgTheme` (themeData, themeDataLight), SettingsProvider for preference |
| Constants | `lib/constants/app_constants.dart` (breakpoint, delays, message page size, reconnect) |
| Auto-open after accept | Backend emits `openConversation` → FriendRequestsScreen `consumePendingOpen()` → ConversationsScreen `_openChat()` |

---

## 4. Architecture

**Backend:** AuthModule (register/login), CloudinaryModule (avatars), UsersModule, FriendsModule, ConversationsModule, MessagesModule, ChatModule (Socket.IO gateway).

**Frontend:** AuthProvider, ChatProvider, SettingsProvider. ConversationsScreen (hub), ChatDetailScreen, FriendRequestsScreen, NewChatScreen, SettingsScreen. RpgTheme.

**Database (PostgreSQL, synchronize:true):**
- `users` — id, email, username, password, profilePictureUrl, profilePicturePublicId
- `conversations` — id, user_one_id, user_two_id
- `messages` — id, content, sender_id, conversation_id
- `friend_requests` — id, sender_id, receiver_id, status (PENDING/ACCEPTED/REJECTED)

---

## 5. APIs

**REST:** POST /auth/register, POST /auth/login. JWT: POST /users/profile-picture, POST /users/reset-password, DELETE /users/account. Password: 8+ chars, upper+lower+number.

**WebSocket (JWT via ?token=):** sendMessage, getMessages, getConversations, deleteConversation, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, getFriendRequests, getFriends, unfriend.

**Key flows:** sendFriendRequest → newFriendRequest; acceptFriendRequest → friendRequestAccepted + friendsList + conversationsList + openConversation. deleteConversation calls unfriend() first.

**Security:** CORS (ALLOWED_ORIGINS), rate limit (login 5/15min, register 3/h, upload 10/h), WebSocket DTOs, JWT, JPEG/PNG max 5MB.

---

## 6. Critical Gotchas (Detailed)

**TypeORM .delete() with relations:** Use find-then-remove. Example:
```ts
const records = await repo.find({ where: [{ sender: {id: A}, receiver: {id: B} }, { sender: {id: B}, receiver: {id: A} }] });
await repo.remove(records);
```

**Conversation/message delete:** `messageRepo.delete({ conversation: { id } })` works (single relation). Used in conversations.service.ts.

**deleteConversation:** Calls `friendsService.unfriend()` before deleting conversation. Cleans both.

**consumePendingOpen pattern:** Provider sets `_pendingOpenConversationId`, notifyListeners. Screen build() calls consumePendingOpen(), addPostFrameCallback → Navigator.pop(id).

**FriendRequest relations:** Every find/findOne on friendRequestRepository needs `relations: ['sender','receiver']`. Files: friends.service.ts (sendRequest, acceptRequest, rejectRequest, getPendingRequests, getFriends).

---

## 7. Recent Changes (2026-02-01)

**Code review / shipping cleanup:** Removed dead RpgTheme colors (gold, purple, border, labelText, tabBg, tabBorder, activeTabBg, buttonBg, buttonHoverBg, headerGreen, logoutRed, convItemBg, convItemBorder, outerBorder, timeColor). Replaced `logoutRed` usages with `accentDark` (same value). Deduplicated ChatProvider message handling: single `_handleIncomingMessage` for `onMessageSent` and `onNewMessage`. Moved manual E2E scripts from repo root and `backend/` into `scripts/` with `scripts/README.md`.

**Delete account cascade:** User had no TypeORM cascade. deleteAccount now: (1) messages in user's convs, (2) conversations (userOne/userTwo), (3) friend_requests (sender/receiver), (4) user. UsersModule: Conversation, Message, FriendRequest repos.

**Avatar update fix:** Cloudinary overwrite uses same public_id. Only deleteAvatar when oldPublicId !== newPublicId. Camera icon → gallery directly (ProfilePictureDialog removed).

**Theme:** Dark default. Light: primaryLight #4A154B. Dark: accentDark #FF6666. Fonts: pressStart2P (titles), bodyFont/Inter (body). Breakpoint 600px. Nav: AuthGate → AuthScreen | ConversationsScreen (mobile push, desktop master-detail).

**No isOnline/active status:** Removed. No green dot, no isOnline in payloads.

---

## 8. Environment

| Var | Required | Purpose |
|-----|----------|---------|
| DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME | ✓ | PostgreSQL |
| JWT_SECRET | ✓ | JWT sign |
| CLOUDINARY_CLOUD_NAME, _API_KEY, _API_SECRET | ✓ | Avatars |
| PORT, NODE_ENV, ALLOWED_ORIGINS | — | Optional |

Frontend: BASE_URL dart define (default localhost:3000).

---

## 9. Bug Fix History (Lessons)

**Delete Account FK (2026-02-01):** Cascade delete dependents before user. users.service.ts, users.module.ts.

**Avatar overwrite (2026-02-01):** Skip deleteAvatar when same public_id. users.service.ts.

**Socket cache (Round 10):** enableForceNew() + cleanup in connect(). socket_service.dart. notifyListeners() after state clear. chat_provider.dart.

**Multiple backends (Round 9):** Kill local node. Docker + local = wrong backend.

**Session leak (Round 8):** connect() clears state first. AuthGate clears on logout. chat_provider.dart, main.dart.

**Unfriend (Round 4):** find-then-remove for relation conditions. friends.service.ts.

**deleteConversation (Round 5):** Must call unfriend() first. chat-conversation.service.ts.

---

## 10. Known Limitations

No user search. No typing/read receipts. No message edit/delete. No unique on (sender,receiver) — allows resend. Last message not in conversationsList (client-side). Message pagination: limit/offset, default 50.

---

## 11. Tech Debt

- Manual E2E scripts in `scripts/` (see `scripts/README.md`). Run with Node against a running backend; not part of the shipped app.
- Tests: 9 tests (AppConstants, UserModel, ConversationModel, widget). `flutter test`
- Magic numbers: extracted to `lib/constants/app_constants.dart` (layoutBreakpointDesktop, conversationsRefreshDelay, messagePageSize, reconnect*)
- WebSocket reconnection: implemented with exponential backoff (max 5 attempts). ChatProvider stores token for reconnect; onDisconnect triggers reconnect unless intentional (logout)

---

**Maintain this file.**
