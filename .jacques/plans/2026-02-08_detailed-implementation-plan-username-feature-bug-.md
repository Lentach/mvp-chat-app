Now I have a complete picture of the codebase. Let me create a comprehensive implementation plan addressing all requirements.

# Detailed Implementation Plan: Username Feature + Bug Fixes + Settings + Delete Conversations

## Overview

This implementation plan covers:
1. Adding username field to the system
2. Fixing conversation loading bug
3. Fixing Firefox user search cache bug  
4. Adding Settings screen
5. Adding conversation deletion feature

## 1. DATABASE MIGRATION STRATEGY

### 1.1 Database Changes Required

**TypeORM Auto-Sync Approach** (Current setup uses `synchronize: true`)
- The app currently uses TypeORM auto-sync in development mode
- When `username` column is added to User entity, TypeORM will auto-create it on app restart
- **Risk**: Existing users in database will have NULL username values

**Migration Strategy Options:**

**Option A: Nullable Username Initially (RECOMMENDED)**
1. Add username column as nullable first
2. Create a backend endpoint to update username for existing users
3. Once all users have usernames, make it required
4. **Pros**: No data loss, gradual migration
5. **Cons**: Requires two-phase rollout

**Option B: Required Username with Default Values**
1. Add username column as required with default value (e.g., email prefix)
2. Auto-generate usernames for existing users (email before @)
3. Allow users to change username later
4. **Pros**: Immediate consistency
5. **Cons**: Auto-generated usernames might conflict

**CHOSEN APPROACH: Option A - Nullable Username Initially**

### 1.2 Migration Steps

1. **Phase 1**: Add username as nullable
   - Add column to User entity: `username?: string` with `@Column({ unique: true, nullable: true })`
   - Update RegisterDto to require username for new registrations
   - Update JWT payload to include username (when present)
   - Frontend: Add username field to registration form

2. **Phase 2**: Handle existing users
   - On login, check if user.username is null
   - If null, prompt user to set username (can be done via Settings screen)
   - Alternatively: Auto-generate from email and ask user to customize

3. **Phase 3**: Make username required (future)
   - Once all users have usernames, change column to `@Column({ unique: true })`
   - Remove nullable option

**For MVP, we'll implement Phase 1 + Phase 2 (prompt on login if missing)**

### 1.3 Data Validation

- Username uniqueness: Database constraint + backend validation
- Username format: Alphanumeric + underscore, 3-20 characters
- Case-insensitive uniqueness check (like email)
- Reserved usernames: Block system names (admin, root, etc.)

---

## 2. BACKEND CHANGES

### 2.1 User Entity (`backend/src/users/user.entity.ts`)

**Changes:**
```typescript
@Column({ unique: true, nullable: true })
username: string | null;
```

**Reasoning**: Nullable to support existing users, unique constraint for username lookup

### 2.2 Register DTO (`backend/src/auth/dto/register.dto.ts`)

**Changes:**
```typescript
import { IsEmail, MinLength, IsString, Matches, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers and underscores'
  })
  username?: string;
}
```

**Reasoning**: 
- `@IsOptional()` allows existing login flow to work during migration
- For new registrations, frontend will provide username
- Validation ensures clean usernames

### 2.3 Users Service (`backend/src/users/users.service.ts`)

**Changes:**

1. Update `create()` method signature:
```typescript
async create(email: string, password: string, username?: string): Promise<User>
```

2. Add username uniqueness check:
```typescript
if (username) {
  const existingUsername = await this.usersRepo
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:username)', { username })
    .getOne();
  if (existingUsername) {
    throw new ConflictException('Username already taken');
  }
}
```

3. Update user creation:
```typescript
const user = this.usersRepo.create({ email, password: hash, username });
```

4. Add `findByUsername()` method:
```typescript
async findByUsername(username: string): Promise<User | null> {
  return this.usersRepo
    .createQueryBuilder('user')
    .where('LOWER(user.username) = LOWER(:username)', { username })
    .getOne();
}
```

### 2.4 Auth Service (`backend/src/auth/auth.service.ts`)

**Changes:**

1. Update `register()` method:
```typescript
async register(email: string, password: string, username?: string) {
  const user = await this.usersService.create(email, password, username);
  return { id: user.id, email: user.email, username: user.username };
}
```

