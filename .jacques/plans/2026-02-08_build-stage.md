I now have a complete understanding of the codebase. Here is the full implementation plan.

---

## Implementation Plan: Migrate Frontend to Flutter with Project Restructuring

### Phase 1: Project Restructuring

**Goal:** Split the monorepo into `backend/` and `frontend/` directories.

**Step 1.1: Move backend files into `backend/` directory**

Move the following into `backend/`:
- `src/` (all NestJS source code)
- `test/`
- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.build.json`
- `nest-cli.json`
- `eslint.config.mjs`
- `.prettierrc`
- `Dockerfile` (will be modified)

**Step 1.2: Delete the static frontend**

Remove `backend/src/public/` directory entirely (contains only `index.html`).

**Step 1.3: Create root-level files**

The root `C:\Users\Lentach\desktop\mvp-chat-app\` will contain:
- `backend/` -- NestJS app
- `frontend/` -- Flutter app
- `docker-compose.yml` -- updated, orchestrates all services
- `README.md` -- updated
- `CLAUDE.md` -- updated
- `.gitignore` -- updated

**Resulting structure:**
```
mvp-chat-app/
  backend/
    src/
      auth/
      chat/
      conversations/
      messages/
      users/
      app.module.ts
      main.ts
    test/
    Dockerfile
    package.json
    package-lock.json
    tsconfig.json
    tsconfig.build.json
    nest-cli.json
    eslint.config.mjs
    .prettierrc
  frontend/
    lib/
      main.dart
      config/
      models/
      screens/
      services/
      widgets/
      theme/
    pubspec.yaml
    Dockerfile
    web/
  docker-compose.yml
  README.md
  CLAUDE.md
  .gitignore
```

---

### Phase 2: Backend Adjustments

**Step 2.1: Update `backend/src/main.ts`**

Current code serves static files:
```typescript
app.useStaticAssets(join(__dirname, '..', 'src', 'public'));
```

Changes needed:
1. **Remove** the `useStaticAssets` line entirely.
2. **Add explicit CORS** configuration for the Flutter app. The WebSocket gateway already has `cors: { origin: '*' }`, but the REST endpoints need CORS too:
```typescript
app.enableCors({
  origin: '*', // For dev; restrict in production
  methods: ['GET', 'POST'],
  credentials: true,
});
```
3. Change the import from `NestExpressApplication` -- this can stay the same, or switch to the generic interface since we no longer need Express-specific static assets. Keeping `NestExpressApplication` is fine.

**Step 2.2: Update `backend/Dockerfile`**

The Dockerfile stays nearly identical but the build context changes since it is now inside `backend/`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main.js"]
```
No changes to the file itself -- the `docker-compose.yml` build context will point to `./backend`.

**Step 2.3: No changes to gateway, entities, services, or modules**

The WebSocket gateway at `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` already has `cors: { origin: '*' }`. The auth controller, services, entities, and all other backend code remain functionally identical.

---

### Phase 3: Flutter Project Setup

**Step 3.1: Create Flutter project**

Run in the repo root:
```bash
flutter create frontend --platforms web,android,ios
```

We target **web** as the primary platform (matches the current HTML frontend), with mobile as a bonus.

**Step 3.2: `pubspec.yaml` dependencies**

```yaml
dependencies:
  flutter:
    sdk: flutter
  provider: ^6.1.1          # State management
  socket_io_client: ^2.0.3  # Socket.IO client
  http: ^1.2.0              # REST API calls
  shared_preferences: ^2.2.2 # Store JWT token locally
  google_fonts: ^6.1.0      # Press Start 2P font
  jwt_decoder: ^2.0.1       # Decode JWT payload client-side
```

**Step 3.3: Load the "Press Start 2P" font**

Use `google_fonts` package. In the theme, set:
```dart
GoogleFonts.pressStart2P(fontSize: 10, color: Color(0xFFE0E0E0))
```

