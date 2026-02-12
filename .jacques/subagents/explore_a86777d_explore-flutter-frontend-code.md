# Explore: Explore Flutter frontend code

> Session: `c64e528e-e9d5-4dea-ac57-487ada3b19ad`
> Date: 2026-01-29
> Tokens: ~35,743

---

Perfect! I have now thoroughly explored the entire Flutter frontend codebase. Let me provide you with a comprehensive analysis:

## Flutter Frontend - Complete Codebase Analysis

### 1. Project Structure
```
frontend/
├── lib/
│   ├── main.dart                          (App entry point)
│   ├── config/
│   │   └── app_config.dart               (Configuration)
│   ├── models/
│   │   ├── user_model.dart               (User DTO)
│   │   ├── conversation_model.dart       (Conversation DTO)
│   │   └── message_model.dart            (Message DTO)
│   ├── services/
│   │   ├── api_service.dart             (REST client)
│   │   └── socket_service.dart          (WebSocket wrapper)
│   ├── providers/
│   │   ├── auth_provider.dart           (Auth state management)
│   │   └── chat_provider.dart           (Chat state management)
│   ├── screens/
│   │   ├── auth_screen.dart             (Login/Register UI)
│   │   └── chat_screen.dart             (Main chat UI)
│   ├── widgets/
│   │   ├── rpg_box.dart                 (Styled container)
│   │   ├── auth_form.dart               (Form widget)
│   │   ├── tab_bar_widget.dart          (Custom tab bar)
│   │   ├── blinking_cursor.dart         (Animated cursor)
│   │   ├── sidebar.dart                 (Conversations list)
│   │   ├── conversation_item.dart       (Conversation row)
│   │   ├── message_bubble.dart          (Message display)
│   │   ├── message_input_bar.dart       (Message input field)
│   │   └── no_chat_selected.dart        (Empty state)
│   └── theme/
│       └── rpg_theme.dart               (Theme constants)
└── pubspec.yaml
```

### 2. Dependencies (pubspec.yaml)
- **provider ^6.1.2** — State management (ChangeNotifier pattern)
- **socket_io_client ^2.0.3+1** — WebSocket client (Socket.IO)
- **http ^1.2.2** — HTTP REST calls
- **jwt_decoder ^2.0.1** — JWT parsing
- **shared_preferences ^2.3.4** — Local token persistence
- **google_fonts ^6.2.1** — Press Start 2P font (retro RPG style)
- **cupertino_icons ^1.0.8** — iOS icons

---

### 3. App Configuration
**File: `lib/config/app_config.dart`**
- Reads `BASE_URL` from environment (defaults to `http://localhost:3000`)
- Falls back to `Uri.base.origin` for web builds
- Used for API and WebSocket connections

---

### 4. Data Models

**UserModel** (`lib/models/user_model.dart`)
```dart
class UserModel {
  final int id;
  final String email;
  // Factory: fromJson(Map<String, dynamic>)
}
```

**ConversationModel** (`lib/models/conversation_model.dart`)
```dart
class ConversationModel {
  final int id;
  final UserModel userOne;
  final UserModel userTwo;
  final DateTime createdAt;
  // Factory: fromJson()
}
```

**MessageModel** (`lib/models/message_model.dart`)
```dart
class MessageModel {
  final int id;
  final String content;
  final int senderId;
  final String senderEmail;
  final int conversationId;
  final DateTime createdAt;
  // Factory: fromJson()
}
```

---

### 5. Services Layer

#### API Service (`lib/services/api_service.dart`)
**Endpoints:**
- `POST /auth/register` — Register user (email, password) → returns registration data
- `POST /auth/login` — Login user (email, password) → returns JWT `access_token`

**Methods:**
- `register(email, password)` — Throws on non-201 status
- `login(email, password)` — Throws on non-200/201 status, extracts `access_token`

#### Socket Service (`lib/services/socket_service.dart`)
**Connection:**
- Connects via WebSocket with JWT token in auth + query params
- Auto-disables auto-connect, manually calls `.connect()`