2. Update `login()` JWT payload:
```typescript
const payload = { 
  sub: user.id, 
  email: user.email,
  username: user.username 
};
```

**Reasoning**: Include username in JWT so frontend can display it without extra API calls

### 2.5 Auth Controller (`backend/src/auth/auth.controller.ts`)

**Need to check if this file exists and update register endpoint:**

```typescript
@Post('register')
register(@Body() dto: RegisterDto) {
  return this.authService.register(dto.email, dto.password, dto.username);
}
```

### 2.6 Chat Gateway (`backend/src/chat/chat.gateway.ts`)

**Changes in multiple places:**

1. Update `handleConnection()` to store username:
```typescript
client.data.user = { 
  id: user.id, 
  email: user.email,
  username: user.username 
};
```

2. Update `handleMessage()` response payload:
```typescript
const messagePayload = {
  id: message.id,
  content: message.content,
  senderId: sender.id,
  senderEmail: sender.email,
  senderUsername: sender.username,
  conversationId: conversation.id,
  createdAt: message.createdAt,
};
```

3. Update `handleStartConversation()` response:
```typescript
const mapped = conversations.map((c) => ({
  id: c.id,
  userOne: { 
    id: c.userOne.id, 
    email: c.userOne.email,
    username: c.userOne.username 
  },
  userTwo: { 
    id: c.userTwo.id, 
    email: c.userTwo.email,
    username: c.userTwo.username 
  },
  createdAt: c.createdAt,
}));
```

4. Update `handleGetMessages()` response:
```typescript
const mapped = messages.map((m) => ({
  id: m.id,
  content: m.content,
  senderId: m.sender.id,
  senderEmail: m.sender.email,
  senderUsername: m.sender.username,
  conversationId: data.conversationId,
  createdAt: m.createdAt,
}));
```

5. Update `handleGetConversations()` response (same as handleStartConversation)

6. **NEW**: Add `deleteConversation` handler:
```typescript
@SubscribeMessage('deleteConversation')
async handleDeleteConversation(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { conversationId: number },
) {
  const userId: number = client.data.user?.id;
  if (!userId) return;

  const conversation = await this.conversationsService.findById(data.conversationId);
  
  if (!conversation) {
    client.emit('error', { message: 'Conversation not found' });
    return;
  }

  // Authorization: only participants can delete
  if (conversation.userOne.id !== userId && conversation.userTwo.id !== userId) {
    client.emit('error', { message: 'Unauthorized' });
    return;
  }

  await this.conversationsService.delete(data.conversationId);
  
  // Refresh conversation list
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

### 2.7 Conversations Service (`backend/src/conversations/conversations.service.ts`)

**Changes:**

Add `delete()` method:
```typescript
async delete(id: number): Promise<void> {
  await this.convRepo.delete({ id });
}
```

**Note**: This will cascade delete messages if cascade is configured. If not, need to delete messages first via MessagesService.

### 2.8 Messages Service (if cascade delete not configured)

Check `backend/src/messages/message.entity.ts` for cascade configuration. If messages aren't auto-deleted when conversation is deleted, add to MessagesService:

```typescript
async deleteByConversation(conversationId: number): Promise<void> {
  await this.messagesRepo.delete({ conversation: { id: conversationId } });
}
```

And call from ConversationsService before deleting conversation.

---

## 3. FRONTEND CHANGES

### 3.1 User Model (`frontend/lib/models/user_model.dart`)

**Changes:**
```dart
class UserModel {
  final int id;
  final String email;
  final String? username;

  UserModel({
    required this.id, 
    required this.email,
    this.username,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      email: json['email'] as String,
      username: json['username'] as String?,
    );
  }
}
```

### 3.2 Message Model (`frontend/lib/models/message_model.dart`)

**Changes:**
```dart
class MessageModel {
  final int id;
  final String content;
  final int senderId;
  final String senderEmail;
  final String? senderUsername;
  final int conversationId;
  final DateTime createdAt;

