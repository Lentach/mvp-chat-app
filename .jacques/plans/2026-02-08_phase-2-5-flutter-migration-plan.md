# Phase 2.5: Flutter Migration Plan

## Overview

Replace the current `src/public/index.html` frontend with a cross-platform Flutter app in `flutter_app/` folder. The NestJS backend stays unchanged — Flutter connects to the same REST API and Socket.IO WebSocket.

**Target platforms:** Android (primary), iOS, Web (Flutter Web)
**State management:** Riverpod
**Key packages:** dio, socket_io_client, flutter_riverpod, flutter_secure_storage, image_picker, go_router, audioplayers, cached_network_image

---

## File Structure

```
flutter_app/
├── lib/
│   ├── main.dart                              # App entry, ProviderScope, auto-refresh timer
│   ├── core/
│   │   ├── constants/api_constants.dart        # Base URL, endpoint paths
│   │   ├── theme/app_colors.dart               # RPG dark palette
│   │   ├── theme/app_theme.dart                # Material dark theme
│   │   └── router/app_router.dart              # GoRouter config with auth redirect
│   ├── models/
│   │   ├── user.dart                           # User + fromJson/toJson
│   │   ├── message.dart                        # Message + copyWith
│   │   └── conversation.dart                   # Conversation + ConversationOtherUser
│   ├── services/
│   │   ├── storage_service.dart                # flutter_secure_storage wrapper
│   │   ├── api_client.dart                     # Dio + JWT interceptor + 401 auto-refresh
│   │   ├── auth_service.dart                   # login/register/refresh/logout/avatar upload
│   │   ├── socket_service.dart                 # Socket.IO connect/emit/listen for all events
│   │   └── audio_service.dart                  # RPG notification sound
│   ├── providers/
│   │   ├── providers.dart                      # Service singletons (storage, apiClient, socket, audio)
│   │   ├── auth_provider.dart                  # AuthNotifier + AuthState (user, isLoading, error)
│   │   └── chat_provider.dart                  # ChatNotifier + ChatState (conversations, messages, typing, online)
│   ├── screens/
│   │   ├── login_screen.dart                   # Username + password form
│   │   ├── register_screen.dart                # Username + password + displayName form
│   │   ├── conversations_list_screen.dart      # List with avatars, online status, unread badges
│   │   ├── chat_screen.dart                    # Campfire scene + message list + input
│   │   └── profile_screen.dart                 # Avatar upload, display name edit
│   └── widgets/
│       ├── avatar_circle.dart                  # Round avatar (image or color+initial), online dot
│       ├── message_bubble.dart                 # Sent/received bubble, time, read checkmarks
│       └── campfire_scene.dart                 # Animated fire, 2 avatars, typing bubble, stars
├── assets/
│   └── sounds/message_beep.mp3                 # RPG chime notification
├── pubspec.yaml
├── android/app/src/main/AndroidManifest.xml    # Internet + camera + storage permissions
├── ios/Runner/Info.plist                       # Photo library + camera permissions
└── web/index.html                              # Title + meta tags
```

---

## Implementation Steps (in order)

### Step 1: Project setup
- `flutter create --org com.rpgchat --project-name rpg_chat flutter_app`
- Configure `pubspec.yaml` with all dependencies
- Add Android permissions (INTERNET, CAMERA, READ_EXTERNAL_STORAGE)
- Add iOS permissions (NSPhotoLibraryUsageDescription, NSCameraUsageDescription)
- Create `assets/sounds/` directory

