# Plan: System Zaproszeń do Znajomych (Friend Requests)

## Podsumowanie

Dodanie systemu zaproszeń do znajomych, który wymaga wzajemnej akceptacji przed możliwością chatowania. Obecnie każdy może wysłać wiadomość do każdego bez żadnej autoryzacji.

**Wymagania użytkownika:**
- ✅ Proste zaproszenia bez wiadomości
- ✅ Badge z licznikiem oczekujących zaproszeń
- ✅ Możliwość ponownego wysłania po odrzuceniu (brak blokowania)
- ✅ Usuwanie znajomych = kasowanie całej konwersacji

## Architektura Rozwiązania

### Backend (NestJS + TypeORM + Socket.IO)
1. **Nowa tabela**: `friend_requests` (sender, receiver, status, timestamps)
2. **Nowy moduł**: `FriendsModule` z service i entity
3. **6 nowych WebSocket eventów**: sendFriendRequest, acceptFriendRequest, rejectFriendRequest, getFriendRequests, getFriends, unfriend
4. **Autoryzacja**: Walidacja znajomości przed wysłaniem wiadomości/rozpoczęciem konwersacji

### Frontend (Flutter + Provider)
1. **Nowy model**: `FriendRequestModel`
2. **Rozszerzenie state**: `ChatProvider` z listą zaproszeń i licznikiem
3. **Nowy ekran**: `FriendRequestsScreen` z accept/reject
4. **Badge UI**: Czerwony licznik na ConversationsScreen
5. **Unfriend**: Opcja w ChatDetailScreen menu

---

## Kolejność Implementacji

### FAZA 1: BACKEND (Wykonaj najpierw)

#### 1.1 Utworzenie FriendRequest Entity
**Plik**: `backend/src/friends/friend-request.entity.ts` *(NOWY)*

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum FriendRequestStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('friend_requests')
@Index(['sender', 'receiver'])
export class FriendRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({
    type: 'enum',
    enum: FriendRequestStatus,
    default: FriendRequestStatus.PENDING,
  })
  status: FriendRequestStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;
}
```

**Schema SQL** (auto-tworzona przez TypeORM):
- Brak unique constraint na (sender, receiver) - pozwala na ponowne wysyłanie
- Cascade delete gdy user jest usuwany
- Indexy na sender_id, receiver_id, status dla wydajności

---

#### 1.2 Utworzenie FriendsService
**Plik**: `backend/src/friends/friends.service.ts` *(NOWY)*

**Kluczowe metody**:

```typescript
@Injectable()
export class FriendsService {
  // Wysyła zaproszenie. Jeśli oba kierunki pending → auto-akceptacja
  async sendRequest(sender: User, receiver: User): Promise<FriendRequest>

  // Akceptuje zaproszenie (tylko receiver)
  async acceptRequest(requestId: number, userId: number): Promise<FriendRequest>

  // Odrzuca zaproszenie (tylko receiver)
  async rejectRequest(requestId: number, userId: number): Promise<FriendRequest>

  // Sprawdza czy są znajomymi (dla autoryzacji)
  async areFriends(userId1: number, userId2: number): Promise<boolean>

  // Pobiera oczekujące zaproszenia
  async getPendingRequests(userId: number): Promise<FriendRequest[]>

  // Pobiera listę znajomych
  async getFriends(userId: number): Promise<User[]>

  // Usuwa znajomość (kasuje accepted requests)
  async unfriend(userId1: number, userId2: number): Promise<boolean>

  // Licznik dla badge
  async getPendingRequestCount(userId: number): Promise<number>
}
```

**Ważne edge case'y**:
- Wzajemne zaproszenia → auto-akceptacja obu
- Duplikat pending → ConflictException
- Odrzucone zaproszenia NIE blokują nowych (brak unique constraint)

---

#### 1.3 Utworzenie FriendsModule
**Plik**: `backend/src/friends/friends.module.ts` *(NOWY)*

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendRequest } from './friend-request.entity';
import { FriendsService } from './friends.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([FriendRequest]), UsersModule],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
```