  MessageModel({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderEmail,
    this.senderUsername,
    required this.conversationId,
    required this.createdAt,
  });

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    return MessageModel(
      id: json['id'] as int,
      content: json['content'] as String,
      senderId: json['senderId'] as int,
      senderEmail: json['senderEmail'] as String,
      senderUsername: json['senderUsername'] as String?,
      conversationId: json['conversationId'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
```

### 3.3 API Service (`frontend/lib/services/api_service.dart`)

**Changes:**

Update `register()` to accept username:
```dart
Future<Map<String, dynamic>> register(
  String email, 
  String password,
  String? username,
) async {
  final body = {
    'email': email,
    'password': password,
  };
  if (username != null && username.isNotEmpty) {
    body['username'] = username;
  }

  final response = await http.post(
    Uri.parse('$baseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode(body),
  );

  final data = jsonDecode(response.body) as Map<String, dynamic>;
  if (response.statusCode != 201) {
    throw Exception(data['message'] ?? 'Registration failed');
  }
  return data;
}
```

### 3.4 Socket Service (`frontend/lib/services/socket_service.dart`)

**Changes:**

Add `deleteConversation()` method:
```dart
void deleteConversation(int conversationId) {
  _socket?.emit('deleteConversation', {
    'conversationId': conversationId,
  });
}
```

### 3.5 Auth Provider (`frontend/lib/providers/auth_provider.dart`)

**Changes:**

1. Update `_loadSavedToken()` to extract username:
```dart
Future<void> _loadSavedToken() async {
  final prefs = await SharedPreferences.getInstance();
  final savedToken = prefs.getString('jwt_token');
  if (savedToken != null && !JwtDecoder.isExpired(savedToken)) {
    _token = savedToken;
    final payload = JwtDecoder.decode(savedToken);
    _currentUser = UserModel(
      id: payload['sub'] as int,
      email: payload['email'] as String,
      username: payload['username'] as String?,
    );
    notifyListeners();
  }
}
```

2. Update `register()` to accept username:
```dart
Future<bool> register(String email, String password, String? username) async {
  try {
    await _api.register(email, password, username);
    _statusMessage = 'Hero created! Now login.';
    _isError = false;
    notifyListeners();
    return true;
  } catch (e) {
    _statusMessage = e.toString().replaceFirst('Exception: ', '');
    _isError = true;
    notifyListeners();
    return false;
  }
}
```

3. Update `login()` to extract username from JWT:
```dart
Future<bool> login(String email, String password) async {
  try {
    final accessToken = await _api.login(email, password);
    _token = accessToken;

    final payload = JwtDecoder.decode(accessToken);
    _currentUser = UserModel(
      id: payload['sub'] as int,
      email: payload['email'] as String,
      username: payload['username'] as String?,
    );

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('jwt_token', accessToken);

    _statusMessage = null;
    _isError = false;
    notifyListeners();
    return true;
  } catch (e) {
    _statusMessage = e.toString().replaceFirst('Exception: ', '');
    _isError = true;
    notifyListeners();
    return false;
  }
}
```

4. **BUG FIX**: Update `logout()` to clear ALL cached data:
```dart
Future<void> logout() async {
  _token = null;
  _currentUser = null;
  _statusMessage = null;
  _isError = false;

  final prefs = await SharedPreferences.getInstance();
  await prefs.clear(); // Clear ALL preferences, not just jwt_token

  notifyListeners();
}
```

**Reasoning**: Firefox cache bug - clearing all preferences ensures no stale data remains

### 3.6 Chat Provider (`frontend/lib/providers/chat_provider.dart`)

**Changes:**

1. Add helper method to get username:
```dart
String getOtherUserUsername(ConversationModel conv) {
  if (_currentUserId == null) return '';
  final otherUser = conv.userOne.id == _currentUserId 
      ? conv.userTwo 
      : conv.userOne;
  return otherUser.username ?? otherUser.email;
}
```

2. **BUG FIX**: Remove redundant `getConversations()` calls in `onMessageSent` and `onNewMessage`:
```dart
onMessageSent: (data) {
  final msg = MessageModel.fromJson(data as Map<String, dynamic>);
  _lastMessages[msg.conversationId] = msg;
  if (msg.conversationId == _activeConversationId) {
    _messages.add(msg);
  }
  // REMOVE: _socketService.getConversations();
  notifyListeners();
},
onNewMessage: (data) {
  final msg = MessageModel.fromJson(data as Map<String, dynamic>);
  _lastMessages[msg.conversationId] = msg;
  if (msg.conversationId == _activeConversationId) {
    _messages.add(msg);
  }
  // REMOVE: _socketService.getConversations();
  notifyListeners();
},
```

**Reasoning**: These calls are unnecessary and may cause race conditions. Conversations list updates when startConversation completes.

3. **BUG FIX**: Add retry logic for `getConversations()` in `onConnect`:
```dart
onConnect: () {
  debugPrint('WebSocket connected, fetching conversations...');
  _socketService.getConversations();
  // Retry after 500ms if conversations are still empty
  Future.delayed(const Duration(milliseconds: 500), () {
    if (_conversations.isEmpty) {
      debugPrint('Retrying getConversations...');
      _socketService.getConversations();
    }
  });
},
```

**Reasoning**: Race condition - sometimes the connection completes before the backend is ready to respond

4. Add `deleteConversation()` method:
```dart
void deleteConversation(int conversationId) {
  // Optimistic UI update
  _conversations.removeWhere((c) => c.id == conversationId);
  _lastMessages.remove(conversationId);
  
  // Clear active conversation if it was deleted
  if (_activeConversationId == conversationId) {
    _activeConversationId = null;
    _messages = [];
  }
  
  notifyListeners();
  
  // Send delete request to server
  _socketService.deleteConversation(conversationId);
}
```

5. **BUG FIX**: Add validation in `connect()` to verify userId:
```dart
void connect({required String token, required int userId}) {
  // Validate token before connecting
  if (JwtDecoder.isExpired(token)) {
    _errorMessage = 'Session expired, please login again';
    notifyListeners();
    return;
  }
  
  final payload = JwtDecoder.decode(token);
  if (payload['sub'] != userId) {
    _errorMessage = 'Invalid session, please login again';
    notifyListeners();
    return;
  }
  
  _currentUserId = userId;
  // ... rest of connect logic
}
```

**Reasoning**: Firefox bug - verify JWT token data matches expected userId before connecting

### 3.7 Auth Form Widget (`frontend/lib/widgets/auth_form.dart`)

**Changes:**

Add username field for registration:

```dart
class _AuthFormState extends State<AuthForm> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _usernameController = TextEditingController(); // NEW

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _usernameController.dispose(); // NEW
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
      return;
    }
    // For registration, username is optional but recommended
    if (!widget.isLogin && _usernameController.text.isEmpty) {
      // Could show a warning or make it required
    }
    
    setState(() => _loading = true);
    if (widget.isLogin) {
      await widget.onSubmit(
        _emailController.text.trim(),
        _passwordController.text,
        null, // No username for login
      );
    } else {
      await widget.onSubmit(
        _emailController.text.trim(),
        _passwordController.text,
        _usernameController.text.trim().isEmpty 
            ? null 
            : _usernameController.text.trim(),
      );
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Email field (unchanged)
        TextField(
          controller: _emailController,
          style: RpgTheme.bodyFont(fontSize: 14, color: Colors.white),
          decoration: RpgTheme.rpgInputDecoration(
            hintText: 'Email',
            prefixIcon: Icons.email_outlined,
          ),
          keyboardType: TextInputType.emailAddress,
          onSubmitted: (_) => _handleSubmit(),
        ),
        const SizedBox(height: 16),
        
        // Username field (only for registration)
        if (!widget.isLogin) ...[
          TextField(
            controller: _usernameController,
            style: RpgTheme.bodyFont(fontSize: 14, color: Colors.white),
            decoration: RpgTheme.rpgInputDecoration(
              hintText: 'Username (optional)',
              prefixIcon: Icons.person_outline,
            ),
            onSubmitted: (_) => _handleSubmit(),
          ),
          const SizedBox(height: 16),
        ],
        
        // Password field (unchanged)
        TextField(
          controller: _passwordController,
          style: RpgTheme.bodyFont(fontSize: 14, color: Colors.white),
          decoration: RpgTheme.rpgInputDecoration(
            hintText: widget.isLogin ? 'Password' : 'Password (min 6 chars)',
            prefixIcon: Icons.lock_outlined,
          ),
          obscureText: true,
          onSubmitted: (_) => _handleSubmit(),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _loading ? null : _handleSubmit,
          child: _loading
              ? const SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: RpgTheme.gold,
                  ),
                )
              : Text(widget.isLogin ? 'Login' : 'Create Account'),
        ),
      ],
    );
  }
}
```

**Need to update callback signature:**
```dart
final Future<void> Function(String email, String password, String? username) onSubmit;
```

### 3.8 Auth Screen (`frontend/lib/screens/auth_screen.dart`)

**Changes:**

Update onSubmit callback to pass username:

```dart
AuthForm(
  isLogin: _isLogin,
  onSubmit: (email, password, username) async {
    if (_isLogin) {
      await authProvider.login(email, password);
    } else {
      final success = await authProvider.register(email, password, username);
      if (success && mounted) {
        setState(() => _isLogin = true);
      }
    }
  },
),
```

### 3.9 NEW: Settings Screen (`frontend/lib/screens/settings_screen.dart`)

**Create new file:**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../theme/rpg_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  void _logout(BuildContext context) {
    context.read<ChatProvider>().disconnect();
    context.read<AuthProvider>().logout();
    Navigator.of(context).pop(); // Return to login screen
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Settings',
          style: RpgTheme.bodyFont(
            fontSize: 18,
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // User info section
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: RpgTheme.boxBg,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: RpgTheme.convItemBorder),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Account',
                    style: RpgTheme.bodyFont(
                      fontSize: 16,
                      color: RpgTheme.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildInfoRow(
                    'Username', 
                    user?.username ?? 'Not set',
                    Icons.person_outline,
                  ),
                  const SizedBox(height: 12),
                  _buildInfoRow(
                    'Email', 
                    user?.email ?? '',
                    Icons.email_outlined,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            
            // Logout button
            ElevatedButton.icon(
              onPressed: () => _logout(context),
              icon: const Icon(Icons.logout, color: RpgTheme.logoutRed),
              label: const Text('Logout'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.transparent,
                foregroundColor: RpgTheme.logoutRed,
                side: const BorderSide(color: RpgTheme.logoutRed),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: RpgTheme.purple, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: RpgTheme.bodyFont(
                fontSize: 12,
                color: RpgTheme.mutedText,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: RpgTheme.bodyFont(
                fontSize: 14,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
```

