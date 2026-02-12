# Explore: Investigate unfriend implementation

> Session: `9b1dc2d6-cc6b-4c1a-920e-7f9560a7c7fc`
> Date: 2026-01-30
> Tokens: ~31,060

---

Perfect! I now have all the information needed. Let me compile my findings.

## Investigation Results: Unfriend Implementation Root Causes

### Bug Analysis

I found the root causes of both bugs:

---

### **Bug 7: After unfriending, re-inviting shows "already friends" error**

**Root Cause: sendRequest() does NOT check for rejected requests**

Location: `backend/src/friends/friends.service.ts`, lines 20-37

The `sendRequest()` method checks for existing ACCEPTED requests:

```typescript
const existingAccepted = await this.friendRequestRepository.findOne({
  where: [
    {
      sender: { id: sender.id },
      receiver: { id: receiver.id },
      status: FriendRequestStatus.ACCEPTED,
    },
    {
      sender: { id: receiver.id },
      receiver: { id: sender.id },
      status: FriendRequestStatus.ACCEPTED,
    },
  ],
});

if (existingAccepted) {
  throw new ConflictException('Already friends');
}
```

**The Problem:**

1. When unfriending, `unfriend()` (line 227-242) performs a DELETE query:
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
   ```

2. This DELETE removes the accepted FriendRequest records from the database.

3. However, there's **NO enforcement that prevents re-deletion or the existence of orphaned records**. The TypeORM `.delete()` method succeeds even if no rows match.

4. When a user tries to send a new friend request, the check at lines 20-37 only looks for ACCEPTED status records. Since those were deleted, no conflict is detected.

**BUT** - wait, this should actually work correctly then...

**Re-analyzing:** Let me check the logic more carefully. The issue is that `unfriend()` uses TypeORM's `.delete()` with a where clause. Looking at line 228:

```typescript
const result = await this.friendRequestRepository.delete([
  { sender: { id: userId1 }, receiver: { id: userId2 }, status: FriendRequestStatus.ACCEPTED },
  { sender: { id: userId2 }, receiver: { id: userId1 }, status: FriendRequestStatus.ACCEPTED },
]);
```

**CRITICAL BUG FOUND**: TypeORM `.delete()` with an **array argument** does NOT work as an OR query. It treats each element as separate delete operations. However, the method signature shows it takes an `ObjectLiteral | string | number` - **NOT an array**. 

This means the `.delete([...])` call is **silently failing** - it's not actually deleting anything! The array is being passed to a method that doesn't accept arrays in that way.

---

### **Bug 8: Unfriend only works for one user, not both**

**Root Cause: unfriend() deletes only from initiator's side, and the delete may not work at all**

Location: `backend/src/chat/chat.gateway.ts`, lines 592-643

The `handleUnfriend()` handler calls:

```typescript
await this.friendsService.unfriend(currentUserId, data.userId);
```

Where `data.userId` is the user being unfriended.

**The Problem:**

1. The `unfriend()` method at `backend/src/friends/friends.service.ts:227-242` tries to delete with an array parameter.

2. **TypeORM `.delete()` does not support array syntax for multiple where conditions**. The correct syntax should be:
   - Option A: Two separate `.delete()` calls
   - Option B: Use `.delete().where()` with OR conditions
   - Option C: Use the `Or()` operator from TypeORM

3. Because the `.delete()` call is malformed, **NO deletion happens at all**.

4. The gateway successfully calls `conversationsService.delete()` (line 607), which does work, but the FriendRequest records are never actually deleted from the database.

5. Since only the conversation is deleted and FriendRequest ACCEPTED records remain, the friendship technically still exists in the database.

6. The "only works for one user" aspect: Both users are trying to unfriend, but since the delete query is broken, neither user's unfriend actually removes the FriendRequest record. Each user can only delete their own conversation (line 607), but that's handled per-user in the gateway.

---

### **Summary of Root Causes:**

| Bug | File | Line | Root Cause | Impact |
|-----|------|------|-----------|--------|
| Bug 7 (re-invite shows "already friends") | `friends.service.ts` | 228-239 | `.delete([...])` uses invalid array syntax - delete never executes, ACCEPTED record remains in DB | User cannot re-invite after unfriending |
| Bug 8 (unfriend only works for one user) | `friends.service.ts` | 228-239 | Same invalid delete syntax - FriendRequest record never deleted from either perspective | Bilateral friendship still exists in DB even though conversations deleted |

---

### **Related Code Locations:**

1. **FriendRequest Entity** (`backend/src/friends/friend-request.entity.ts`): 
   - Has CASCADE DELETE on both sender and receiver ForeignKeys (lines 24, 28), but this only triggers if a User is deleted, not when unfriending

2. **Conversation Entity** (`backend/src/conversations/conversation.entity.ts`):
   - No CASCADE DELETE on userOne/userTwo (correct - manual deletion via gateway)
   - Messages are NOT cascade deleted when conversation is deleted

3. **Message Entity** (`backend/src/messages/message.entity.ts`):
   - No CASCADE DELETE on conversation FK - orphaned messages stay in DB after conversation deletion

4. **Gateway unfriend handler** (`chat.gateway.ts:592-643`):
   - Calls broken `friendsService.unfriend()`
   - Calls `conversationsService.delete()` (which works)
   - Emits refresh events correctly, but based on stale data since unfriend failed

---

### **File Paths:**

- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friends.service.ts` (lines 227-242)
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts` (lines 592-643)
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\friends\friend-request.entity.ts` (cascade delete config)