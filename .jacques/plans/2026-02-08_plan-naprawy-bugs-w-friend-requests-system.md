# Plan Naprawy: Bugs w Friend Requests System

## Podsumowanie Problemów

System friend requests nie działa poprawnie. Po akceptacji zaproszenia żaden z użytkowników nie widzi drugiego na liście znajomych. Nowe zaproszenia nie pojawiają się w czasie rzeczywistym.

**Zgłoszone problemy:**
1. ❌ User B akceptuje zaproszenie → User A nie pojawia się na liście znajomych
2. ❌ User B wysyła zaproszenie do User A → nie pojawia się u User A
3. ❌ Po odświeżeniu strony lista znajomych dalej pusta
4. ❌ Komunikat "zaproszenie już wysłane" ale User A go nie widzi

## Zidentyfikowane Bugi (5 Critical Issues)

### **BUG #1: Missing Relations in acceptRequest() - CRITICAL**
**Plik:** `backend/src/friends/friends.service.ts` (linie 97-125)

**Problem:**
- `acceptRequest()` nie ładuje relacji User jawnie przy `findOne()`
- Zwracany `FriendRequest` ma puste/null obiekty `sender` i `receiver`
- `getFriends()` nie może wyciągnąć User ID z pustych obiektów
- Rezultat: pusta lista znajomych

**Rozwiązanie:**
```typescript
// W acceptRequest() - dodaj relations przy obu findOne():
const request = await this.friendRequestRepository.findOne({
  where: { id: requestId },
  relations: ['sender', 'receiver'], // ← DODAJ TO
});

// Oraz przed return:
const updated = await this.friendRequestRepository.findOne({
  where: { id: requestId },
  relations: ['sender', 'receiver'], // ← DODAJ TO
});
```

---

### **BUG #2: Missing getFriends() After Accept in Gateway - CRITICAL**
**Plik:** `backend/src/chat/chat.gateway.ts` (linie 312-376)

**Problem:**
- `handleAcceptFriendRequest()` nie wywołuje `getFriends()` po akceptacji
- Nie emituje `friendsList` event do żadnego użytkownika
- Users muszą ręcznie odświeżyć stronę aby zobaczyć znajomego

**Rozwiązanie:**
Dodaj po linii 372 (przed końcem try block):
```typescript
// Emit updated friends lists to BOTH users
const senderFriends = await this.friendsService.getFriends(friendRequest.sender.id);
const senderFriendsPayload = senderFriends.map((f) => ({
  id: f.id,
  email: f.email,
  username: f.username,
}));

const receiverFriends = await this.friendsService.getFriends(userId);
const receiverFriendsPayload = receiverFriends.map((f) => ({
  id: f.id,
  email: f.email,
  username: f.username,
}));

// Send to sender (if online)
if (senderSocketId) {
  this.server.to(senderSocketId).emit('friendsList', senderFriendsPayload);
}

// Send to receiver (current user)
client.emit('friendsList', receiverFriendsPayload);
```

---

### **BUG #3: Mutual Accept Doesn't Emit Events - MODERATE**
**Plik:** `backend/src/chat/chat.gateway.ts` (linia ~280)

**Problem:**
- Gdy User B wysyła zaproszenie do User A (który już wysłał do B), `sendRequest()` auto-akceptuje oba
- Ale `handleSendFriendRequest` NIE emituje `friendRequestAccepted` w tym przypadku
- Użytkownicy nie dostają powiadomienia o auto-akceptacji

**Rozwiązanie:**
W `handleSendFriendRequest()`, po wywołaniu `sendRequest()`, sprawdź status zwróconego request:
```typescript
const friendRequest = await this.friendsService.sendRequest(sender, recipient);

// Check if it was auto-accepted (mutual request scenario)
if (friendRequest.status === 'accepted') {
  // It was auto-accepted! Emit acceptance events to both users
  const payload = {
    id: friendRequest.id,
    sender: { id: sender.id, email: sender.email, username: sender.username },
    receiver: { id: recipient.id, email: recipient.email, username: recipient.username },
    status: friendRequest.status,
    createdAt: friendRequest.createdAt,
    respondedAt: friendRequest.respondedAt,
  };

  // Notify both users about the mutual accept
  client.emit('friendRequestAccepted', payload);
  if (recipientSocketId) {
    this.server.to(recipientSocketId).emit('friendRequestAccepted', payload);
  }

  // Emit updated friends lists to both
  const senderFriends = await this.friendsService.getFriends(sender.id);
  const receiverFriends = await this.friendsService.getFriends(recipient.id);

  client.emit('friendsList', senderFriends.map(f => ({
    id: f.id, email: f.email, username: f.username
  })));

  if (recipientSocketId) {
    this.server.to(recipientSocketId).emit('friendsList', receiverFriends.map(f => ({
      id: f.id, email: f.email, username: f.username
    })));
  }
}
```