### 3.10 Conversations Screen (`frontend/lib/screens/conversations_screen.dart`)

**Changes:**

1. Add settings icon to AppBar:

**Mobile layout:**
```dart
Widget _buildMobileLayout() {
  return Scaffold(
    appBar: AppBar(
      title: Text(
        'RPG CHAT',
        style: RpgTheme.pressStart2P(fontSize: 14, color: RpgTheme.gold),
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.settings, color: RpgTheme.purple),
          onPressed: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            );
          },
          tooltip: 'Settings',
        ),
        IconButton(
          icon: const Icon(Icons.logout, color: RpgTheme.logoutRed),
          onPressed: _logout,
          tooltip: 'Logout',
        ),
      ],
    ),
    body: _buildConversationList(),
    floatingActionButton: FloatingActionButton(
      onPressed: _startNewChat,
      child: const Icon(Icons.chat_bubble_outline),
    ),
  );
}
```

**Desktop layout:**
```dart
Container(
  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
  decoration: const BoxDecoration(
    color: RpgTheme.boxBg,
    border: Border(bottom: BorderSide(color: RpgTheme.convItemBorder)),
  ),
  child: Row(
    children: [
      Expanded(
        child: Text(
          'RPG CHAT',
          style: RpgTheme.pressStart2P(fontSize: 12, color: RpgTheme.gold),
        ),
      ),
      IconButton(
        icon: const Icon(Icons.chat_bubble_outline, color: RpgTheme.purple, size: 20),
        onPressed: _startNewChat,
        tooltip: 'New chat',
      ),
      IconButton(
        icon: const Icon(Icons.settings, color: RpgTheme.purple, size: 20),
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const SettingsScreen()),
          );
        },
        tooltip: 'Settings',
      ),
      IconButton(
        icon: const Icon(Icons.logout, color: RpgTheme.logoutRed, size: 20),
        onPressed: _logout,
        tooltip: 'Logout',
      ),
    ],
  ),
),
```