### Step 2: Core infrastructure
- `core/constants/api_constants.dart` — base URL (`http://10.0.2.2:3000` for Android emulator, `http://localhost:3000` for web), all endpoint paths
- `core/theme/app_colors.dart` — dark RPG palette (background #0a0a2e, primary #4a4ae0, accent #f4a261, campfire orange/yellow, status colors)
- `core/theme/app_theme.dart` — Material dark theme with pixel-art styling

### Step 3: Data models
- `models/user.dart` — matches User entity (id, username, displayName?, avatarUrl?, avatarColor?, lastSeenAt?, createdAt)
- `models/message.dart` — matches Message entity (id, content, senderId, senderUsername, conversationId, readAt?, createdAt)
- `models/conversation.dart` — matches gateway response (id, userOne, userTwo, otherUser with isOnline, unreadCount, createdAt)

### Step 4: Services layer
- `services/storage_service.dart` — save/get/clear access token, refresh token, user ID via flutter_secure_storage
- `services/api_client.dart` — Dio instance with:
  - Request interceptor: attach `Authorization: Bearer <token>` header
  - Error interceptor: on 401, attempt refresh via `/auth/refresh`, retry original request, clear tokens on failure
- `services/auth_service.dart` — register(), login() (saves tokens + fetches profile), getProfile(), updateProfile(), uploadAvatar() (multipart), deleteAvatar(), logout()
- `services/socket_service.dart` — connect(token), disconnect(), reconnectWithNewToken(), all emit methods (sendMessage, getMessages, getConversations, typing, stopTyping, markRead, startConversation, getOnlineUsers), all event listeners (onNewMessage, onMessageSent, onMessageHistory, onConversationsList, onUserTyping, onUserStoppedTyping, onMessagesRead, onUserOnline, onUserOffline, onOnlineUsers, onError, onOpenConversation)
- `services/audio_service.dart` — playMessageSound(), toggleMute(), isMuted

### Step 5: Riverpod providers
- `providers/providers.dart` — Provider singletons for StorageService, ApiClient, AuthService, SocketService, AudioService
- `providers/auth_provider.dart` — StateNotifierProvider<AuthNotifier, AuthState>:
  - AuthState: {user?, isLoading, error?}
  - Methods: checkAuth(), login(), register(), logout(), updateProfile(), uploadAvatar()
- `providers/chat_provider.dart` — StateNotifierProvider<ChatNotifier, ChatState>:
  - ChatState: {conversations[], messagesByConversation{}, hasMoreByConversation{}, onlineUserIds{}, typingUsers{}}
  - Sets up all socket listeners in constructor
  - Methods: sendMessage(), startConversation(), loadMessages(), loadConversations(), typing(), stopTyping(), markRead()

### Step 6: Reusable widgets
- `widgets/avatar_circle.dart` — Circle with uploaded image (via CachedNetworkImage) or solid color + first letter initial. Optional online/offline indicator dot.
- `widgets/message_bubble.dart` — Left/right aligned bubble, content, timestamp, read receipt checkmarks (single=sent, double=read in green)
- `widgets/campfire_scene.dart` — **Key visual feature:**
  - Container 35% screen height, dark gradient background
  - Randomly placed star dots (white circles)
  - Ground strip at bottom (dark gradient)
  - Center: animated campfire (AnimationController, flickering glow with RadialGradient, orange/yellow, log base)
  - Left: current user avatar (AvatarCircle 64px) + display name
  - Right: other user avatar + display name + online indicator
  - Above other avatar: typing "..." bubble (yellow, appears when isOtherTyping)
  - Offline state: grayed out avatar

### Step 7: Screens
- `screens/login_screen.dart` — Form with username + password, login button, link to register. On success → /conversations
- `screens/register_screen.dart` — Form with username + password + optional displayName. Auto-login after register → /conversations
- `screens/conversations_list_screen.dart` — AppBar with logout. ListView of conversations showing avatar, display name, online status, unread badge. FAB to start new conversation (dialog with username input). On init: connect socket + load conversations.
- `screens/chat_screen.dart` — Top: CampfireScene. Middle: message ListView with scroll-to-load-more (pagination). Bottom: text input + send button. Typing indicator debounce (300ms). Auto markRead on open.
- `screens/profile_screen.dart` — Large avatar with camera icon overlay (tap to pick from gallery via image_picker), display name, username.

### Step 8: Navigation
- `core/router/app_router.dart` — GoRouter with auth redirect:
  - `/login` → LoginScreen
  - `/register` → RegisterScreen
  - `/conversations` → ConversationsListScreen
  - `/chat/:id` → ChatScreen(conversationId)
  - `/profile` → ProfileScreen
  - Redirect: not logged in → /login, logged in on auth pages → /conversations

### Step 9: App entry (main.dart)
- ProviderScope wrapping MaterialApp.router
- On init: checkAuth() to restore session from stored tokens
- Timer.periodic(14 min) for auto token refresh + socket reconnect
- Apply AppTheme.darkTheme()

### Step 10: Backend adjustments (minimal)
- Update `docker-compose.yml` CORS_ORIGIN to allow Flutter dev server
- No other backend changes needed — API is already compatible

---

## Key Technical Decisions

1. **Socket.IO reconnection**: When token refreshes, disconnect and reconnect with new token. SocketService.reconnectWithNewToken() handles this.
2. **Campfire animation**: AnimationController with SingleTickerProviderStateMixin. No CustomPainter needed — Container widgets with RadialGradient and animated height create sufficient fire effect.
3. **Message pagination**: Scroll listener on ListView. When scrolled to top, call loadMessages with `before: oldest message ID`. Prepend results without scroll jump.
4. **Android emulator networking**: Use `10.0.2.2` instead of `localhost` for API URL on Android emulator. Detect platform in api_constants.dart.
5. **Audio**: Use audioplayers package with a simple MP3 asset. Play only when app is backgrounded or different conversation is active.

---

## Backend Files Referenced (no changes needed)

- `src/auth/auth.controller.ts` — POST /auth/register, /auth/login, /auth/refresh, /auth/logout
- `src/users/users.controller.ts` — GET/PATCH /users/me, POST/DELETE /users/me/avatar
- `src/chat/chat.gateway.ts` — All WebSocket events
- `src/users/user.entity.ts` — User fields
- `src/messages/message.entity.ts` — Message fields
- `src/conversations/conversation.entity.ts` — Conversation fields

---

## Verification

After implementation:
1. `docker-compose up --build` — backend starts
2. `cd flutter_app && flutter run -d chrome` — Flutter web connects to backend
3. `cd flutter_app && flutter run` — Flutter mobile (emulator or device)
4. Register two accounts from two Flutter instances
5. Login both, verify conversations list loads
6. Start conversation, send messages — verify real-time delivery
7. Verify campfire scene shows both avatars with correct status
8. Type in one client — verify "..." bubble appears over avatar in other client
9. Upload avatar from gallery — verify it appears in campfire scene
10. Close one client — verify other shows offline status
11. Wait 14+ min — verify auto token refresh works and socket reconnects
12. `flutter build apk` — verify Android APK builds


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\a8fba1b7-b076-483f-b0d2-5de2ff82fa77.jsonl