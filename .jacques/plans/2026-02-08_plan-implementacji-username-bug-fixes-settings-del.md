# Plan Implementacji: Username + Bug Fixes + Settings + Delete Conversations

## Podsumowanie

Implementacja obejmuje:
1. **Dodanie pola `username`** do systemu (backend + frontend) - nowe pole przy rejestracji, wyświetlanie username zamiast email w UI
2. **Naprawienie bugu z ładowaniem konwersacji** - konwersacje nie pojawiają się od razu po zalogowaniu
3. **Naprawienie bugu z cachem w Mozilli** - wyszukiwanie użytkowników pokazuje złego użytkownika (problem z SharedPreferences cache)
4. **Ekran ustawień** - Settings screen z ikoną zębatki, wyświetlanie username+email, przycisk logout
5. **Usuwanie konwersacji** - możliwość skasowania chatu z listy (hard delete dla obu użytkowników)

## Strategia Migracji Bazy Danych

**Podejście: Nullable Username**
- Dodanie kolumny `username` jako **nullable** z unique constraint
- TypeORM `synchronize: true` automatycznie utworzy kolumnę przy restarcie backendu
- Istniejący użytkownicy będą mieli `username = null`
- Nowi użytkownicy podają username przy rejestracji
- Frontend fallback: wyświetlaj `username ?? email`

## Zmiany Backend

### 1. User Entity (`backend/src/users/user.entity.ts`)

Dodać pole:
```typescript
@Column({ unique: true, nullable: true })
username: string | null;
```

### 2. Register DTO (`backend/src/auth/dto/register.dto.ts`)

Dodać walidację username:
```typescript
@IsOptional()
@IsString()
@MinLength(3)
@Matches(/^[a-zA-Z0-9_]+$/, {
  message: 'Username can only contain letters, numbers and underscores'
})
username?: string;
```

### 3. Users Service (`backend/src/users/users.service.ts`)

- Zmienić sygnaturę `create(email, password, username?)`
- Dodać sprawdzenie unikalności username (case-insensitive query jak dla email)
- Dodać metodę `findByUsername(username)` z case-insensitive query

### 4. Auth Service (`backend/src/auth/auth.service.ts`)

- Zaktualizować `register()` - przyjąć username jako trzeci parametr
- Zaktualizować JWT payload w `login()`: `{ sub: userId, email, username }`

### 5. Auth Controller (`backend/src/auth/auth.controller.ts`)

- Zaktualizować `@Post('register')` - przekazać `dto.username` do `authService.register()`

### 6. Chat Gateway (`backend/src/chat/chat.gateway.ts`)

**Zaktualizować wszystkie WebSocket responses aby zawierały username:**

- Line 55: `client.data.user = { id, email, username }`
- Line 110: `messagePayload` - dodać `senderUsername: sender.username`
- Line 162-164, 205-206: `mapped` conversations - dodać `username` do `userOne` i `userTwo`
- Line 186: `mapped` messages - dodać `senderUsername: m.sender.username`

**Dodać nowy handler:**
```typescript
@SubscribeMessage('deleteConversation')
async handleDeleteConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: number },
) {
  const userId = client.data.user?.id;
  if (!userId) return;

  const conversation = await this.conversationsService.findById(data.conversationId);

  if (!conversation) {
    client.emit('error', { message: 'Conversation not found' });
    return;
  }

  // Authorization check
  if (conversation.userOne.id !== userId && conversation.userTwo.id !== userId) {
    client.emit('error', { message: 'Unauthorized' });
    return;
  }

  await this.conversationsService.delete(data.conversationId);

  // Refresh list
  const conversations = await this.conversationsService.findByUser(userId);
  const mapped = conversations.map((c) => ({
    id: c.id,
    userOne: { id: c.userOne.id, email: c.userOne.email, username: c.userOne.username },
    userTwo: { id: c.userTwo.id, email: c.userTwo.email, username: c.userTwo.username },
    createdAt: c.createdAt,
  }));
  client.emit('conversationsList', mapped);
}
```