2. Add import for SettingsScreen:
```dart
import 'settings_screen.dart';
```

3. Update conversation list to show username:
```dart
itemBuilder: (context, index) {
  final conv = conversations[index];
  final username = chat.getOtherUserUsername(conv); // Changed from getOtherUserEmail
  final lastMsg = chat.lastMessages[conv.id];
  return ConversationTile(
    displayName: username, // Changed from email
    lastMessage: lastMsg,
    isActive: conv.id == chat.activeConversationId,
    onTap: () => _openChat(conv.id),
    onDelete: () => _deleteConversation(conv.id), // NEW
  );
},
```

4. Add delete conversation handler:
```dart
void _deleteConversation(int conversationId) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: RpgTheme.boxBg,
      title: Text(
        'Delete Conversation',
        style: RpgTheme.bodyFont(
          fontSize: 16,
          color: Colors.white,
          fontWeight: FontWeight.w600,
        ),
      ),
      content: Text(
        'Are you sure? This will delete all messages.',
        style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.mutedText),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(
            'Cancel',
            style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.mutedText),
          ),
        ),
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            context.read<ChatProvider>().deleteConversation(conversationId);
          },
          child: Text(
            'Delete',
            style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.logoutRed),
          ),
        ),
      ],
    ),
  );
}
```