**Emitted Events (Client → Server):**
- `getConversations` — Fetch user's conversations
- `getMessages {conversationId}` — Fetch conversation messages
- `sendMessage {recipientId, content}` — Send message
- `startConversation {recipientEmail}` — Start new conversation

**Listened Events (Server → Client):**
- `conversationsList` — List of ConversationModel[]
- `messageHistory` — List of MessageModel[]
- `messageSent` — Message confirmation (MessageModel)
- `newMessage` — Incoming message (MessageModel)
- `openConversation` — {conversationId} (opens in UI)
- `error` — Error message
- `disconnect` — Connection lost

---

### 6. State Management (Providers)

#### AuthProvider (`lib/providers/auth_provider.dart`)
**State:**
- `_token` — JWT token string
- `_currentUser` — UserModel (decoded from JWT payload)
- `_statusMessage` — UI feedback (success/error)
- `_isError` — Flag for error styling

**Getters:**
- `token` — JWT string
- `currentUser` — UserModel
- `statusMessage` — Feedback message
- `isError` — Is error?
- `isLoggedIn` — Has token && currentUser?

**Methods:**
- `_loadSavedToken()` — On init, restore token from SharedPreferences (checks expiry via JwtDecoder)
- `register(email, password)` — API call, sets "Hero created! Now login." on success
- `login(email, password)` — API call, decodes JWT payload (sub=id, email), saves to SharedPreferences
- `logout()` — Clears token/user, removes from SharedPreferences
- `clearStatus()` — Clears message feedback

**JWT Payload Used:**
- `sub` — User ID (integer)
- `email` — User email

#### ChatProvider (`lib/providers/chat_provider.dart`)
**State:**
- `_conversations` — List<ConversationModel>
- `_messages` — List<MessageModel> (for active conversation)
- `_activeConversationId` — int? (selected conversation)
- `_currentUserId` — int? (logged-in user)
- `_errorMessage` — string? (socket errors)

**Getters:**
- `conversations`, `messages`, `activeConversationId`, `errorMessage`

**Methods:**
- `connect(token, userId)` — Initialize WebSocket + auto-fetch conversations on connect
  - Listens to all socket events and updates state
  - `onMessageSent` & `onNewMessage` — Adds message if belongs to active conversation, refetches conversations
- `openConversation(conversationId)` — Sets active conversation, clears messages, fetches history
- `sendMessage(content)` — Determines recipient from active conversation, emits `sendMessage` event
- `startConversation(recipientEmail)` — Emits `startConversation` event (waits for `openConversation` callback)
- `disconnect()` — Closes socket, clears all data
- `clearError()` — Clears error message

---

### 7. UI Flow (Screens)

#### AuthScreen (`lib/screens/auth_screen.dart`)
**Layout:**
- Centered RpgBox (width: 400)
- Title: "⚔️ RPG CHAT ⚔️" with gold shadow
- Subtitle: "~ Enter the realm ~"
- Tab bar: LOGIN | REGISTER (switchable)
- Auth form with email/password inputs
- Status message (success/error, color-coded)

**Flow:**
- User registers → status message "Hero created! Now login." → auto-switches to LOGIN tab
- User logs in → JWT saved, navigates to ChatScreen (via AuthGate)

#### ChatScreen (`lib/screens/chat_screen.dart`)
**Layout:**
- RpgBox (width: 700, height: 520)
- **Header:**
  - User email + blinking cursor (green)
  - LOGOUT button (red border)
- **Body (2-column):**
  - Left: Sidebar (200px)
  - Right: Messages area or "NoChatSelected"

**Sidebar** (`lib/widgets/sidebar.dart`)
- Title: "📜 PARTY"
- Input row: Email field + "+" button (start conversation)
- Error display
- Scrollable conversation list

**Messages Area:**
- ScrollView with ListView of MessageBubble widgets
- Auto-scrolls to bottom on new messages
- MessageInputBar at bottom

