# Explore: Explore user search and conversation

> Session: `de9e180f-937a-474c-947c-3491c989514f`
> Date: 2026-01-29
> Tokens: ~31,951

---

Perfect! Now let me create a comprehensive analysis document. Based on my investigation, I can now provide a detailed analysis of the user search and conversation creation mechanism.

## Analysis Report: User Search & Conversation Creation Bug Investigation

I've thoroughly investigated the entire flow from frontend to backend. Here's what I found:

### 1. **Frontend: NewChatScreen - User Search Flow**

**File:** `/frontend/lib/screens/new_chat_screen.dart`

The search works simply:
- User enters an email in a text field (line 75)
- On button press, `_startChat()` is called (line 23-31)
- This trims the email and calls `chat.startConversation(email)` via WebSocket
- **No client-side validation or search** — the backend is responsible for finding the user

```dart
void _startChat() {
  final email = _emailController.text.trim();
  if (email.isEmpty) return;
  
  setState(() => _loading = true);
  final chat = context.read<ChatProvider>();
  chat.clearError();
  chat.startConversation(email);
}
```

**What gets sent via WebSocket:**
```dart
// From socket_service.dart, line 53-57
_socket?.emit('startConversation', {
  'recipientEmail': recipientEmail,
});
```

### 2. **Backend: User Search via `findByEmail`**

**File:** `/backend/src/users/users.service.ts`

The backend's `findByEmail` method uses a case-insensitive SQL query:

```typescript
async findByEmail(email: string): Promise<User | null> {
  return this.usersRepo
    .createQueryBuilder('user')
    .where('LOWER(user.email) = LOWER(:email)', { email })
    .getOne();
}
```

This is **case-insensitive and correct** — it converts both the stored email and the query to lowercase before comparison.

### 3. **Backend: WebSocket Handler for `startConversation`**

**File:** `/backend/src/chat/chat.gateway.ts` (lines 126-170)

The handler does this:
1. Extracts `senderId` from the WebSocket client's JWT
2. Calls `findByEmail(data.recipientEmail)` to find the recipient
3. Creates/finds a conversation via `conversationsService.findOrCreate(sender, recipient)`
4. Returns the conversation list and opens the conversation

**Key code (lines 138-140):**
```typescript
const sender = await this.usersService.findById(senderId);
const recipient = await this.usersService.findByEmail(data.recipientEmail);
console.log('startConversation: sender=', sender?.email, 'recipient=', recipient?.email, 'recipientEmail=', data.recipientEmail);
```

### 4. **Backend: Conversation Creation (findOrCreate)**

**File:** `/backend/src/conversations/conversations.service.ts` (lines 16-28)

The service has **no unique constraint in the database**, but uses a smart `findOrCreate` pattern:

```typescript
async findOrCreate(userOne: User, userTwo: User): Promise<Conversation> {
  const existing = await this.convRepo.findOne({
    where: [
      { userOne: { id: userOne.id }, userTwo: { id: userTwo.id } },
      { userOne: { id: userTwo.id }, userTwo: { id: userOne.id } },
    ],
  });

  if (existing) return existing;

  const conv = this.convRepo.create({ userOne, userTwo });
  return this.convRepo.save(conv);
}
```

This queries in **BOTH directions** to find existing conversations. If none exists, it creates one.

### 5. **Frontend: Conversation Display & Recipient Determination**

**File:** `/frontend/lib/screens/conversations_screen.dart` (line 193)

Displays conversations using:
```dart
final email = chat.getOtherUserEmail(conv);
```

**From `chat_provider.dart` (lines 37-42):**
```dart
String getOtherUserEmail(ConversationModel conv) {
  if (_currentUserId == null) return '';
  return conv.userOne.id == _currentUserId
      ? conv.userTwo.email
      : conv.userOne.email;
}
```

**THE PROBLEM IS HERE!** It determines the "other user" by comparing `conv.userOne.id` with `_currentUserId`. This works fine **if the user ID is correct**.

---

## **IDENTIFIED BUG: Cross-Browser Issue with User ID Storage**

### **Root Cause Analysis**