### 7. Conversations Service (`backend/src/conversations/conversations.service.ts`)

Dodać metody:
```typescript
async findById(id: number): Promise<Conversation | null> {
  return this.convRepo.findOne({
    where: { id },
    relations: ['userOne', 'userTwo'],
  });
}

async delete(id: number): Promise<void> {
  await this.convRepo.delete({ id });
}
```

**Uwaga**: Sprawdzić czy Message entity ma `cascade: true` przy relation do Conversation. Jeśli nie, trzeba najpierw usunąć wiadomości przez MessagesService.

## Zmiany Frontend

### 1. Models

**UserModel** (`frontend/lib/models/user_model.dart`):
```dart
class UserModel {
  final int id;
  final String email;
  final String? username;

  UserModel({required this.id, required this.email, this.username});

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      email: json['email'] as String,
      username: json['username'] as String?,
    );
  }
}
```

**MessageModel** (`frontend/lib/models/message_model.dart`):
- Dodać pole `final String? senderUsername;`
- Zaktualizować `fromJson` aby parsowało `senderUsername`

**ConversationModel** (`frontend/lib/models/conversation_model.dart`):
- Zaktualizować `UserModel` w `userOne` i `userTwo` (już ma username z powyższej zmiany)

### 2. Services

**API Service** (`frontend/lib/services/api_service.dart`):
```dart
Future<Map<String, dynamic>> register(
  String email,
  String password,
  String? username,
) async {
  final body = {'email': email, 'password': password};
  if (username != null && username.isNotEmpty) {
    body['username'] = username;
  }
  // ... rest
}
```

**Socket Service** (`frontend/lib/services/socket_service.dart`):
```dart
void deleteConversation(int conversationId) {
  _socket?.emit('deleteConversation', {'conversationId': conversationId});
}
```

### 3. Providers

**Auth Provider** (`frontend/lib/providers/auth_provider.dart`):

- Line 32-35: Zaktualizować `_loadSavedToken()` - dodać `username: payload['username'] as String?`
- Line 40-52: Zaktualizować `register(email, password, username)` - dodać parametr username, przekazać do `_api.register()`
- Line 61-64: Zaktualizować `login()` - dodać `username: payload['username'] as String?`
- **KRYTYCZNE** - Line 88: Zmienić `prefs.remove('jwt_token')` na `prefs.clear()` (fix dla Firefox cache bug)

**Chat Provider** (`frontend/lib/providers/chat_provider.dart`):

Dodać metodę:
```dart
String getOtherUserUsername(ConversationModel conv) {
  if (_currentUserId == null) return '';
  final otherUser = conv.userOne.id == _currentUserId
      ? conv.userTwo
      : conv.userOne;
  return otherUser.username ?? otherUser.email;
}
```

**BUG FIX** - Usunąć redundantne wywołania:
- Line 81: Usunąć `_socketService.getConversations();` z `onMessageSent`
- Line 91: Usunąć `_socketService.getConversations();` z `onNewMessage`

**BUG FIX** - Dodać retry logic w `onConnect`:
```dart
onConnect: () {
  debugPrint('WebSocket connected, fetching conversations...');
  _socketService.getConversations();
  Future.delayed(const Duration(milliseconds: 500), () {
    if (_conversations.isEmpty) {
      debugPrint('Retrying getConversations...');
      _socketService.getConversations();
    }
  });
},
```

Dodać metodę delete:
```dart
void deleteConversation(int conversationId) {
  // Optimistic UI update
  _conversations.removeWhere((c) => c.id == conversationId);
  _lastMessages.remove(conversationId);

  if (_activeConversationId == conversationId) {
    _activeConversationId = null;
    _messages = [];
  }

  notifyListeners();
  _socketService.deleteConversation(conversationId);
}
```

### 4. Widgets & Screens