---

### Phase 4: Flutter App Architecture

**State management: Provider (simplest approach)**

Three providers:
1. **AuthProvider** -- holds `token`, `currentUser` (id, email), handles login/register/logout
2. **ChatProvider** -- holds `conversations`, `activeConversationId`, `messages`, manages Socket.IO connection
3. No separate socket provider needed -- the ChatProvider owns the socket lifecycle

**Services (plain Dart classes):**
1. **ApiService** (`lib/services/api_service.dart`) -- REST calls to `/auth/register` and `/auth/login`
2. **SocketService** (`lib/services/socket_service.dart`) -- Socket.IO connection, emit/listen wrappers

**Models:**
1. **UserModel** (`lib/models/user_model.dart`) -- `{ id: int, email: String }`
2. **ConversationModel** (`lib/models/conversation_model.dart`) -- `{ id: int, userOne: UserModel, userTwo: UserModel, createdAt: DateTime }`
3. **MessageModel** (`lib/models/message_model.dart`) -- `{ id: int, content: String, senderId: int, senderEmail: String, conversationId: int, createdAt: DateTime }`

**File structure:**
```
frontend/lib/
  main.dart
  config/
    app_config.dart          # API base URL, constants
  models/
    user_model.dart
    conversation_model.dart
    message_model.dart
  services/
    api_service.dart         # HTTP calls for auth
    socket_service.dart      # Socket.IO wrapper
  providers/
    auth_provider.dart       # Auth state + logic
    chat_provider.dart       # Chat state + socket events
  screens/
    auth_screen.dart         # Login/register screen
    chat_screen.dart         # Main chat screen
  widgets/
    rpg_box.dart             # The RPG dialog box container
    tab_bar_widget.dart      # LOGIN/REGISTER tabs
    auth_form.dart           # Login & register forms
    sidebar.dart             # Conversation list sidebar
    conversation_item.dart   # Single conversation in list
    message_bubble.dart      # Single message widget
    message_input_bar.dart   # Text input + send button
    no_chat_selected.dart    # Placeholder when no chat open
  theme/
    rpg_theme.dart           # Colors, text styles, decorations
```

---

### Phase 5: Theme and Visual Constants (`lib/theme/rpg_theme.dart`)

Extract all CSS values into Dart constants:

```dart
class RpgColors {
  static const background = Color(0xFF0A0A2E);
  static const boxBackground = Color(0xFF0F0F3D);
  static const gold = Color(0xFFFFCC00);
  static const purple = Color(0xFF7B7BF5);
  static const borderDark = Color(0xFF4A4AE0);
  static const borderMid = Color(0xFF3A3A8A);
  static const outerBorder = Color(0xFF2A2A7A);
  static const inputBackground = Color(0xFF0A0A24);
  static const textDefault = Color(0xFFE0E0E0);
  static const textMuted = Color(0xFF9999DD);
  static const tabInactive = Color(0xFF6A6AB0);
  static const tabBackground = Color(0xFF1A1A4E);
  static const tabActiveBackground = Color(0xFF2A2A8E);
  static const buttonHover = Color(0xFF3A3A9E);
  static const convItemBg = Color(0xFF1A1A4E);
  static const convItemBorder = Color(0xFF2A2A6E);
  static const messagesBackground = Color(0xFF08081E);
  static const myMessageBg = Color(0xFF1A1A50);
  static const otherMessageBg = Color(0xFF121240);
  static const userInfoGreen = Color(0xFF44FF44);
  static const logoutRed = Color(0xFFFF6666);
  static const errorRed = Color(0xFFFF4444);
  static const successGreen = Color(0xFF44FF44);
  static const timeColor = Color(0xFF5555AA);
  static const noChatColor = Color(0xFF3A3A8A);
}
```

---

### Phase 6: Screen and Widget Breakdown

#### 6.1 `auth_screen.dart` -- Replicates `#auth-screen`