---

### **BUG #4: Frontend Missing getFriends() Call - MODERATE**
**Plik:** `frontend/lib/providers/chat_provider.dart` (linie 146-151)

**Problem:**
- `onFriendRequestAccepted` callback nie wywołuje `getFriends()`
- Nawet jeśli backend wysłałby `friendsList`, frontend nie żąda aktualizacji

**Rozwiązanie:**
```dart
onFriendRequestAccepted: (data) {
  final request = FriendRequestModel.fromJson(data as Map<String, dynamic>);
  _friendRequests.removeWhere((r) => r.id == request.id);
  _socketService.getConversations();
  _socketService.getFriends(); // ← DODAJ TĘ LINIĘ
  notifyListeners();
},
```

---

### **BUG #5: Missing Relations in rejectRequest() - LOW PRIORITY**
**Plik:** `backend/src/friends/friends.service.ts` (linie 127-154)

**Problem:**
- Taki sam jak Bug #1, ale dla `rejectRequest()`
- Rzadziej używane, ale powinno być naprawione dla spójności

**Rozwiązanie:**
Dodaj `relations: ['sender', 'receiver']` do obu `findOne()` w `rejectRequest()`:
```typescript
const request = await this.friendRequestRepository.findOne({
  where: { id: requestId },
  relations: ['sender', 'receiver'], // ← DODAJ
});

// ... i przed return:
const updated = await this.friendRequestRepository.findOne({
  where: { id: requestId },
  relations: ['sender', 'receiver'], // ← DODAJ
});
```

---

## Kolejność Naprawy (Priorytet)

### FAZA 1: Backend Critical Fixes
Napraw najpierw backend, ponieważ frontend zależy od poprawnych danych.

**1.1 Fix FriendsService.acceptRequest()** ⚠️ CRITICAL
- Plik: `backend/src/friends/friends.service.ts`
- Linie: 97, 121-123
- Dodaj `relations: ['sender', 'receiver']` do obu `findOne()`

**1.2 Fix FriendsService.rejectRequest()** 📋 LOW PRIORITY
- Plik: `backend/src/friends/friends.service.ts`
- Linie: 127, 149-151
- Dodaj `relations: ['sender', 'receiver']` do obu `findOne()`

**1.3 Fix ChatGateway.handleAcceptFriendRequest()** ⚠️ CRITICAL
- Plik: `backend/src/chat/chat.gateway.ts`
- Linia: po 372
- Dodaj wywołania `getFriends()` i emit `friendsList` dla obu users

**1.4 Fix ChatGateway.handleSendFriendRequest()** 📌 MODERATE
- Plik: `backend/src/chat/chat.gateway.ts`
- Linia: po ~290 (po `sendRequest()`)
- Sprawdź czy status === 'accepted' i wyemituj eventy dla mutual accept

---

### FAZA 2: Frontend Fix

**2.1 Fix ChatProvider.onFriendRequestAccepted** 📌 MODERATE
- Plik: `frontend/lib/providers/chat_provider.dart`
- Linia: 150
- Dodaj `_socketService.getFriends();`

---

### FAZA 3: Testing & Verification

**Test Scenario 1: Standard Accept Flow**
1. User A wysyła zaproszenie do User B
2. User B akceptuje przez FriendRequestsScreen
3. ✅ Verify: Oba users widzą siebie na liście znajomych (bez odświeżania)
4. ✅ Verify: Badge count zmniejsza się dla User B
5. ✅ Verify: User A dostaje powiadomienie o akceptacji