**Auth Form** (`frontend/lib/widgets/auth_form.dart`):
- Dodać `final _usernameController = TextEditingController()`
- Dodać pole username tylko dla rejestracji (`if (!widget.isLogin)`)
- Zmienić callback: `onSubmit(String email, String password, String? username)`

**Auth Screen** (`frontend/lib/screens/auth_screen.dart`):
- Zaktualizować `AuthForm.onSubmit` callback - przekazać username do `authProvider.register()`

**NOWY: Settings Screen** (`frontend/lib/screens/settings_screen.dart`):
- Utworzyć nowy plik
- Scaffold z AppBar "Settings"
- Sekcja "Account" - wyświetlać username i email (użyć `auth.currentUser`)
- Przycisk "Logout" - wywołać `chat.disconnect()` + `auth.logout()` + `Navigator.pop()`
- Użyć stylu `RpgTheme` dla spójności

**Conversations Screen** (`frontend/lib/screens/conversations_screen.dart`):
- Dodać import `settings_screen.dart`
- W AppBar (mobile i desktop) - dodać `IconButton` z ikoną `Icons.settings` obok logout
- Kliknięcie: `Navigator.push(MaterialPageRoute(builder: (_) => SettingsScreen()))`
- Zmienić `chat.getOtherUserEmail(conv)` na `chat.getOtherUserUsername(conv)`
- Dodać metodę `_deleteConversation(conversationId)` - pokazać AlertDialog z potwierdzeniem
- Po potwierdzeniu: `chat.deleteConversation(conversationId)`

**Conversation Tile** (`frontend/lib/widgets/conversation_tile.dart`):
- Zmienić parametr `email` na `displayName`
- Dodać parametr `final VoidCallback onDelete;`
- Dodać IconButton z `Icons.delete_outline` (kolor: `RpgTheme.logoutRed`)
- Umieścić w Column obok czasu (alignment right)

**Chat Detail Screen** (`frontend/lib/screens/chat_detail_screen.dart`):
- Zmienić `_getContactEmail()` na `_getContactName()` używając `chat.getOtherUserUsername(conv)`
- Zaktualizować AppBar title - wyświetlać username zamiast email

## Kolejność Implementacji

### Faza 1: Backend Changes (Sequential)
1. User entity - dodać kolumnę username
2. RegisterDto - dodać walidację
3. UsersService - dodać obsługę username
4. AuthService - zaktualizować register i JWT payload
5. AuthController - przekazać username
6. ChatGateway - zaktualizować wszystkie responses + dodać deleteConversation handler
7. ConversationsService - dodać findById i delete
8. **Restart backendu** - TypeORM utworzy kolumnę

### Faza 2: Frontend Models & Services (Sequential)
1. UserModel - dodać username
2. MessageModel - dodać senderUsername
3. ApiService - zaktualizować register
4. SocketService - dodać deleteConversation

### Faza 3: Frontend Providers (Sequential)
1. AuthProvider - username w JWT + prefs.clear() fix
2. ChatProvider - getOtherUserUsername + deleteConversation + bug fixes

### Faza 4: Frontend UI (Można równolegle)
1. AuthForm + AuthScreen - dodać pole username
2. SettingsScreen - utworzyć nowy screen
3. ConversationsScreen - settings icon + username display + delete handler
4. ConversationTile - username + delete button
5. ChatDetailScreen - username display

### Faza 5: Testing
1. Backend manual testing (Postman/curl)
2. Frontend testing (Chrome, Firefox, Brave)
3. Bug regression testing

## Weryfikacja End-to-End

### Test 1: Rejestracja z username
1. `cd frontend && flutter run -d chrome`
2. Click "Create Account"
3. Wprowadź: email: `test1@test.com`, username: `TestUser1`, password: `test123`
4. Verify: rejestracja udana, komunikat "Hero created! Now login."
5. Login z tym kontem
6. Verify: zalogowano pomyślnie