### 3.11 Conversation Tile Widget (`frontend/lib/widgets/conversation_tile.dart`)

**Changes:**

Update to show username and add delete button:

```dart
class ConversationTile extends StatelessWidget {
  final String displayName; // Changed from email
  final MessageModel? lastMessage;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onDelete; // NEW

  const ConversationTile({
    super.key,
    required this.displayName,
    this.lastMessage,
    this.isActive = false,
    required this.onTap,
    required this.onDelete,
  });

  // ... _formatTime unchanged

  @override
  Widget build(BuildContext context) {
    return Material(
      color: isActive ? RpgTheme.activeTabBg : Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        splashColor: RpgTheme.purple.withValues(alpha: 0.2),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              AvatarCircle(email: displayName), // Still uses email for avatar color
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      style: RpgTheme.bodyFont(
                        fontSize: 14,
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (lastMessage != null) ...[
                      const SizedBox(height: 3),
                      Text(
                        lastMessage!.content,
                        style: RpgTheme.bodyFont(
                          fontSize: 13,
                          color: RpgTheme.mutedText,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (lastMessage != null)
                    Text(
                      _formatTime(lastMessage!.createdAt),
                      style: RpgTheme.bodyFont(
                        fontSize: 11,
                        color: RpgTheme.timeColor,
                      ),
                    ),
                  const SizedBox(height: 4),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 18),
                    color: RpgTheme.logoutRed.withValues(alpha: 0.7),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: onDelete,
                    tooltip: 'Delete',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
```

### 3.12 Chat Detail Screen (`frontend/lib/screens/chat_detail_screen.dart`)

**Changes:**

Update to show username instead of email:

```dart
String _getContactName() {
  final chat = context.read<ChatProvider>();
  final conv = chat.conversations
      .where((c) => c.id == widget.conversationId)
      .firstOrNull;
  if (conv == null) return '';
  return chat.getOtherUserUsername(conv); // Changed from getOtherUserEmail
}

@override
Widget build(BuildContext context) {
  final chat = context.watch<ChatProvider>();
  final auth = context.watch<AuthProvider>();
  final messages = chat.messages;
  final contactName = _getContactName(); // Changed from contactEmail

  // ... rest unchanged, just replace contactEmail with contactName in UI
}
```

Update AppBar and embedded header to use `contactName` instead of `contactEmail`.

---

## 4. TESTING APPROACH

### 4.1 Backend Testing

**Manual Testing Steps:**

1. **Database Migration Test**
   - Stop backend
   - Add username column to User entity
   - Start backend - verify TypeORM creates column
   - Check PostgreSQL: `\d users` should show username column

2. **Registration Test**
   - POST /auth/register with username → should create user with username
   - POST /auth/register without username → should create user with null username
   - POST /auth/register with duplicate username → should return 409 Conflict

3. **Login Test**
   - Login with email → JWT should include username (or null)
   - Decode JWT token → verify payload contains username

4. **WebSocket Test**
   - Connect with JWT → verify socket.data.user contains username
   - Send message → verify response includes senderUsername
   - Get conversations → verify userOne/userTwo include username