- Wraps everything in `RpgBox` widget (the double-bordered container)
- Contains the gold title "RPG CHAT" with sword emojis and text shadow
- Purple subtitle "~ Enter the realm ~"
- Tab bar with LOGIN / REGISTER tabs (controlled by local state, not Provider)
- Conditionally shows login or register form
- Status message area at bottom (error in red, success in green)
- On successful login: calls `AuthProvider.login()`, which triggers navigation to `ChatScreen`
- Width constrained to 400 logical pixels

**Login form fields:** Email input, Password input, "ENTER REALM" button
**Register form fields:** Email input, Password (min 6) input, "CREATE HERO" button

#### 6.2 `chat_screen.dart` -- Replicates `#chat-screen`

- Wrapped in `RpgBox`, constrained to 700x520
- **Header row:** Green user email with blinking cursor animation + red "LOGOUT" button
- **Body:** Row with Sidebar (200px) and Chat Main (expanded)

#### 6.3 `rpg_box.dart` -- The double-bordered container

Replicates `.rpg-box` CSS:
```dart
Container(
  decoration: BoxDecoration(
    color: RpgColors.boxBackground,
    border: Border.all(color: RpgColors.borderDark, width: 4),
    borderRadius: BorderRadius.circular(2),
    boxShadow: [BoxShadow(color: Color(0x881A1A5E), blurRadius: 20)],
  ),
  // Inner shadow simulated with a nested container that has a border
)
```

The `::before` outer border is replicated by wrapping in another Container with 8px margin and a 3px `outerBorder` colored border.

#### 6.4 `sidebar.dart` -- Replicates `.sidebar`

- "PARTY" title with gold text, bottom border
- New chat input row: TextField + "+" button
- Scrollable list of `ConversationItem` widgets

#### 6.5 `conversation_item.dart` -- Replicates `.conv-item`

- Shows the other user's email
- Active state: gold border + gold text + darker background
- Tap handler calls `ChatProvider.openConversation(convId)`

#### 6.6 `message_bubble.dart` -- Replicates `.message`

- Alignment: `Alignment.centerRight` for own messages, `Alignment.centerLeft` for others
- Max width 80% of parent
- Border color: gold (`#ffcc00`) for own, purple (`#7b7bf5`) for others
- Sender line: "sword You" for own, "shield {email}" for others
- Content text
- Time stamp right-aligned, muted color
- Background: `#1A1A50` own, `#121240` others

#### 6.7 `message_input_bar.dart` -- Replicates `.message-input-bar`

- Row: TextField (expanded) + "SEND" button
- TextField has RPG styling (dark bg, border turns gold on focus)
- Send on button tap or Enter key

#### 6.8 `no_chat_selected.dart` -- Replicates `.no-chat-selected`

- Centered text: "Select a party member\nor start a new quest\n\nsword"
- Muted color, centered alignment

---

### Phase 7: Service Implementation Details

#### 7.1 `api_service.dart`

```dart
class ApiService {
  final String baseUrl; // e.g. 'http://localhost:3000'

  Future<Map<String, dynamic>> register(String email, String password);
  // POST /auth/register, body: {email, password}
  // Returns: {id, email} or throws

  Future<String> login(String email, String password);
  // POST /auth/login, body: {email, password}
  // Returns: access_token string or throws
}
```

#### 7.2 `socket_service.dart`

```dart
class SocketService {
  io.Socket? _socket;

  void connect(String baseUrl, String token) {
    _socket = io.io(baseUrl, io.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': token})
      .setQuery({'token': token})
      .build());
  }

  void disconnect();
  void emit(String event, [dynamic data]);
  void on(String event, Function(dynamic) handler);
  void off(String event);

  // Convenience methods:
  void getConversations();
  void sendMessage(int recipientId, String content);
  void startConversation(String recipientEmail);
  void getMessages(int conversationId);
}
```

