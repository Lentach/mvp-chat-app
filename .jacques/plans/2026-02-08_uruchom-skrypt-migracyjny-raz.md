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