---

#### 1.4 Aktualizacja AppModule
**Plik**: `backend/src/app.module.ts`

**Zmiany**:
1. Dodaj import: `import { FriendsModule } from './friends/friends.module';`
2. Dodaj import: `import { FriendRequest } from './friends/friend-request.entity';`
3. Dodaj `FriendRequest` do tablicy `entities` w TypeOrmModule (linia ~23)
4. Dodaj `FriendsModule` do tablicy `imports` (linia ~30)

---

#### 1.5 Dodanie Autoryzacji do ChatGateway
**Plik**: `backend/src/chat/chat.gateway.ts`

**Zmiana 1**: Dodaj FriendsService do constructor (linia 25-30):
```typescript
constructor(
  private jwtService: JwtService,
  private usersService: UsersService,
  private conversationsService: ConversationsService,
  private messagesService: MessagesService,
  private friendsService: FriendsService, // NOWY
) {}
```

**Zmiana 2**: Dodaj autoryzację w `handleMessage` (po linii 91, przed findOrCreate):
```typescript
const areFriends = await this.friendsService.areFriends(senderId, data.recipientId);
if (!areFriends) {
  client.emit('error', { message: 'You must be friends to send messages' });
  return;
}
```

**Zmiana 3**: Dodaj autoryzację w `handleStartConversation` (linia ~154):
```typescript
const areFriends = await this.friendsService.areFriends(sender.id, recipient.id);
if (!areFriends) {
  client.emit('error', { message: 'You must be friends to start a conversation' });
  return;
}
```

**Zmiana 4**: Dodaj 6 nowych event handlerów na końcu klasy:

```typescript
// 1. Wyślij zaproszenie przez email
@SubscribeMessage('sendFriendRequest')
async handleSendFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { recipientEmail: string },
) {
  // Walidacja, tworzenie request, powiadomienie online users
}

// 2. Akceptuj zaproszenie
@SubscribeMessage('acceptFriendRequest')
async handleAcceptFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { requestId: number },
) {
  // Akceptacja, powiadomienie nadawcy i odbiorcy
}

// 3. Odrzuć zaproszenie (silent - nadawca NIE jest informowany)
@SubscribeMessage('rejectFriendRequest')
async handleRejectFriendRequest(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { requestId: number },
) {
  // Odrzucenie, update badge count
}

// 4. Pobierz oczekujące zaproszenia
@SubscribeMessage('getFriendRequests')
async handleGetFriendRequests(@ConnectedSocket() client: Socket) {
  // Zwraca friendRequestsList event
}

// 5. Pobierz listę znajomych
@SubscribeMessage('getFriends')
async handleGetFriends(@ConnectedSocket() client: Socket) {
  // Zwraca friendsList event
}

// 6. Usuń znajomego i konwersację
@SubscribeMessage('unfriend')
async handleUnfriend(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { userId: number },
) {
  // Unfriend, delete conversation, powiadom obu userów
}
```

**Nowe Server→Client eventy**:
- `newFriendRequest` - nowe zaproszenie
- `friendRequestSent` - potwierdzenie wysłania
- `friendRequestAccepted` - zaakceptowane
- `friendRequestRejected` - odrzucone (tylko dla receiver)
- `friendRequestsList` - lista pending requests
- `friendsList` - lista znajomych
- `pendingRequestsCount` - licznik dla badge
- `unfriended` - ktoś cię unfriendował

---

#### 1.6 Aktualizacja ChatModule
**Plik**: `backend/src/chat/chat.module.ts`

**Zmiany**:
1. Dodaj import: `import { FriendsModule } from '../friends/friends.module';`
2. Dodaj `FriendsModule` do tablicy `imports` (linia 9)

---

#### 1.7 Test Backend
Przed przejściem do frontendu, przetestuj backend:

```bash
cd backend
npm run build
npm run start:dev
```