5. **Delete Conversation Test**
   - Create conversation between user1 and user2
   - user1 deletes conversation → should succeed
   - user3 tries to delete → should get 'Unauthorized' error
   - Verify messages are deleted (check database)

### 4.2 Frontend Testing

**Manual Testing Steps:**

1. **Registration Flow**
   - Register new user with username
   - Verify JWT token saved to SharedPreferences
   - Decode token → verify username present

2. **Login Flow**
   - Login with email (user has username) → should load username from JWT
   - Login with email (user has no username) → should show "Not set" in Settings

3. **Conversations Loading Test (Firefox Bug)**
   - Open in Firefox
   - Login as user1
   - Verify conversations load immediately after login
   - Logout and login as user2
   - Verify conversations are for user2, not user1 (cache cleared)

4. **Username Display Test**
   - Conversations list should show usernames (or email if username null)
   - Chat header should show username
   - Messages should show sender username

5. **Settings Screen Test**
   - Click settings icon → should open settings
   - Verify username and email displayed
   - Click logout → should return to login screen and clear cache

6. **Delete Conversation Test**
   - Click delete icon on conversation
   - Confirm dialog appears
   - Confirm delete → conversation disappears immediately (optimistic update)
   - Refresh page → conversation should still be gone

7. **Cross-browser Test**
   - Test in Chrome, Firefox, Edge
   - Verify cache clearing works in all browsers
   - Verify logout clears all data

### 4.3 Bug-specific Tests

**Bug 1: Conversations not loading**
- Login → wait 2 seconds → verify conversations list populated
- Check browser console for WebSocket errors
- Verify retry logic fires if needed

**Bug 2: Firefox user search cache**
- Firefox: Login as user1 → start chat with user2 → verify shows user2
- Logout → login as user3 → start chat with user4 → verify shows user4 (not user2)
- Check SharedPreferences cleared on logout

---

## 5. POTENTIAL ISSUES AND MITIGATIONS

### 5.1 Database Migration Issues

**Issue**: Existing users will have null username
**Mitigation**: 
- Username is nullable initially
- On first login after migration, prompt user to set username
- Or auto-generate from email prefix and allow customization

**Issue**: Username conflicts (multiple users want same username)
**Mitigation**:
- Unique constraint at database level
- Backend validation with clear error message
- Frontend suggests alternatives (username_1, username_2)

### 5.2 JWT Token Issues

**Issue**: Old JWT tokens don't have username field
**Mitigation**:
- Backend should handle missing username gracefully (return null)
- Frontend checks `username ?? email` when displaying
- Force re-login by expiring old tokens (optional)

### 5.3 WebSocket Race Conditions

**Issue**: `getConversations()` fires before backend is ready
**Mitigation**:
- Add retry logic with 500ms delay
- Add timeout warning if still no data after 5 seconds
- Backend logs to debug connection timing

**Issue**: Multiple `getConversations()` calls cause flickering
**Mitigation**:
- Remove redundant calls from message handlers
- Only call on connect and after startConversation

### 5.4 Cache Persistence Issues (Firefox)

**Issue**: SharedPreferences not clearing properly
**Mitigation**:
- Use `prefs.clear()` instead of `prefs.remove('jwt_token')`
- Add JWT validation before connecting to socket
- Add userId verification in connect method

**Issue**: Browser localStorage persists across sessions
**Mitigation**:
- Always validate token expiry before use
- Check token userId matches expected user

### 5.5 Conversation Deletion Issues

**Issue**: Messages not deleted when conversation deleted
**Mitigation**:
- Configure cascade delete on Message entity
- Or manually delete messages before deleting conversation
- Test with database query to verify cleanup