### Test 2: Wyświetlanie username
1. Zaloguj się jako `test1@test.com` (username: `TestUser1`)
2. Click settings icon (zębatka)
3. Verify: Settings screen pokazuje "Username: TestUser1", "Email: test1@test.com"
4. Click "Logout"
5. Verify: powrót do login screen

### Test 3: Konwersacje - ładowanie po loginie (fix bugu)
1. Zaloguj się jako `test1@test.com`
2. Start chat z `test2@test.com` (username: `TestUser2`)
3. Wyślij wiadomość
4. Logout
5. Login ponownie jako `test1@test.com`
6. **Verify**: Konwersacja z TestUser2 **pojawia się od razu** na liście (nie czekaj na wiadomość)

### Test 4: Firefox cache bug fix
1. Otwórz aplikację w **Firefox**
2. Zaloguj się jako `test1@test.com` (user ID = 1)
3. Start chat z `test2@test.com`
4. Verify: wyświetla się "TestUser2" (poprawnie)
5. **Logout**
6. Zaloguj się jako `test3@test.com` (user ID = 3)
7. Start chat z `test4@test.com`
8. **Verify**: wyświetla się "TestUser4" (NIE "TestUser2") - cache wyczyszczony

### Test 5: Usuwanie konwersacji
1. Zaloguj się jako `test1@test.com`
2. Miej konwersację z `test2@test.com`
3. Click delete icon przy tej konwersacji
4. Verify: pojawia się dialog "Delete Conversation? This will delete all messages."
5. Click "Delete"
6. Verify: konwersacja **natychmiast znika** z listy (optimistic update)
7. Logout i login jako `test2@test.com`
8. **Verify**: konwersacja z test1 **też zniknęła** (usunięta dla obu)

### Test 6: Wyświetlanie username w UI
1. Zaloguj jako test1
2. Chat z test2
3. Verify ConversationsScreen: lista pokazuje "TestUser2" (nie email)
4. Click na konwersację
5. Verify ChatDetailScreen: header pokazuje "TestUser2"
6. Wyślij wiadomość
7. Verify: bańka wiadomości nie musi pokazywać username (tylko content)

## Pliki do Modyfikacji

### Backend (7 plików)
- `backend/src/users/user.entity.ts`
- `backend/src/auth/dto/register.dto.ts`
- `backend/src/users/users.service.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/chat/chat.gateway.ts`
- `backend/src/conversations/conversations.service.ts`

### Frontend (12 plików)
- `frontend/lib/models/user_model.dart`
- `frontend/lib/models/message_model.dart`
- `frontend/lib/services/api_service.dart`
- `frontend/lib/services/socket_service.dart`
- `frontend/lib/providers/auth_provider.dart`
- `frontend/lib/providers/chat_provider.dart`
- `frontend/lib/widgets/auth_form.dart`
- `frontend/lib/screens/auth_screen.dart`
- `frontend/lib/screens/settings_screen.dart` (NOWY)
- `frontend/lib/screens/conversations_screen.dart`
- `frontend/lib/widgets/conversation_tile.dart`
- `frontend/lib/screens/chat_detail_screen.dart`

## Potencjalne Problemy

1. **Message cascade delete**: Sprawdzić czy Message entity ma `onDelete: CASCADE` przy FK do Conversation. Jeśli nie, dodać ręczne usuwanie przez MessagesService przed `conversation.delete()`.

2. **JWT token compatibility**: Stare tokeny bez username - backend musi obsługiwać gracefully (null username).

3. **Username conflicts**: Przy concurrent registration tego samego username - database unique constraint rzuci błąd, obsłużyć w try-catch z komunikatem "Username already taken".

4. **Firefox localStorage**: Mimo `prefs.clear()`, jeśli problem persists - rozważyć dodanie timestamp do cache key lub force logout przy version change.

5. **Retry logic**: 500ms może być za krótkie na wolnych sieciach - rozważyć exponential backoff lub dłuższy timeout.


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\de9e180f-937a-474c-947c-3491c989514f.jsonl