**Testy manualne** (użyj Socket.IO client lub Postman):
1. Połącz z WebSocket z JWT token
2. Wyślij `sendFriendRequest` z `{recipientEmail: "test@example.com"}`
3. Sprawdź czy `newFriendRequest` dociera do odbiorcy (jeśli online)
4. Zaakceptuj przez `acceptFriendRequest` z `{requestId: 1}`
5. Sprawdź czy `sendMessage` do nie-znajomego zwraca error
6. Sprawdź czy `unfriend` kasuje konwersację

---

### FAZA 2: FRONTEND (Wykonaj po backend)

#### 2.1 Utworzenie FriendRequestModel
**Plik**: `frontend/lib/models/friend_request_model.dart` *(NOWY)*

```dart
import 'user_model.dart';

class FriendRequestModel {
  final int id;
  final UserModel sender;
  final UserModel receiver;
  final String status;
  final DateTime createdAt;
  final DateTime? respondedAt;

  FriendRequestModel({
    required this.id,
    required this.sender,
    required this.receiver,
    required this.status,
    required this.createdAt,
    this.respondedAt,
  });

  factory FriendRequestModel.fromJson(Map<String, dynamic> json) {
    return FriendRequestModel(
      id: json['id'] as int,
      sender: UserModel.fromJson(json['sender']),
      receiver: UserModel.fromJson(json['receiver']),
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt']),
      respondedAt: json['respondedAt'] != null
        ? DateTime.parse(json['respondedAt'])
        : null,
    );
  }
}
```

---

#### 2.2 Rozszerzenie SocketService
**Plik**: `frontend/lib/services/socket_service.dart`

**Zmiana 1**: Dodaj callback parametry do `connect()` (po linii 18):
```dart
required void Function(dynamic) onFriendRequestsList,
required void Function(dynamic) onNewFriendRequest,
required void Function(dynamic) onFriendRequestSent,
required void Function(dynamic) onFriendRequestAccepted,
required void Function(dynamic) onFriendRequestRejected,
required void Function(dynamic) onPendingRequestsCount,
required void Function(dynamic) onFriendsList,
required void Function(dynamic) onUnfriended,
```

**Zmiana 2**: Zarejestruj listenery (po linii 37):
```dart
_socket!.on('friendRequestsList', onFriendRequestsList);
_socket!.on('newFriendRequest', onNewFriendRequest);
_socket!.on('friendRequestSent', onFriendRequestSent);
_socket!.on('friendRequestAccepted', onFriendRequestAccepted);
_socket!.on('friendRequestRejected', onFriendRequestRejected);
_socket!.on('pendingRequestsCount', onPendingRequestsCount);
_socket!.on('friendsList', onFriendsList);
_socket!.on('unfriended', onUnfriended);
```

**Zmiana 3**: Dodaj metody emit (na końcu klasy):
```dart
void sendFriendRequest(String recipientEmail) {
  _socket?.emit('sendFriendRequest', {'recipientEmail': recipientEmail});
}

void acceptFriendRequest(int requestId) {
  _socket?.emit('acceptFriendRequest', {'requestId': requestId});
}

void rejectFriendRequest(int requestId) {
  _socket?.emit('rejectFriendRequest', {'requestId': requestId});
}

void getFriendRequests() {
  _socket?.emit('getFriendRequests');
}

void getFriends() {
  _socket?.emit('getFriends');
}

void unfriend(int userId) {
  _socket?.emit('unfriend', {'userId': userId});
}
```

---

#### 2.3 Rozszerzenie ChatProvider
**Plik**: `frontend/lib/providers/chat_provider.dart`

**Zmiana 1**: Dodaj import (po linii 4):
```dart
import '../models/friend_request_model.dart';
```

**Zmiana 2**: Dodaj zmienne stanu (po linii 16):
```dart
List<FriendRequestModel> _friendRequests = [];
int _pendingRequestsCount = 0;
List<UserModel> _friends = [];
```