Key detail: The current frontend connects with both `auth: { token }` and `query: { token }`. The gateway reads from `client.handshake.query.token` or `client.handshake.auth?.token`. The Flutter socket client must replicate both.

#### 7.3 `auth_provider.dart`

```dart
class AuthProvider extends ChangeNotifier {
  String? _token;
  UserModel? _currentUser;
  final ApiService _api;

  bool get isLoggedIn => _token != null;
  String? get token => _token;
  UserModel? get currentUser => _currentUser;

  Future<void> login(String email, String password);
  // Calls _api.login(), decodes JWT to extract {sub, email}, stores token
  // Uses jwt_decoder package to decode the payload

  Future<String> register(String email, String password);
  // Calls _api.register(), returns success message

  void logout();
  // Clears token, user, notifies listeners
}
```

JWT decode: The current frontend does `JSON.parse(atob(token.split('.')[1]))` to get `{sub, email}`. In Flutter, use `JwtDecoder.decode(token)` which returns a `Map<String, dynamic>` with `sub` and `email`.

#### 7.4 `chat_provider.dart`

```dart
class ChatProvider extends ChangeNotifier {
  final SocketService _socket;
  List<ConversationModel> _conversations = [];
  int? _activeConversationId;
  List<MessageModel> _messages = [];

  void connectAndListen(String baseUrl, String token, int currentUserId);
  // Connects socket, sets up all listeners:
  //   conversationsList -> updates _conversations, notifyListeners
  //   messageHistory -> updates _messages, notifyListeners
  //   messageSent -> appends to _messages if active conv matches
  //   newMessage -> appends to _messages if active conv matches
  //   openConversation -> sets _activeConversationId, calls getMessages
  //   error -> could show snackbar

  void openConversation(int convId);
  void sendMessage(int recipientId, String content);
  void startConversation(String recipientEmail);
  void disconnect();
}
```

---

### Phase 8: Navigation and App Entry Point

**`main.dart`:**

```dart
void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider(ApiService(AppConfig.baseUrl))),
        ChangeNotifierProxyProvider<AuthProvider, ChatProvider>(...),
      ],
      child: MaterialApp(
        title: 'RPG Chat',
        theme: rpgThemeData, // dark theme with Press Start 2P
        home: AuthGate(), // checks isLoggedIn, shows AuthScreen or ChatScreen
      ),
    ),
  );
}
```

**`AuthGate` widget:** A simple Consumer that returns `AuthScreen` if not logged in, `ChatScreen` if logged in. When `AuthProvider` notifies after login, the widget tree rebuilds and switches screens. This matches the current behavior where `authScreen.style.display = 'none'` and `chatScreen.style.display = 'block'`.

**`app_config.dart`:**
```dart
class AppConfig {
  // Default for local dev; override via environment or build config
  static const String baseUrl = 'http://localhost:3000';
}
```

For Flutter web, this URL needs to match the backend. When running via Docker, this would be the backend service hostname/port.

---

### Phase 9: Blinking Cursor Animation

The current HTML has a CSS `@keyframes blink` animation on the underscore next to the user email. In Flutter, create a small `BlinkingCursor` widget:

```dart
class BlinkingCursor extends StatefulWidget { ... }
// Uses AnimationController with 1-second duration, step curve
// Toggles opacity between 0 and 1
// Displays Text('_') with the green user-info color
```

---

### Phase 10: Docker and docker-compose Updates

**`docker-compose.yml` (root level):**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: chatdb
    ports:
      - '5433:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend          # changed context
    ports:
      - '3000:3000'
    environment:
      DB_HOST: db
      DB_PORT: '5432'
      DB_USER: postgres
      DB_PASS: postgres
      DB_NAME: chatdb
      JWT_SECRET: my-super-secret-jwt-key-change-in-production
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - '8080:80'             # Serve Flutter web on port 8080
    depends_on:
      - backend

volumes:
  pgdata:
```

**`frontend/Dockerfile`:**
```dockerfile
# Build stage
FROM ghcr.io/cirruslabs/flutter:stable AS build
WORKDIR /app
COPY . .
RUN flutter pub get
RUN flutter build web --release

# Serve stage
FROM nginx:alpine
COPY --from=build /app/build/web /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**`frontend/nginx.conf`:**
Needed to proxy API requests from the Flutter web app to the backend, avoiding CORS in production:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /auth/ {
        proxy_pass http://backend:3000;
    }

    location /socket.io/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

With this nginx reverse proxy, the Flutter web app can use relative URLs (or same-origin) for both REST and WebSocket, avoiding CORS entirely in the Docker setup. The `AppConfig.baseUrl` would be empty string `''` (same origin) for Docker/production, and `'http://localhost:3000'` for local development.

---

### Phase 11: Implementation Sequence

The recommended order of implementation:

1. **Restructure directories** -- move backend into `backend/`, verify it still builds and runs
2. **Backend adjustments** -- remove static file serving, add CORS in `main.ts`
3. **Create Flutter project** -- `flutter create frontend`
4. **Add dependencies** to `pubspec.yaml`
5. **Create theme/constants** -- `rpg_theme.dart` with all colors and text styles
6. **Create models** -- UserModel, ConversationModel, MessageModel
7. **Create services** -- ApiService, SocketService
8. **Create providers** -- AuthProvider, ChatProvider
9. **Build auth screen** -- RpgBox, tabs, forms, status messages
10. **Build chat screen** -- header, sidebar, message area, input bar
11. **Build individual widgets** -- message_bubble, conversation_item, blinking_cursor
12. **Wire up main.dart** -- MultiProvider, AuthGate, navigation
13. **Test end-to-end** with `docker-compose up --build`
14. **Update docker-compose.yml** with frontend service
15. **Update README.md and CLAUDE.md**

---

### Potential Challenges

1. **Socket.IO transport:** The `socket_io_client` Dart package sometimes defaults to HTTP long-polling. Force WebSocket transport: `.setTransports(['websocket'])`. If there are connectivity issues, allow fallback: `.setTransports(['websocket', 'polling'])`.

2. **Flutter Web CORS:** When running Flutter web dev server (`flutter run -d chrome`) against the NestJS backend on a different port, CORS must be enabled on the backend. The `app.enableCors()` change covers this. For production Docker, the nginx proxy eliminates CORS.

3. **Press Start 2P font rendering:** The `google_fonts` package fetches fonts at runtime. For Flutter web, this works well. For mobile, consider bundling the font as an asset to avoid network dependency.

4. **RPG box double-border effect:** CSS `box-shadow: inset` and `::before` pseudo-elements have no direct Flutter equivalent. Use nested Containers: outer Container (3px border, 8px padding) wrapping inner Container (4px border, inner decoration with gradient or additional border).

5. **Scrollbar styling:** Flutter web supports custom scrollbars via `ScrollbarTheme` in the app theme. Use `Scrollbar` widget wrapping `ListView` with custom `ScrollbarThemeData`.

6. **Star background:** The radial gradient "stars" in the CSS background can be replicated with a `CustomPainter` that draws small white circles at fixed positions, or use a static background image asset for simplicity.

---

### Critical Files for Implementation

- `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` - Must remove static file serving and add CORS configuration
- `C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts` - Reference for all WebSocket events, payload shapes, and auth handshake to replicate in Flutter SocketService
- `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` - Complete reference for all visual design (CSS values, layout structure, colors) and client-side logic (socket events, state management, API calls) that must be faithfully replicated
- `C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml` - Must be updated to point to backend/ subdirectory and add frontend service
- `C:\Users\Lentach\desktop\mvp-chat-app\src\auth\auth.service.ts` - Reference for auth API response shapes (JWT payload structure with `sub` and `email` fields) needed for Flutter AuthProvider