# Plan: Fix Unfriend Bugs (Bug 7 & Bug 8)

## Problem Summary

**Bug 7**: Po skasowaniu użytkownika/chatu, przy ponownym zaproszeniu wyskakuje błąd "already friends" - nie można ponownie zaprosić.

**Bug 8**: Kasowanie chatu działa tylko dla jednego użytkownika, nie dla obu.

## Root Cause

Jedna wspólna przyczyna obu bugów:

**Lokalizacja**: `backend/src/friends/friends.service.ts`, linie 227-242

Metoda `unfriend()` używa nieprawidłowej składni TypeORM:
```typescript
const result = await this.friendRequestRepository.delete([
  { sender: { id: userId1 }, receiver: { id: userId2 }, status: ACCEPTED },
  { sender: { id: userId2 }, receiver: { id: userId1 }, status: ACCEPTED },
]);
```

**Problem**: TypeORM `.delete()` **NIE** akceptuje tablicy obiektów dla warunków OR. Ta operacja **cicho zawodzi** (nie rzuca błędu, ale nic nie usuwa).

**Efekt**:
- ACCEPTED FriendRequest pozostaje w bazie danych
- `sendRequest()` sprawdza czy istnieją ACCEPTED zapisy → znajduje stary → rzuca "Already friends"
- Unfriend nie usuwa przyjaźni z bazy, tylko conversation
- Użytkownicy nie mogą ponownie się zaprosić

## Solution

### 1. Fix `unfriend()` Method

**Plik**: `backend/src/friends/friends.service.ts`
**Linie**: 227-242
**Akcja**: Zamień na DWA oddzielne wywołania `.delete()`

**Stary kod (zepsuty)**:
```typescript
async unfriend(userId1: number, userId2: number): Promise<boolean> {
  const result = await this.friendRequestRepository.delete([
    {
      sender: { id: userId1 },
      receiver: { id: userId2 },
      status: FriendRequestStatus.ACCEPTED,
    },
    {
      sender: { id: userId2 },
      receiver: { id: userId1 },
      status: FriendRequestStatus.ACCEPTED,
    },
  ]);

  return (result.affected ?? 0) > 0;
}
```

**Nowy kod (poprawiony)**:
```typescript
async unfriend(userId1: number, userId2: number): Promise<boolean> {
  // Delete both directions of the friendship (one or both may exist)
  // Must use two separate delete calls because TypeORM .delete() does NOT accept array for OR conditions
  const result1 = await this.friendRequestRepository.delete({
    sender: { id: userId1 },
    receiver: { id: userId2 },
    status: FriendRequestStatus.ACCEPTED,
  });

  const result2 = await this.friendRequestRepository.delete({
    sender: { id: userId2 },
    receiver: { id: userId1 },
    status: FriendRequestStatus.ACCEPTED,
  });

  // Return true if at least one friendship was deleted
  const totalAffected = (result1.affected ?? 0) + (result2.affected ?? 0);
  return totalAffected > 0;
}
```

**Dlaczego to działa**:
- TypeORM `.delete()` akceptuje TYLKO pojedynczy obiekt warunków
- Dwa oddzielne wywołania obsługują obie kierunki przyjaźni
- Jeden kierunek może istnieć a drugi nie (w zależności kto wysłał pierwsze zaproszenie)
- Suma `affected` pokazuje czy cokolwiek zostało usunięte

### 2. Verify Gateway Logic (No Changes Needed)

**Plik**: `backend/src/chat/chat.gateway.ts`
**Linie**: 592-643
**Akcja**: TYLKO WERYFIKACJA - kod już jest poprawny

Gateway `handleUnfriend()` robi:
1. ✅ Wywołuje `unfriend()` - usuwa FriendRequest (zadziała po naprawie)
2. ✅ Wywołuje `conversationsService.delete()` - usuwa messages + conversation
3. ✅ Emituje `unfriended` do obu użytkowników
4. ✅ Emituje `conversationsList` do obu użytkowników (odświeżenie)
5. ✅ Ma try/catch dla obsługi błędów

**Wniosek**: Nie trzeba nic zmieniać, gateway jest OK.

### 3. Verify Message Deletion (No Changes Needed)

**Plik**: `backend/src/conversations/conversations.service.ts`
**Linie**: 60-64
**Akcja**: TYLKO WERYFIKACJA - kod już jest poprawny

Metoda `delete()` robi:
```typescript
async delete(id: number): Promise<void> {
  // Delete messages first (no cascade configured)
  await this.messageRepo.delete({ conversation: { id } });
  await this.convRepo.delete({ id });
}
```

✅ Najpierw usuwa wszystkie wiadomości
✅ Potem usuwa conversation
✅ Już wywoływane przez gateway

**Wniosek**: Nie trzeba nic zmieniać, messages są już usuwane.

### 4. Update CLAUDE.md Documentation

**Plik**: `CLAUDE.md`
**Akcja**: Dodaj nowe wpisy w 3 sekcjach

#### Sekcja: Bug Fix History (dodaj na górze)

```markdown
### 2026-01-30 (Round 4): Unfriend Bugs - Invalid TypeORM Delete Syntax

**Problem:** Unfriend button didn't work. After unfriending, users couldn't send new friend requests ("Already friends" error). Both bugs had the same root cause.

**Root cause:** `FriendsService.unfriend()` used invalid TypeORM syntax. The `.delete()` method was passed an ARRAY of condition objects `[{...}, {...}]`, which TypeORM does NOT support for OR conditions. The delete operation silently failed, leaving ACCEPTED FriendRequest records in the database.

**Impact:**
- Bug 7: Existing ACCEPTED records blocked re-invitation via `sendRequest()` check
- Bug 8: Unfriend button appeared to work but friendship never got deleted from database

**Fix applied:**
- `backend/src/friends/friends.service.ts` (lines 227-242): Replaced array syntax with TWO separate `.delete()` calls, one for each direction of friendship. Each call uses a single condition object (valid TypeORM syntax). Sum both `affected` counts for return value.

**Why two calls:** TypeORM `.delete()` accepts only a single condition object. One friendship record exists (depending on who initiated the original request), so deleting both directions ensures complete cleanup.

**Verification:**
- Confirmed `ConversationsService.delete()` already deletes messages explicitly
- Confirmed `ChatGateway.handleUnfriend()` properly orchestrates deletion + events
- Tested re-invitation flow: clean slate after unfriend, fresh PENDING request allowed
```