**Zmiana 3**: Dodaj gettery (po linii 24):
```dart
List<FriendRequestModel> get friendRequests => _friendRequests;
int get pendingRequestsCount => _pendingRequestsCount;
List<UserModel> get friends => _friends;
```

**Zmiana 4**: Dodaj callbacki do `connect()` (w parametrach _socketService.connect):
```dart
onFriendRequestsList: (data) {
  _friendRequests = (data as List)
    .map((r) => FriendRequestModel.fromJson(r))
    .toList();
  notifyListeners();
},
onNewFriendRequest: (data) {
  _friendRequests.insert(0, FriendRequestModel.fromJson(data));
  notifyListeners();
},
onFriendRequestAccepted: (data) {
  final request = FriendRequestModel.fromJson(data);
  _friendRequests.removeWhere((r) => r.id == request.id);
  _socketService.getConversations(); // Odśwież konwersacje
  notifyListeners();
},
onFriendRequestRejected: (data) {
  final request = FriendRequestModel.fromJson(data);
  _friendRequests.removeWhere((r) => r.id == request.id);
  notifyListeners();
},
onPendingRequestsCount: (data) {
  _pendingRequestsCount = (data as Map)['count'];
  notifyListeners();
},
onFriendsList: (data) {
  _friends = (data as List)
    .map((u) => UserModel.fromJson(u))
    .toList();
  notifyListeners();
},
onUnfriended: (data) {
  final userId = (data as Map)['userId'];
  _conversations.removeWhere((c) =>
    c.userOne.id == userId || c.userTwo.id == userId);
  if (_activeConversationId != null) {
    // Jeśli aktywna konwersacja to z tym userem, zamknij
    _activeConversationId = null;
    _messages = [];
  }
  notifyListeners();
},
```

**Zmiana 5**: Dodaj metody (na końcu klasy):
```dart
void sendFriendRequest(String recipientEmail) {
  _socketService.sendFriendRequest(recipientEmail);
}

void acceptFriendRequest(int requestId) {
  _socketService.acceptFriendRequest(requestId);
}

void rejectFriendRequest(int requestId) {
  _socketService.rejectFriendRequest(requestId);
}

void fetchFriendRequests() {
  _socketService.getFriendRequests();
}

void fetchFriends() {
  _socketService.getFriends();
}

void unfriend(int userId) {
  _socketService.unfriend(userId);
}

bool isFriend(int userId) {
  return _friends.any((f) => f.id == userId);
}
```

**Zmiana 6**: Wyczyść state w `disconnect()`:
```dart
_friendRequests = [];
_pendingRequestsCount = 0;
_friends = [];
```

---

#### 2.4 Utworzenie FriendRequestsScreen
**Plik**: `frontend/lib/screens/friend_requests_screen.dart` *(NOWY)*

**UI Components**:
- AppBar z tytułem "Friend Requests"
- Pusta lista → ikona + "No pending requests"
- Lista zaproszeń:
  - Avatar z pierwszą literą username/email
  - Displayname (username lub email)
  - Tekst "wants to add you as a friend"
  - Zielony przycisk ✓ (accept)
  - Czerwony przycisk ✗ (reject)

**Lifecycle**:
- `initState()` → wywołaj `chat.fetchFriendRequests()`
- Reactywne UI przez `Consumer<ChatProvider>`

---

#### 2.5 Dodanie Badge do ConversationsScreen
**Plik**: `frontend/lib/screens/conversations_screen.dart`

**Zmiana 1**: Import (po linii 8):
```dart
import 'friend_requests_screen.dart';
```

**Zmiana 2**: Metoda nawigacji:
```dart
void _openFriendRequests() {
  Navigator.push(
    context,
    MaterialPageRoute(builder: (_) => const FriendRequestsScreen()),
  );
}
```

