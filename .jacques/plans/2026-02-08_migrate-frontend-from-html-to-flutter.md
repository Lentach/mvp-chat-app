# Plan: Migrate Frontend from HTML to Flutter

## Goal
Replace the single `index.html` frontend with a Flutter app while preserving the exact RPG retro visual design. Reorganize project into professional `backend/` + `frontend/` structure.

---

## Phase 1: Project Restructuring

1. Move all backend files into `backend/` directory:
   - `src/`, `test/`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.prettierrc`, `Dockerfile`, `.dockerignore`
2. Delete `backend/src/public/` (the old HTML frontend)
3. Root keeps: `docker-compose.yml`, `README.md`, `CLAUDE.md`, `.gitignore`

**Result:**
```
mvp-chat-app/
  backend/       # NestJS app
  frontend/      # Flutter app
  docker-compose.yml
  README.md
  CLAUDE.md
```

---

## Phase 2: Backend Adjustments

**File: `backend/src/main.ts`**
- Remove `useStaticAssets(...)` line
- Add `app.enableCors({ origin: '*' })` for dev

No other backend changes needed — gateway, services, entities stay identical.

---

## Phase 3: Flutter Project Setup

Run `flutter create frontend --platforms web,android,ios`

**Dependencies (`pubspec.yaml`):**
- `provider` — state management
- `socket_io_client` — Socket.IO WebSocket
- `http` — REST API calls
- `google_fonts` — Press Start 2P font
- `jwt_decoder` — decode JWT client-side
- `shared_preferences` — persist token

---

## Phase 4: Flutter Architecture

```
frontend/lib/
  main.dart                    # App entry, MultiProvider, AuthGate
  config/
    app_config.dart            # Base URL constant
  models/
    user_model.dart            # {id, email}
    conversation_model.dart    # {id, userOne, userTwo, createdAt}
    message_model.dart         # {id, content, senderId, senderEmail, conversationId, createdAt}
  services/
    api_service.dart           # POST /auth/register, /auth/login
    socket_service.dart        # Socket.IO connect/emit/listen wrapper
  providers/
    auth_provider.dart         # token, currentUser, login/register/logout
    chat_provider.dart         # conversations, messages, activeConversation, socket events
  screens/
    auth_screen.dart           # Login/register with tabs
    chat_screen.dart           # Header + sidebar + messages area
  widgets/
    rpg_box.dart               # Double-bordered RPG dialog container
    tab_bar_widget.dart        # LOGIN/REGISTER tabs
    auth_form.dart             # Email/password form
    sidebar.dart               # PARTY title + new chat + conversation list
    conversation_item.dart     # Single conversation row
    message_bubble.dart        # Message with gold/purple border
    message_input_bar.dart     # Text field + SEND button
    no_chat_selected.dart      # Placeholder text
    blinking_cursor.dart       # Animated underscore
  theme/
    rpg_theme.dart             # All colors, text styles, decorations
```

---

## Phase 5: Theme Constants (`rpg_theme.dart`)

All CSS values mapped to Dart:
- Background: `#0A0A2E`, Box: `#0F0F3D`, Gold: `#FFCC00`, Purple: `#7B7BF5`
- Border: `#4A4AE0`, Input BG: `#0A0A24`, Text: `#E0E0E0`, Muted: `#6A6AB0`
- Font: Press Start 2P via `google_fonts`, base size 10px
- RPG box: 4px border + outer 3px border via nested Containers

---

## Phase 6: Screen Breakdown

### Auth Screen (replicates `#auth-screen`)
- Centered 400px `RpgBox`
- Gold title "RPG CHAT" with sword emojis
- Tab bar (LOGIN / REGISTER) — gold active, purple inactive
- Forms: email + password inputs with RPG styling
- Buttons: "ENTER REALM" / "CREATE HERO"
- Status messages (red errors, green success)

### Chat Screen (replicates `#chat-screen`)
- 700x520 `RpgBox`
- **Header:** green user email + blinking cursor + red LOGOUT button
- **Row layout:**
  - **Sidebar (200px):** "PARTY" gold title, new chat input with "+" button, scrollable conversation list
  - **Main area:** messages list (scrollable) + input bar at bottom
- **Messages:** own = right-aligned, gold border, "⚔️ You"; others = left-aligned, purple border, "🛡️ {email}"

---

## Phase 7: Services

### ApiService
- `register(email, password)` → POST `/auth/register` → `{id, email}`
- `login(email, password)` → POST `/auth/login` → `access_token`

### SocketService
- `connect(baseUrl, token)` — with both `auth` and `query` token params, websocket transport
- `getConversations()`, `sendMessage(recipientId, content)`, `startConversation(recipientEmail)`, `getMessages(conversationId)`
- Listeners: `conversationsList`, `messageHistory`, `messageSent`, `newMessage`, `openConversation`, `error`

---

## Phase 8: Docker Updates

**`docker-compose.yml`** — add frontend service:
```yaml
backend:
  build: ./backend        # updated context path
  ...

frontend:
  build: ./frontend
  ports:
    - '8080:80'
  depends_on:
    - backend
```

**`frontend/Dockerfile`** — multi-stage: Flutter build → nginx serve

**`frontend/nginx.conf`** — reverse proxy `/auth/` and `/socket.io/` to backend:3000 (avoids CORS in production)

---

## Phase 9: Implementation Order

1. Restructure directories (move backend, verify build)
2. Backend adjustments (remove static serving, add CORS)
3. Create Flutter project + add dependencies
4. Build theme/constants
5. Build models
6. Build services (ApiService, SocketService)
7. Build providers (AuthProvider, ChatProvider)
8. Build widgets (rpg_box, message_bubble, sidebar, etc.)
9. Build screens (auth_screen, chat_screen)
10. Wire up main.dart (MultiProvider, AuthGate)
11. Update docker-compose.yml + add frontend Dockerfile/nginx
12. Update README.md and CLAUDE.md

---

## Verification

1. `cd backend && npm run build` — verify backend compiles after restructure
2. `docker-compose up --build` — verify all 3 services start
3. Open `http://localhost:8080` — Flutter web app loads
4. Register two users, login, start conversation, send messages both ways
5. Verify visual fidelity: RPG borders, gold/purple colors, Press Start 2P font, message alignment, blinking cursor
6. `cd frontend && flutter run -d chrome` — verify dev mode against backend on :3000

---

## Key Files to Modify/Reference

- `src/main.ts` → `backend/src/main.ts` (remove static serving, add CORS)
- `src/public/index.html` → deleted (reference for visual design)
- `src/chat/chat.gateway.ts` → reference for WebSocket events/payloads
- `docker-compose.yml` → update build contexts, add frontend service


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\d405e019-a724-442f-ad4f-752cf8b7eaac.jsonl