---

### 8. Widget Components

| Widget | Purpose |
|--------|---------|
| **RpgBox** | Styled container with double border (retro RPG) |
| **AuthForm** | Email/password inputs + submit button, handles loading state |
| **RpgTabBar** | Custom tab bar (LOGIN/REGISTER), gold highlight for active |
| **BlinkingCursor** | Animated underscore (1s blink cycle) |
| **Sidebar** | Conversations list + new chat input |
| **ConversationItem** | Single conversation row, hover/active states |
| **MessageBubble** | Message display with sender label, content, timestamp |
| **MessageInputBar** | Text input + SEND button |
| **NoChatSelected** | Empty state placeholder |

---

### 9. Theme System (`lib/theme/rpg_theme.dart`)

**Color Palette:**
- `background` — #0A0A2E (dark blue)
- `boxBg` — #0F0F3D (slightly lighter blue)
- `gold` — #FFCC00 (primary accent)
- `purple` — #7B7BF5 (secondary accent)
- `border` — #4A4AE0 (box borders)
- `inputBg` — #0A0A24 (input background)
- `textColor` — #E0E0E0 (default text)
- `mutedText` — #6A6AB0 (placeholder)
- `labelText` — #9999DD (labels)
- `tabBg` — #1A1A4E
- `activeTabBg` — #2A2A8E
- `headerGreen` — #44FF44 (green accent)
- `logoutRed` — #FF6666 (error)
- `mineMsgBg` — #1A1A50 (sent message)
- `theirsMsgBg` — #121240 (received message)

**Text Styles:**
- `pressStart2P()` — Custom font from Google Fonts (Press Start 2P), retro arcade feel

**Decorations:**
- `rpgBoxDecoration()` — Box with border, shadow
- `rpgOuterBorderDecoration()` — Outer border
- `rpgInputDecoration()` — Text field styling (gold focus border)

---

### 10. Navigation Flow

```
main() 
  → RpgChatApp (MultiProvider: AuthProvider, ChatProvider)
    → AuthGate (watches AuthProvider.isLoggedIn)
      → AuthProvider.isLoggedIn == false → AuthScreen
      → AuthProvider.isLoggedIn == true → ChatScreen
        (on init: connects WebSocket via ChatProvider.connect())

AuthScreen:
  Login/Register form
    → AuthProvider.login() / .register()
      → Saves JWT to SharedPreferences & state
      → AuthGate rebuilds, navigates to ChatScreen

ChatScreen:
  Sidebar (start conversation, list conversations)
    → ChatProvider.openConversation() / .startConversation()
  Messages area
    → ChatProvider.sendMessage()
  Logout button
    → AuthProvider.logout() + ChatProvider.disconnect()
    → Returns to AuthScreen
```

---

### 11. Key Design Patterns

1. **Provider State Management** — ChangeNotifier with MultiProvider
2. **Socket.IO Real-time** — Event-driven architecture, JWT auth
3. **Token Persistence** — SharedPreferences + JWT expiry check
4. **Conversation Logic** — Identify other user via userOne/userTwo, determine recipient ID
5. **Retro RPG Theme** — Press Start 2P font, gold/purple/green colors, emojis (⚔️, 🛡️, etc.)

---

### 12. Data Flow Example: Sending a Message

1. User types in MessageInputBar, taps SEND
2. `MessageInputBar._send()` → `ChatProvider.sendMessage(content)`
3. ChatProvider determines recipient ID from active conversation
4. Emits Socket `sendMessage {recipientId, content}`
5. Backend saves message, emits `messageSent` + `newMessage` (if recipient online)
6. ChatProvider receives `onMessageSent` → adds to `_messages`, refetches conversations
7. MessageBubble rebuilds with new message (right-aligned, gold border)

---

This is a complete, clean MVP with proper separation of concerns: services handle API/WebSocket, providers manage state, screens compose widgets, and everything uses the retro RPG theme consistently.