**Zmiana 3**: Badge w AppBar (mobile layout, linia ~119):
```dart
actions: [
  Stack(
    children: [
      IconButton(
        icon: const Icon(Icons.person_add),
        onPressed: _openFriendRequests,
      ),
      Consumer<ChatProvider>(
        builder: (context, chat, _) {
          if (chat.pendingRequestsCount == 0) {
            return const SizedBox.shrink();
          }
          return Positioned(
            right: 8, top: 8,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: const BoxDecoration(
                color: Colors.red,
                shape: BoxShape.circle,
              ),
              child: Text(
                '${chat.pendingRequestsCount}',
                style: RpgTheme.bodyFont(
                  fontSize: 10,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          );
        },
      ),
    ],
  ),
  // ... settings, logout buttons
],
```

**Zmiana 4**: To samo dla desktop layout (linia ~164)

**Zmiana 5**: Fetch requests przy connect (po linii 25):
```dart
chat.fetchFriendRequests();
chat.fetchFriends();
```

---

#### 2.6 Aktualizacja NewChatScreen
**Plik**: `frontend/lib/screens/new_chat_screen.dart`

**Zmiana 1**: Tytuł ekranu (linia ~54):
```dart
title: Text('Add Friend', style: RpgTheme.bodyFont(...))
```

**Zmiana 2**: Opis (linia ~70):
```dart
Text(
  'Enter the email of the person you want to add:',
  style: RpgTheme.bodyFont(...),
)
```

**Zmiana 3**: Przycisk (linia ~97):
```dart
const Text('Send Friend Request')
```

**Zmiana 4**: Logika `_startChat()` (linia 23-31):
```dart
void _startChat() {
  final email = _emailController.text.trim();
  if (email.isEmpty) return;

  setState(() => _loading = true);
  context.read<ChatProvider>().sendFriendRequest(email);

  Future.delayed(const Duration(milliseconds: 500), () {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Friend request sent to $email'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
    }
  });
}
```

---

#### 2.7 Dodanie Unfriend do ChatDetailScreen
**Plik**: `frontend/lib/screens/chat_detail_screen.dart`

**Zmiana 1**: Dodaj metodę `_unfriend()`:
```dart
void _unfriend() {
  final chat = context.read<ChatProvider>();
  final conv = chat.conversations.firstWhere((c) => c.id == widget.conversationId);
  final otherUserId = chat.getOtherUserId(conv);
  final otherUsername = chat.getOtherUserUsername(conv);

  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('Unfriend $otherUsername?'),
      content: Text('This will delete your entire conversation history.'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            Navigator.pop(ctx);
            chat.unfriend(otherUserId);
            if (!widget.isEmbedded && mounted) {
              Navigator.pop(context); // Wróć do conversations
            }
          },
          child: Text('Unfriend', style: TextStyle(color: Colors.red)),
        ),
      ],
    ),
  );
}
```

**Zmiana 2**: Dodaj PopupMenuButton w AppBar:
```dart
actions: [
  PopupMenuButton<String>(
    onSelected: (value) {
      if (value == 'unfriend') _unfriend();
    },
    itemBuilder: (ctx) => [
      PopupMenuItem(
        value: 'unfriend',
        child: Row(
          children: [
            Icon(Icons.person_remove, color: Colors.red),
            SizedBox(width: 8),
            Text('Unfriend'),
          ],
        ),
      ),
    ],
  ),
],
```

---

### FAZA 3: MIGRACJA I TESTY

#### 3.1 Strategia Migracji Istniejących Konwersacji

**Opcja A (Zalecana)**: Wymuś znajomość dla wszystkich konwersacji
- Utworzyć accepted friend requests dla wszystkich istniejących par w conversations
- Skrypt migracyjny: `backend/src/migration/friend-migration.ts`

**Opcja B**: Pozwól na stare konwersacje bez znajomości
- Modyfikacja autoryzacji: `if (!existingConv && !areFriends) { error }`

**Decyzja**: Użyj Opcji A dla bezpieczeństwa.

**Wykonanie migracji**:
```bash
cd backend
npm run build
# Uruchom skrypt migracyjny raz
```

---

#### 3.2 Testy End-to-End

