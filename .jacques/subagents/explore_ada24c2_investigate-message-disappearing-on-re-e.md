# Explore: Investigate message disappearing on re-enter

> Session: `c08abb92-682c-4647-99c6-324cb19032f7`
> Date: 2026-02-07
> Tokens: ~49,691

---

## Summary

I've thoroughly investigated the disappearing messages bug. Here's my analysis:

### The Bug

When a user sends a message **without a disappearing timer**, exits the chat, and re-enters, the message disappears from the view (though it stays in the conversation list preview).

### Root Cause

The bug is in **`frontend/lib/providers/chat_provider.dart`** in the `onMessageHistory` handler (lines 275-284):

```dart
// Immediately remove any already-expired messages, but keep
// undelivered ones (SENDING/SENT) — their timer restarts on delivery
final now = DateTime.now();
_messages.removeWhere(
  (m) =>
      m.expiresAt != null &&
      m.expiresAt!.isBefore(now) &&
      m.deliveryStatus != MessageDeliveryStatus.sending &&
      m.deliveryStatus != MessageDeliveryStatus.sent,
);
```

**Problem:** This filter is **overly aggressive**. It removes messages that:
1. Have `expiresAt != null`
2. Have `expiresAt!.isBefore(now)` (expired)
3. Are NOT in SENDING or SENT state

However, **when the sender's own message gets DELIVERED status**, it becomes eligible for removal if `expiresAt` is in the past. Here's the problematic scenario:

### The Scenario

1. **User A sends message** → Backend creates message with `deliveryStatus = SENT`, `expiresAt = null` (no timer), `expiresInSeconds = null`
2. **Backend sends `messageSent`** → Frontend receives it, creates a confirmed message with `deliveryStatus = SENT`
3. **User A exits chat** → `clearActiveConversation()` called
4. **User A re-enters chat** → `openConversation()` called → `getMessages` sent to backend
5. **Backend returns `messageHistory`** → The old message with `deliveryStatus = SENT`, `expiresAt = null`
6. **Frontend applies `onMessageHistory`** → **THE BUG:**
   - The message is correctly parsed from the backend response
   - But then the `removeWhere` filter evaluates it
   - **IF** the message's `expiresAt` was somehow set to a past date (even though it should be `null`), it gets removed

### The Real Issue: Backend-Side Filter

However, looking at **`backend/src/chat/services/chat-message.service.ts`** (lines 177-189), there's a **similar filter** that applies to messages when they're retrieved:

```typescript
const active = messages.filter((m) => {
  if (!m.expiresAt) return true;
  const expiresMs = new Date(m.expiresAt as any).getTime();
  if (expiresMs > nowMs) return true;
  // Keep undelivered messages (timer restarts on delivery)
  if (
    m.deliveryStatus === MessageDeliveryStatus.SENT ||
    m.deliveryStatus === MessageDeliveryStatus.SENDING
  ) {
    return true;
  }
  return false;
});
```

**The inconsistency:** The frontend filter (lines 278-284) removes expired messages **except** SENDING/SENT. But the backend filter keeps SENT/SENDING messages even if expired.

### Critical Edge Case

The **actual bug** appears when:
1. User sends a message WITHOUT a timer (`expiresAt = null`, `expiresInSeconds = null`)
2. Somehow the message's `expiresAt` becomes a past date (this could happen if:
   - There's a timezone issue
   - The message was created with an erroneous timestamp
   - There's a race condition in timestamp normalization)
3. The message transitions from SENT → DELIVERED
4. When user re-enters the chat, the frontend's `onMessageHistory` filter **removes the message** because:
   - `expiresAt != null` ✓ (bug: should be null)
   - `expiresAt.isBefore(now)` ✓
   - `deliveryStatus != SENDING && != SENT` ✓ (it's now DELIVERED)

### Files Involved

| File | Issue |
|------|-------|
| `backend/src/chat/services/chat-message.service.ts` (lines 177-189) | Filter keeps SENT/SENDING even if expired, but removes DELIVERED/READ if expired |
| `frontend/lib/providers/chat_provider.dart` (lines 275-284) | Filter assumes messages with `expiresAt != null` should be removed if delivered and expired |
| `backend/src/messages/messages.service.ts` (lines 91-98) | `updateDeliveryStatus` recalculates `expiresAt` when transitioning to DELIVERED if `expiresInSeconds != null` |

### The Fix Needed

The filtering logic must handle this scenario:
- Messages sent **without** a disappearing timer (`expiresInSeconds = null`) should **never** have their `expiresAt` auto-calculated
- The filters should only remove messages if **both** `expiresAt` AND `expiresInSeconds` indicate expiration
- Alternatively, messages created without `expiresInSeconds` should always be kept regardless of `expiresAt` value

The inconsistency between frontend and backend filters needs to be reconciled to ensure messages are consistently preserved or removed on both sides.