**Test Scenario 2: Mutual Request Auto-Accept**
1. User A wysyła zaproszenie do User B
2. User B wysyła zaproszenie do User A (przed akceptacją A→B)
3. ✅ Verify: Oba zaproszenia auto-akceptują się
4. ✅ Verify: Oba users widzą siebie na liście znajomych natychmiast
5. ✅ Verify: Oba users dostają event `friendRequestAccepted`

**Test Scenario 3: Database Verification**
```sql
-- Sprawdź czy friends są zapisani
SELECT fr.id, fr.status, u1.email as sender, u2.email as receiver
FROM friend_requests fr
JOIN users u1 ON fr.sender_id = u1.id
JOIN users u2 ON fr.receiver_id = u2.id
WHERE fr.status = 'accepted';

-- Sprawdź czy relacje są załadowane
SELECT * FROM friend_requests WHERE status = 'accepted' LIMIT 5;
```

**Test Scenario 4: Console Logs**
- Backend: Sprawdź czy `getFriends()` zwraca niepuste tablice User
- Frontend: Sprawdź czy `friendsList` event dociera z pełnymi danymi User
- Network tab: Sprawdź WebSocket frames dla `friendsList` events

---

## Critical Files to Modify

### Backend (2 pliki)
1. **backend/src/friends/friends.service.ts**
   - acceptRequest() - dodaj relations (linie 97, 121-123)
   - rejectRequest() - dodaj relations (linie 127, 149-151)

2. **backend/src/chat/chat.gateway.ts**
   - handleAcceptFriendRequest() - emit friendsList (po linii 372)
   - handleSendFriendRequest() - handle mutual accept (po linii ~290)

### Frontend (1 plik)
3. **frontend/lib/providers/chat_provider.dart**
   - onFriendRequestAccepted - dodaj getFriends() call (linia 150)

---

## Expected Impact

**Po naprawie Bug #1 i #2:**
- ✅ Akceptacja zaproszenia → oba users widzą siebie na liście znajomych
- ✅ Lista aktualizuje się w czasie rzeczywistym (bez F5)
- ✅ getFriends() zwraca pełne obiekty User

**Po naprawie Bug #3:**
- ✅ Wzajemne zaproszenia → auto-accept + natychmiastowa aktualizacja list
- ✅ Oba users dostają powiadomienie o akceptacji

**Po naprawie Bug #4:**
- ✅ Frontend proaktywnie odświeża listę znajomych po każdej akceptacji
- ✅ Nawet jeśli backend "zapomni" wysłać event, frontend zażąda aktualizacji

**Po naprawie Bug #5:**
- ✅ Odrzucanie zaproszeń działa spójnie z akceptacją

---

## Verification Checklist

Backend:
- [ ] acceptRequest() ładuje relations jawnie
- [ ] rejectRequest() ładuje relations jawnie
- [ ] handleAcceptFriendRequest emituje friendsList do obu users
- [ ] handleSendFriendRequest wykrywa mutual accept i emituje eventy
- [ ] getFriends() zwraca niepuste tablice User objects

Frontend:
- [ ] onFriendRequestAccepted wywołuje getFriends()
- [ ] Lista znajomych aktualizuje się po akceptacji (bez F5)
- [ ] Badge count aktualizuje się poprawnie

Testing:
- [ ] User A → User B → accept → oba widzą siebie
- [ ] User A → User B, User B → User A → auto-accept → oba widzą siebie
- [ ] Offline user → zaproszenie pojawia się przy logowaniu
- [ ] Baza danych ma correct accepted friend_requests

---

## Estimated Time
- Backend fixes: ~20 minut
- Frontend fix: ~5 minut
- Testing: ~15 minut
- **Total: ~40 minut**

---

## Notes
- Bug #1 i #2 są CRITICAL - bez nich system w ogóle nie działa
- Bug #3 jest MODERATE - dotyczy edge case'u (mutual requests)
- Bug #4 jest MODERATE - dodatkowa warstwa ochrony
- Bug #5 jest LOW - rzadko używany flow

Priorytet naprawy: #1 → #2 → #4 → #3 → #5


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\a6e203e3-c436-422a-8f32-f7d1bfffba02.jsonl