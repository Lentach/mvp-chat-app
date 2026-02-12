# Explore: Find all debug console logs

> Session: `c5d68aa5-55ca-416a-a75f-67abf9be98de`
> Date: 2026-01-31
> Tokens: ~21,841

---

Perfect! I found all the debug logs. Here's the complete list of debug/console log statements that were added for troubleshooting the session leak issue:

## DEBUG LOG STATEMENTS TO REMOVE

### Frontend - C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib

**1. main.dart**
- Line 57: `debugPrint('🚪 AuthGate.build() - isLoggedIn: ${auth.isLoggedIn}, previous: $_previousLoggedInState, userId: ${auth.currentUser?.id}');`
- Line 61: `debugPrint('   🔓 LOGOUT detected - scheduling disconnect()');`
- Line 70: `debugPrint('   ✅ Showing ConversationsScreen');`
- Line 73: `debugPrint('   🔐 Showing AuthScreen');`

**2. screens/conversations_screen.dart**
- Line 23: `debugPrint('💬 ConversationsScreen.initState() - scheduling connect()');`
- Line 27: `debugPrint('💬 ConversationsScreen postFrameCallback - calling connect() for userId: ${auth.currentUser!.id}');`

**3. providers/chat_provider.dart**
- Line 77: `debugPrint('🔌 ChatProvider.connect() called for userId: $userId');`
- Line 78: `debugPrint('   Previous state - conversations: ${_conversations.length}, friends: ${_friends.length}, requests: ${_friendRequests.length}');`
- Line 93: `debugPrint('   ✅ State cleared - conversations: ${_conversations.length}, friends: ${_friends.length}, requests: ${_friendRequests.length}');`
- Line 100: `debugPrint('   🔌 Disconnecting old socket');`
- Line 105: `debugPrint('   🆔 Current user ID set to: $_currentUserId');`
- Line 110: `debugPrint('WebSocket connected, fetching conversations...');`
- Line 116: `debugPrint('Retrying getConversations...');`
- Line 127: `debugPrint('📋 Received conversationsList: ${_conversations.length} conversations for userId: $_currentUserId');`
- Line 161: `debugPrint('Socket error: $err');`
- Line 174: `debugPrint('📨 Received friendRequestsList: ${_friendRequests.length} requests for userId: $_currentUserId');`
- Line 183: `debugPrint('Friend request sent confirmed by server');`
- Line 209: `debugPrint('👥 Received friendsList: ${_friends.length} friends for userId: $_currentUserId');`
- Line 241: `debugPrint('Disconnected from WebSocket');`
- Line 328: `debugPrint('🔌 ChatProvider.disconnect() called');`
- Line 329: `debugPrint('   Current state before disconnect - conversations: ${_conversations.length}, friends: ${_friends.length}, requests: ${_friendRequests.length}');`
- Line 341: `debugPrint('   ✅ State cleared after disconnect');`

**Note:** Line 56 in settings_screen.dart (`debugPrint('Error loading device name: $e');`) is a standard error log and should remain.

### Backend - C:\Users\Lentach\desktop\mvp-chat-app\backend\src

**1. conversations/conversations.service.ts**
- Line 42: `console.log(`[ConversationsService] findByUser called with userId=${userId}`);`
- Line 52: `console.log(`[ConversationsService] findByUser found ${conversations.length} conversations:`);`
- Line 54: `console.log(`  - Conversation id=${c.id}, userOne=${c.userOne?.id}, userTwo=${c.userTwo?.id}`);`

**2. friends/friends.service.ts**
- Line 195: `console.log(`[FriendsService] getFriends called with userId=${userId}`);`
- Line 211: `console.log(`[FriendsService] getFriends found ${friendRequests.length} accepted requests for userId=${userId}`);`

**TOTAL: 25 debug log lines across 5 files (2 frontend files + 3 backend files)**