**Scenariusz 1: Standardowy flow**
1. ✅ User A wysyła zaproszenie do User B
2. ✅ User B widzi badge "1" na ConversationsScreen
3. ✅ User B otwiera FriendRequestsScreen
4. ✅ User B akceptuje zaproszenie
5. ✅ Oba users widzą nową konwersację
6. ✅ User A wysyła wiadomość → sukces
7. ✅ User A unfrienduje User B
8. ✅ Konwersacja znika u obu users
9. ✅ User A próbuje wysłać wiadomość → error

**Scenariusz 2: Odrzucenie**
1. ✅ User A wysyła zaproszenie do User B
2. ✅ User B odrzuca
3. ✅ User A może natychmiast wysłać ponownie

**Scenariusz 3: Wzajemne zaproszenia**
1. ✅ User A wysyła do User B
2. ✅ User B wysyła do User A (przed akceptacją A→B)
3. ✅ Oba zaproszenia auto-akceptowane
4. ✅ Konwersacja dostępna natychmiast

**Scenariusz 4: Offline user**
1. ✅ User B offline
2. ✅ User A wysyła zaproszenie
3. ✅ User B loguje się
4. ✅ Badge pokazuje "1"
5. ✅ Zaproszenie widoczne w liście

**Scenariusz 5: Unfriend podczas pisania**
1. ✅ User B ma otwarty chat z User A, wpisuje wiadomość
2. ✅ User A unfrienduje User B
3. ✅ User B otrzymuje event `unfriended`
4. ✅ Chat zamyka się, konwersacja znika

---

## Weryfikacja

### Backend Checklist
- [ ] `friend_requests` tabela utworzona w PostgreSQL
- [ ] `FriendsService.areFriends()` zwraca true dla znajomych
- [ ] `sendMessage` do nie-znajomego zwraca error
- [ ] `startConversation` do nie-znajomego zwraca error
- [ ] `acceptFriendRequest` akceptuje i emituje eventy
- [ ] `unfriend` kasuje friend requests i konwersację
- [ ] Wzajemne zaproszenia auto-akceptują się

### Frontend Checklist
- [ ] Badge pokazuje poprawną liczbę zaproszeń
- [ ] FriendRequestsScreen wyświetla listę pending requests
- [ ] Accept/Reject działa i aktualizuje UI
- [ ] NewChatScreen wysyła zaproszenie zamiast tworzyć chat
- [ ] Unfriend kasuje konwersację lokalnie
- [ ] Real-time update badge gdy przychodzi nowe zaproszenie
- [ ] Event `unfriended` zamyka aktywny chat

### Database Verification
```sql
-- Sprawdź czy tabela istnieje
SELECT * FROM friend_requests;

-- Sprawdź istniejące znajomości
SELECT fr.*, u1.email as sender_email, u2.email as receiver_email
FROM friend_requests fr
JOIN users u1 ON fr.sender_id = u1.id
JOIN users u2 ON fr.receiver_id = u2.id
WHERE fr.status = 'accepted';
```

---

## Kluczowe Pliki do Modyfikacji

### Backend (10 plików)
1. ✏️ **backend/src/friends/friend-request.entity.ts** *(NOWY)* - Entity z enum status
2. ✏️ **backend/src/friends/friends.service.ts** *(NOWY)* - 9 metod business logic
3. ✏️ **backend/src/friends/friends.module.ts** *(NOWY)* - Module definition
4. ✏️ **backend/src/app.module.ts** - Dodaj FriendsModule i FriendRequest entity
5. ✏️ **backend/src/chat/chat.module.ts** - Import FriendsModule
6. ✏️ **backend/src/chat/chat.gateway.ts** - Inject FriendsService, dodaj 6 handlerów, dodaj autoryzację
7. ✏️ **backend/src/conversations/conversations.service.ts** - Opcjonalnie: dodaj findAll() dla migracji