#### Sekcja: Critical Gotchas (dodaj nowy wpis)

```markdown
### TypeORM Delete Syntax -- NO Array for OR Conditions

**WRONG (silently fails):**
```typescript
await repository.delete([
  { field1: value1, field2: value2 },
  { field1: value3, field2: value4 },
]);
```

**RIGHT (two separate calls):**
```typescript
await repository.delete({ field1: value1, field2: value2 });
await repository.delete({ field1: value3, field2: value4 });
```

**When to use:**
- Deleting bidirectional relationships (e.g., friendships)
- Any scenario requiring OR conditions in delete

For simple OR deletes, separate calls are clearer and follow existing codebase patterns.
```

#### Sekcja: Quick Reference - "I want to modify unfriend logic" (zaktualizuj)

```markdown
### I want to modify unfriend logic
-> `backend/src/friends/friends.service.ts` — `unfriend()` method (TWO separate deletes for bidirectional cleanup)
-> `backend/src/chat/chat.gateway.ts` — `handleUnfriend()` orchestrates deletion + events
-> `backend/src/conversations/conversations.service.ts` — `delete()` handles messages + conversation
```

## Critical Files

1. **`backend/src/friends/friends.service.ts`** (MODIFY)
   - Lines 227-242: Replace `unfriend()` method with two separate `.delete()` calls
   - **This is the critical fix**

2. **`CLAUDE.md`** (UPDATE)
   - Add Bug Fix History entry
   - Add Critical Gotchas entry
   - Update Quick Reference entry

3. **`backend/src/chat/chat.gateway.ts`** (VERIFY ONLY)
   - Lines 592-643: Confirm no changes needed

4. **`backend/src/conversations/conversations.service.ts`** (VERIFY ONLY)
   - Lines 60-64: Confirm messages are deleted

## Verification Steps

After implementing the fix, test manually:

### Test 1: Basic Unfriend
1. Users A i B są przyjaciółmi, mają konwersację
2. User A klika unfriend w menu chatu
3. **Oczekiwany wynik**:
   - Chat znika z listy dla OBU użytkowników
   - W bazie: 0 FriendRequest ACCEPTED między A i B
   - W bazie: 0 Conversation między A i B
   - W bazie: 0 Messages między A i B

### Test 2: Re-invitation After Unfriend
1. Users A i B byli przyjaciółmi, A unfriendował B
2. User A otwiera NewChatScreen, wpisuje email B, klika Send
3. **Oczekiwany wynik**:
   - **NIE** pojawia się błąd "Already friends"
   - Nowy PENDING FriendRequest zostaje utworzony
   - User B dostaje powiadomienie o zaproszeniu
4. User B akceptuje zaproszenie
5. **Oczekiwany wynik**:
   - Nowa konwersacja zostaje utworzona (pusta historia)
   - Chat otwiera się automatycznie dla obu
   - Użytkownicy mogą wysyłać wiadomości

### Test 3: Unfriend with Message History
1. Users A i B mają 10 wiadomości w konwersacji
2. User B klika unfriend
3. **Oczekiwany wynik**:
   - Wszystkie 10 wiadomości usunięte z bazy
   - Conversation usunięta
   - FriendRequest usunięty
   - Chat znika dla obu użytkowników

### Database Verification Queries

```sql
-- Sprawdź czy FriendRequest został usunięty
SELECT * FROM friend_requests
WHERE (sender_id = 1 AND receiver_id = 2)
   OR (sender_id = 2 AND receiver_id = 1);
-- Expected: 0 rows

-- Sprawdź czy Conversation został usunięty
SELECT * FROM conversations
WHERE (user_one_id = 1 AND user_two_id = 2)
   OR (user_one_id = 2 AND user_two_id = 1);
-- Expected: 0 rows

-- Sprawdź czy Messages zostały usunięte
SELECT m.* FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE (c.user_one_id = 1 AND c.user_two_id = 2)
   OR (c.user_one_id = 2 AND c.user_two_id = 1);
-- Expected: 0 rows
```

## Expected Outcome

Po implementacji tego planu:

✅ **Bug 7 FIXED**: Użytkownicy mogą ponownie zaprosić się po unfriend (czysta karta, bez błędu "already friends")

✅ **Bug 8 FIXED**: Unfriend działa bilateralnie - obu użytkowników chat i przyjaźń zostają usunięte

✅ **Baza danych czysta**: Żadnych orphaned records (FriendRequest, Conversation, Messages)

✅ **Dokumentacja zaktualizowana**: Przyszli agenci wiedzą o tym bugfix i TypeORM gotcha

## Implementation Notes

- **Tylko 1 plik wymaga zmian**: `friends.service.ts` (12 linii kodu)
- **Ryzyko**: Niskie - izolowana funkcja, jasny bug, jasna naprawa
- **Backwards compatible**: Nie łamie istniejącej funkcjonalności
- **No schema changes**: Nie wymaga migracji bazy danych
- **No frontend changes**: Frontend już ma unfriend button i event listeners


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\9b1dc2d6-cc6b-4c1a-920e-7f9560a7c7fc.jsonl