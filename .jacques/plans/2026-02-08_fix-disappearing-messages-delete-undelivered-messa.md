# Fix: Disappearing Messages Delete Undelivered Messages

## Context

**Problem:** When user A sends a message to offline user B with a disappearing messages timer active, the message expires and is deleted by the cron job BEFORE user B comes back online. Result: 236 out of 584 messages have been deleted from the database.

**Root cause:** The `expiresAt` timestamp is calculated from SEND time (`now + timer_seconds`). The cron job deletes all messages where `expiresAt < now`, regardless of delivery status. So messages to offline users expire and get deleted before the recipient ever sees them.

**Expected behavior (Telegram/Signal-like):** Timer should restart when the recipient actually receives/reads the message.

## Plan

### Step 1: Add `expiresInSeconds` column to Message entity
**File:** `backend/src/messages/message.entity.ts`

- Add `expiresInSeconds` column: `@Column({ type: 'int', nullable: true })`
- This stores the original timer duration so we can recalculate `expiresAt` on delivery

### Step 2: Update message creation to store `expiresInSeconds`
**File:** `backend/src/messages/messages.service.ts`

- Add `expiresInSeconds` to `create()` options parameter
- Store it when creating the message: `expiresInSeconds: options?.expiresInSeconds || null`

### Step 3: Store `expiresInSeconds` when sending messages
**File:** `backend/src/chat/services/chat-message.service.ts` — `handleSendMessage`

- Pass `expiresIn` (from DTO) as `expiresInSeconds` to `messagesService.create()`
- Also include `expiresInSeconds` in `messagePayload` sent to clients

### Step 4: Protect undelivered messages in cron job
**File:** `backend/src/messages/message-cleanup.service.ts`

- Change deletion query to: only delete expired messages where `deliveryStatus` is `DELIVERED` or `READ`
- Use TypeORM `In([MessageDeliveryStatus.DELIVERED, MessageDeliveryStatus.READ])` condition
- This ensures messages to offline users are never deleted before being seen

### Step 5: Recalculate `expiresAt` on delivery
**File:** `backend/src/messages/messages.service.ts` — `updateDeliveryStatus()`

- When status transitions to `DELIVERED` and `expiresInSeconds` is set:
  - Recalculate `expiresAt = new Date(Date.now() + message.expiresInSeconds * 1000)`
  - Save to DB
- This restarts the timer from the moment the recipient receives the message

### Step 6: Recalculate expired-but-undelivered messages in `handleGetMessages`
**File:** `backend/src/chat/services/chat-message.service.ts` — `handleGetMessages`

- After fetching messages from DB, for messages where `deliveryStatus = SENT` and `expiresInSeconds != null` and `expiresAt < now`:
  - Recalculate `expiresAt = now + expiresInSeconds * 1000`
  - Batch-save updated messages to DB
- This ensures that when B opens the chat, expired-but-undelivered messages get a fresh timer
- Keep existing filter: still exclude truly expired messages (DELIVERED/READ + expiresAt < now)

### Step 7: Update frontend expiry filters
**File:** `frontend/lib/models/message_model.dart`

- Add `expiresInSeconds` field (nullable int)
- Parse from JSON

**File:** `frontend/lib/providers/chat_provider.dart`

- `onMessageHistory` filter: don't remove messages where deliveryStatus is SENDING or SENT (they haven't been delivered yet, timer hasn't truly started)
- `removeExpiredMessages()`: same — skip messages with SENDING/SENT status

### Step 8: Include `expiresInSeconds` in handleSendPing (consistency)
**File:** `backend/src/chat/services/chat-message.service.ts` — `handleSendPing`

- Pings don't expire (`expiresAt: null`), so `expiresInSeconds` stays null. No change needed.

## Files Modified

| File | Change |
|------|--------|
| `backend/src/messages/message.entity.ts` | Add `expiresInSeconds` column |
| `backend/src/messages/messages.service.ts` | Store `expiresInSeconds`, recalculate on delivery |
| `backend/src/messages/message-cleanup.service.ts` | Only delete DELIVERED/READ expired messages |
| `backend/src/chat/services/chat-message.service.ts` | Pass `expiresInSeconds`, recalculate in getMessages |
| `frontend/lib/models/message_model.dart` | Add `expiresInSeconds` field |
| `frontend/lib/providers/chat_provider.dart` | Protect undelivered messages from expiry filters |

## Verification

1. Start app: `docker-compose -f docker-compose.dev.yml up`
2. Login as User A and User B in two browser tabs
3. Set disappearing messages timer (30s) in conversation A→B
4. Close User B's tab (simulate offline)
5. User A sends a message to User B
6. Wait 60+ seconds (past expiry + cron cycle)
7. Check DB: `SELECT * FROM messages ORDER BY id DESC LIMIT 5;` — message should still exist with `deliveryStatus = SENT`
8. Open User B's tab, login, open conversation
9. Message should appear with a FRESH 30s countdown timer
10. Wait 30s — message should disappear (now properly expired after delivery)