### Frontend (7 plików)
1. ✏️ **frontend/lib/models/friend_request_model.dart** *(NOWY)* - Model z fromJson
2. ✏️ **frontend/lib/screens/friend_requests_screen.dart** *(NOWY)* - UI z accept/reject
3. ✏️ **frontend/lib/services/socket_service.dart** - 8 nowych callbacków, 6 nowych metod emit
4. ✏️ **frontend/lib/providers/chat_provider.dart** - 3 state vars, 8 callbacków, 7 metod
5. ✏️ **frontend/lib/screens/conversations_screen.dart** - Badge UI w AppBar, fetch requests
6. ✏️ **frontend/lib/screens/new_chat_screen.dart** - Zmień na "Send Friend Request"
7. ✏️ **frontend/lib/screens/chat_detail_screen.dart** - Dodaj unfriend w PopupMenu

---

## WebSocket Events - Pełna Specyfikacja

### Client → Server
| Event | Payload | Opis |
|-------|---------|------|
| `sendFriendRequest` | `{recipientEmail: string}` | Wyślij zaproszenie po email |
| `acceptFriendRequest` | `{requestId: number}` | Zaakceptuj zaproszenie |
| `rejectFriendRequest` | `{requestId: number}` | Odrzuć zaproszenie |
| `getFriendRequests` | - | Pobierz pending requests |
| `getFriends` | - | Pobierz listę znajomych |
| `unfriend` | `{userId: number}` | Usuń znajomego |

### Server → Client
| Event | Payload | Opis |
|-------|---------|------|
| `newFriendRequest` | `FriendRequestModel` | Nowe zaproszenie (real-time) |
| `friendRequestSent` | `FriendRequestModel` | Potwierdzenie wysłania |
| `friendRequestAccepted` | `FriendRequestModel` | Zaakceptowane (obie strony) |
| `friendRequestRejected` | `FriendRequestModel` | Odrzucone (tylko receiver) |
| `friendRequestsList` | `FriendRequestModel[]` | Lista pending |
| `friendsList` | `UserModel[]` | Lista znajomych |
| `pendingRequestsCount` | `{count: number}` | Licznik dla badge |
| `unfriended` | `{userId: number}` | Ktoś cię unfriendował |

---

## Edge Cases - Obsługa

| Sytuacja | Obsługa |
|----------|---------|
| Duplikat pending request | ConflictException w sendRequest() |
| Wzajemne zaproszenia | Auto-akceptacja obu w sendRequest() |
| Unfriend podczas pisania | Event `unfriended` → zamknięcie chatu |
| Offline user dostaje zaproszenie | Badge count przy logowaniu przez getFriendRequests() |
| Resend po reject | Brak unique constraint → możliwe natychmiast |
| User deleted | CASCADE DELETE na FK usuwa wszystkie jego requests |

---

## Decyzje Projektowe

1. **Brak unique constraint** → Pozwala na spam, ale zgodne z wymaganiami
2. **Silent rejection** → Nadawca NIE dostaje powiadomienia o odrzuceniu
3. **Auto-accept mutual requests** → Lepszy UX gdy obie strony chcą się dodać
4. **Cascade delete konwersacji** → Zgodnie z wymaganiem "usunięcie = kasowanie historii"
5. **Real-time badge** → WebSocket event `pendingRequestsCount` aktualizuje UI natychmiast

---

## Podsumowanie Zmian

- **Backend**: +3 nowe pliki, ~4 zmodyfikowane, +1 tabela PostgreSQL, +6 WebSocket eventów
- **Frontend**: +2 nowe pliki, ~5 zmodyfikowanych, +1 model, +badge UI, +unfriend dialog
- **Database**: +1 tabela `friend_requests` z 3 statusami, indexy na wydajność
- **Security**: Autoryzacja przed wysłaniem wiadomości/rozpoczęciem konwersacji

**Czas implementacji**: ~3-4 godziny (backend 1.5h, frontend 1.5h, testy 1h)


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\a21913c1-e32e-4c40-8664-120c9453b40d.jsonl