# Explore: Explore user search functionality

> Session: `f83cea94-148c-4372-9264-ae2417478270`
> Date: 2026-01-29
> Tokens: ~29,483

---

Perfect! Now let me create a comprehensive report summarizing my findings:

## User Search Functionality Analysis - Full Flow Report

I've thoroughly explored the user search functionality in this MVP chat app. Here are my findings:

### **CRITICAL FINDING: There is NO user search functionality implemented**

The user search issue is **by design** - the app doesn't have a search feature at all. Here's the complete flow analysis:

---

## Frontend - User Discovery Flow

### 1. **Search/Find User UI** (`frontend/lib/widgets/sidebar.dart`, lines 15-88)
- **Location**: Sidebar at the top of the chat screen
- **UI**: Text input field with email placeholder + "+" button
- **Code snippet**:
```dart
Row(
  children: [
    Expanded(
      child: SizedBox(
        height: 30,
        child: TextField(
          controller: _emailController,
          style: RpgTheme.pressStart2P(fontSize: 7, color: Colors.white),
          decoration: RpgTheme.rpgInputDecoration(hintText: 'email...').copyWith(
            contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
          ),
          onSubmitted: (_) => _startChat(),
        ),
      ),
    ),
    // ... button
  ],
)
```

### 2. **Frontend Action** (`sidebar.dart`, lines 24-29)
When the user enters an email and presses Enter or clicks "+":
```dart
void _startChat() {
  final email = _emailController.text.trim();
  if (email.isEmpty) return;
  context.read<ChatProvider>().startConversation(email);
  _emailController.clear();
}
```
- **What happens**: Calls `ChatProvider.startConversation(email)` with the raw email string

### 3. **Socket Event** (`frontend/lib/services/socket_service.dart`, lines 53-57)
```dart
void startConversation(String recipientEmail) {
  _socket?.emit('startConversation', {
    'recipientEmail': recipientEmail,
  });
}
```
- **Event**: `startConversation` socket event
- **Payload**: `{ recipientEmail: string }` - just the email address

---

## Backend - User Lookup Logic

### 4. **WebSocket Gateway Handler** (`backend/src/chat/chat.gateway.ts`, lines 125-164)
The backend receives the `startConversation` event:
```typescript
@SubscribeMessage('startConversation')
async handleStartConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { recipientEmail: string },
) {
  const senderId: number = client.data.user?.id;
  if (!senderId) return;

  const sender = await this.usersService.findById(senderId);
  const recipient = await this.usersService.findByEmail(data.recipientEmail);

  if (!sender || !recipient) {
    client.emit('error', { message: 'User not found' });
    return;
  }
  
  // ... rest of logic
}
```

### 5. **UsersService - Email Lookup** (`backend/src/users/users.service.ts`, lines 28-30)
```typescript
async findByEmail(email: string): Promise<User | null> {
  return this.usersRepo.findOne({ where: { email } });
}
```

---

## **ROOT CAUSE: Email Search is Case-Sensitive**

The `findByEmail()` method uses **exact string matching** via TypeORM's `findOne()` with `{ where: { email } }`.

### Problem Areas:

1. **No case-insensitive query**: The database query doesn't use `.toLowerCase()` or database-level case-insensitive search
2. **Frontend doesn't normalize input**: The email input in `sidebar.dart` doesn't call `.toLowerCase()` before sending
3. **No partial search**: Only exact email matches work. Cannot search by partial email like "john" to find "john@example.com"
4. **No validation/sanitization**: The email string is sent as-is from the frontend without trimming or case normalization

### What Currently Works:
- Only **exact email matches** (case-sensitive)
- Example: `"john@example.com"` will NOT match `"John@example.com"` or `"JOHN@EXAMPLE.COM"`

### What Doesn't Work:
- Case variations (e.g., "John@Gmail.Com" vs "john@gmail.com")
- Partial searches (e.g., typing "john" to find all users with "john" in email)
- Whitespace handling (extra spaces aren't trimmed on backend)

---

## Database & Entity Level

### User Entity (`backend/src/users/user.entity.ts`)
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;  // Plain text column - no case-insensitive index
  
  @Column()
  password: string;

  @CreateDateColumn()
  createdAt: Date;
}
```
- Email column is unique but not configured for case-insensitive matching
- No database-level constraints for case-insensitive searches

---

## Summary Table

| Component | File | Issue |
|-----------|------|-------|
| **Frontend UI** | `frontend/lib/widgets/sidebar.dart` | No input validation or normalization |
| **Frontend API Call** | `frontend/lib/services/socket_service.dart` | Sends raw email without lowercase conversion |
| **Backend Handler** | `backend/src/chat/chat.gateway.ts` | Passes email directly to service without normalization |
| **Database Query** | `backend/src/users/users.service.ts` | Uses exact-match `findOne()` - case-sensitive |
| **Database Schema** | `backend/src/users/user.entity.ts` | No case-insensitive collation specified |

---

## Why Searching by Email Doesn't Work

**User A** registers with email: `John@Gmail.com`
**User B** tries to search by typing: `john@gmail.com`

The query fails because:
1. Frontend sends `"john@gmail.com"` to backend
2. Backend queries: `SELECT * FROM users WHERE email = 'john@gmail.com'`
3. Database has: `email = 'John@Gmail.com'`
4. No match (case-sensitive) → "User not found" error