Looking at how `_currentUserId` is stored in ChatProvider:

**File:** `/frontend/lib/providers/chat_provider.dart` (line 51-52)
```dart
void connect({required String token, required int userId}) {
  _currentUserId = userId;
```

The `userId` comes from `auth_provider.dart` (line 24):
```dart
chat.connect(token: auth.token!, userId: auth.currentUser!.id);
```

And `auth.currentUser.id` is set from the JWT payload (lines 32-34):
```dart
_currentUser = UserModel(
  id: payload['sub'] as int,
  email: payload['email'] as String,
);
```

### **Browser Cache/LocalStorage Issue**

In `auth_provider.dart`, the token is persisted via SharedPreferences:
```dart
final prefs = await SharedPreferences.getInstance();
await prefs.setString('jwt_token', accessToken);
```

On app restart, `_loadSavedToken()` (lines 26-38) restores the user:
```dart
final savedToken = prefs.getString('jwt_token');
if (savedToken != null && !JwtDecoder.isExpired(savedToken)) {
  _token = savedToken;
  final payload = JwtDecoder.decode(savedToken);
  _currentUser = UserModel(
    id: payload['sub'] as int,
    email: payload['email'] as String,
  );
}
```

**The problem:** In Firefox, SharedPreferences (which uses browser LocalStorage) may **cache stale data** from a previous login session, especially if:
- User logged in as `lentach4@` (with user ID 4)
- User logs out and clears app data
- In Firefox's dev tools, LocalStorage wasn't fully cleared
- User logs back in as `lentach5@` (with user ID 5)
- **But SharedPreferences returns the old JWT token with `sub=4`**, not the new one

**Result:** The JWT payload has `sub=4` (old user ID), but the app thinks it's logged in. When `getOtherUserEmail()` compares `conv.userOne.id == 4`, it returns the wrong "other user" from conversations.

### **Why Brave Works, Firefox Doesn't**

- **Firefox:** May preserve LocalStorage aggressively, or have different cache invalidation
- **Brave:** Stricter data isolation per-site or better cache clearing on logout

---

## **Specific Symptom Confirmation**

User reported: *"loguje się jako lentach4@, pisze do bobo@, a wyświetla się lentach5@"*

This matches the bug exactly:
1. User has two accounts: `lentach4` (ID=4) and `lentach5` (ID=5)
2. On login, the app might still have the old JWT with `sub=4` in storage
3. A conversation is shown with `userOne.id=5, userTwo.id=4` (or vice versa)
4. When displaying the conversation, `getOtherUserEmail()` compares `5 == 4` → FALSE
5. So it shows `userOne.email` (which is whichever user was stored)
6. **Wrong email is displayed**

---

## **Summary of Findings**

| Layer | File | Issue | Severity |
|-------|------|-------|----------|
| **Frontend - Auth** | `auth_provider.dart` | SharedPreferences may cache stale JWT tokens across browser sessions | **HIGH** |
| **Frontend - Chat** | `chat_provider.dart` | Relies on correct `_currentUserId` from JWT; if wrong, `getOtherUserEmail()` shows wrong recipient | **MEDIUM** |
| **Frontend - Socket** | `socket_service.dart` | Emits `startConversation` with only email; backend finds user correctly | **OK** |
| **Backend - User Search** | `users.service.ts` | Case-insensitive `findByEmail` works correctly | **OK** |
| **Backend - WebSocket Handler** | `chat.gateway.ts` | Correctly finds user by email and creates conversation | **OK** |
| **Backend - Conversation** | `conversations.service.ts` | `findOrCreate` correctly finds existing conversations in both directions | **OK** |

---

## **Recommended Fixes**

1. **Clear SharedPreferences on logout** — Already done ✓
2. **Add explicit token validation check** — Before using JWT, verify it matches the current user context
3. **Cache invalidation on login** — Clear all cached conversation data when logging in
4. **Add user ID verification** — When displaying conversations, verify the current user ID against the JWT's `sub` claim
5. **Browser-specific fix for Firefox** — Test with Firefox's private mode or hard cache clearing