**Issue**: Other user still sees conversation after deletion
**Mitigation**:
- Currently, deletion is per-user (only deletes from deleter's view)
- If want to delete for both: need to notify other user via WebSocket
- For MVP, consider this a feature (privacy - each user controls their view)

### 5.6 Username Display Issues

**Issue**: Users without username show "Not set" or email
**Mitigation**:
- Consistent fallback: `username ?? email`
- Encourage users to set username on first login
- Consider making username required for new registrations

---

## 6. IMPLEMENTATION SEQUENCE

### Phase 1: Backend Username Support (Blocking)
1. Update User entity - add username column
2. Update RegisterDto - add username validation
3. Update UsersService - add username handling and findByUsername
4. Update AuthService - include username in JWT
5. Update ChatGateway - include username in all WebSocket responses
6. Add ConversationsService.delete() method
7. Add deleteConversation WebSocket handler
8. Test backend changes manually

### Phase 2: Frontend Models & Services (Blocking)
1. Update UserModel - add username field
2. Update MessageModel - add senderUsername field
3. Update ApiService - accept username in register
4. Update SocketService - add deleteConversation method
5. Import jwt_decoder in ChatProvider for validation

### Phase 3: Frontend Auth Flow (Blocking)
1. Update AuthProvider - extract username from JWT, fix logout cache clearing
2. Update AuthForm - add username field for registration
3. Update AuthScreen - pass username to register
4. Test registration and login flows

### Phase 4: Frontend Chat UI (Can parallelize)
1. Update ChatProvider - add getOtherUserUsername, delete method, retry logic, validation
2. Create SettingsScreen
3. Update ConversationsScreen - add settings icon, delete handler
4. Update ConversationTile - show username, add delete button
5. Update ChatDetailScreen - show username

### Phase 5: Bug Fixes (Can parallelize with Phase 4)
1. Remove redundant getConversations calls
2. Add retry logic for initial load
3. Add JWT validation in connect
4. Change logout to use prefs.clear()

### Phase 6: Testing
1. Manual backend testing
2. Manual frontend testing (Chrome, Firefox)
3. Cross-browser verification
4. Bug-specific regression testing

---

## 7. TRADE-OFFS AND DECISIONS

### 7.1 Username: Optional vs Required

**Decision**: Optional initially, encourage on first login
**Reasoning**: 
- Backwards compatible with existing users
- Allows gradual migration
- Can make required in future

**Alternative**: Auto-generate from email
**Rejected because**: Users might not like auto-generated names

### 7.2 Conversation Deletion: Soft vs Hard Delete

**Decision**: Hard delete (remove from database)
**Reasoning**:
- Simpler implementation for MVP
- Users expect deletion to be permanent
- No "archive" requirement

**Alternative**: Soft delete (mark as deleted)
**Rejected for MVP**: Adds complexity, can add later

### 7.3 Conversation Deletion: Per-user vs Both users

**Decision**: Delete for both users (true delete)
**Reasoning**:
- Matches user expectation of "delete conversation"
- Cleaner database (no orphaned conversations)

**Alternative**: Delete only for deleting user
**Could consider**: If privacy is concern (user A wants to delete, user B wants to keep)

### 7.4 Username Display: Fallback Strategy

**Decision**: Show `username ?? email`
**Reasoning**:
- Always shows something meaningful
- Graceful degradation for users without username
- Email is unique and recognizable

**Alternative**: Show "Anonymous" if no username
**Rejected**: Less useful, email is better identifier

### 7.5 Cache Clearing: Selective vs Complete

**Decision**: Clear all SharedPreferences on logout
**Reasoning**:
- Prevents Firefox cache bug
- Ensures clean state for next login
- Low risk (app doesn't store other critical preferences)

**Alternative**: Only clear jwt_token
**Rejected**: Doesn't solve Firefox bug

---

## 8. ROLLBACK PLAN

If critical issues arise:

1. **Backend Migration Rollback**
   - TypeORM synchronize=true makes this difficult
   - Would need manual SQL to drop username column
   - Better: Make username nullable and fix bugs

2. **Frontend Rollback**
   - Revert Git commits
   - Deploy previous version
   - Username field will show null (graceful degradation)

3. **Partial Rollback**
   - Can disable username display without backend rollback
   - Fall back to email-only display

---

### Critical Files for Implementation

1. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\user.entity.ts** - Add username column with nullable unique constraint
2. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts** - Update all WebSocket event payloads to include username; add deleteConversation handler
3. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\auth_provider.dart** - Extract username from JWT, fix logout cache bug with prefs.clear()
4. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart** - Add username helper, delete method, retry logic, remove redundant getConversations calls
5. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\settings_screen.dart** - Create new screen showing username/email with logout button