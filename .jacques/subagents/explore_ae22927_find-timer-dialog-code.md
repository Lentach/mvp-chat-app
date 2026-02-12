# Explore: Find timer dialog code

> Session: `ebcaa403-d299-4ce0-b47e-7dd829bd61dd`
> Date: 2026-02-06
> Tokens: ~35,318

---

Perfect! Now let me compile all my findings into a comprehensive report for you.

## Summary

I've found and analyzed the timer selection dialog for disappearing messages and the full message loading flow. Here's what I discovered:

### Timer Selection Dialog Location

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\chat_action_tiles.dart`

The dialog is implemented in the `_TimerDialog` class (lines 200-257):

```dart
class _TimerDialog extends StatefulWidget {
  @override
  State<_TimerDialog> createState() => _TimerDialogState();
}

class _TimerDialogState extends State<_TimerDialog> {
  int? _selectedSeconds;

  final _options = [
    {'label': '30 seconds', 'value': 30},
    {'label': '1 minute', 'value': 60},
    {'label': '5 minutes', 'value': 300},
    {'label': '1 hour', 'value': 3600},
    {'label': '1 day', 'value': 86400},
    {'label': 'Off', 'value': null},
  ];

  @override
  void initState() {
    super.initState();
    final chat = context.read<ChatProvider>();
    _selectedSeconds = chat.conversationDisappearingTimer;
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Disappearing Messages'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: _options.map((opt) {
          return RadioListTile<int?>(
            title: Text(opt['label'] as String),
            value: opt['value'] as int?,
            groupValue: _selectedSeconds,
            onChanged: (val) {
              setState(() => _selectedSeconds = val);
            },
          );
        }).toList(),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            final chat = context.read<ChatProvider>();
            chat.setConversationDisappearingTimer(_selectedSeconds);
            Navigator.pop(context);
          },
          child: const Text('Set'),
        ),
      ],
    );
  }
}
```

**How it works:**
- Timer options: 30s, 1m, 5m, 1h, 1d, or Off (null)
- Uses `RadioListTile` for selection
- On initialization, reads current timer value from `ChatProvider.conversationDisappearingTimer`
- "Set" button calls `chat.setConversationDisappearingTimer(_selectedSeconds)` and closes
- "Cancel" button just closes without changes

---

### Message Loading Flow (`onMessageHistory`)

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart`

**Flow:**

1. **Opening a conversation** (lines 286-291):
   ```dart
   void openConversation(int conversationId, {int limit = AppConstants.messagePageSize}) {
     _activeConversationId = conversationId;
     _messages = [];
     _socketService.getMessages(conversationId, limit: limit);
     notifyListeners();
   }
   ```

2. **Socket emits `getMessages`** (in `socket_service.dart` lines 118-125):
   ```dart
   void getMessages(int conversationId, {int? limit, int? offset}) {
     final payload = <String, dynamic>{
       'conversationId': conversationId,
     };
     if (limit != null) payload['limit'] = limit;
     if (offset != null) payload['offset'] = offset;
     _socket?.emit('getMessages', payload);
   }
   ```

3. **Backend responds with `messageHistory` event**, which triggers `onMessageHistory` callback (lines 194-208 in `chat_provider.dart`):
   ```dart
   onMessageHistory: (data) {
     final list = data as List<dynamic>;
     _messages = list
         .map((m) => MessageModel.fromJson(m as Map<String, dynamic>))
         .toList();
     // Immediately remove any already-expired messages
     final now = DateTime.now();
     _messages.removeWhere(
       (m) => m.expiresAt != null && m.expiresAt!.isBefore(now),
     );
     notifyListeners();
     if (_activeConversationId != null) {
       markConversationRead(_activeConversationId!);
     }
   },
   ```

4. **Key behaviors:**
   - Clears `_messages = []` before requesting (fresh load)
   - Removes any expired messages immediately (checks `expiresAt`)
   - Automatically marks conversation as read (`markConversationRead`)
   - Notifies listeners so UI updates with new messages
   - Default limit: `AppConstants.messagePageSize` (50 messages)

5. **Loading more messages** (lines 295-299):
   ```dart
   void loadMoreMessages({int additionalLimit = AppConstants.messagePageSize}) {
     if (_activeConversationId == null) return;
     final newLimit = _messages.length + additionalLimit;
     _socketService.getMessages(_activeConversationId!, limit: newLimit);
   }
   ```
   - Pagination uses expanding limit (current count + 50) instead of offset
   - Triggered manually or via scroll detection

---

### Message Model Details

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\models\message_model.dart`

**Key fields for disappearing messages:**
```dart
final DateTime? expiresAt;
final MessageDeliveryStatus deliveryStatus;
final MessageType messageType;
final String? mediaUrl;
final String? tempId;
```

**Delivery statuses:**
- `SENDING` (clock icon, optimistic message)
- `SENT` (✓ grey)
- `DELIVERED` (✓ grey)
- `READ` (✓✓ blue)

---

### Integration in ChatDetailScreen

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\chat_detail_screen.dart`

**How messages load when entering chat** (lines 57-66):
```dart
@override
void initState() {
  super.initState();
  _scrollController.addListener(_onScroll);
  WidgetsBinding.instance.addPostFrameCallback((_) {
    final chat = context.read<ChatProvider>();
    if (chat.activeConversationId != widget.conversationId) {
      chat.openConversation(widget.conversationId);
    }
    _scrollToBottomOnce();
  });
  
  // Refresh every second to update countdown and remove expired messages
  _timerCountdownRefresh = Timer.periodic(
    const Duration(seconds: 1),
    (_) {
      if (!mounted) return;
      context.read<ChatProvider>().removeExpiredMessages();
      setState(() {});
    },
  );
}
```

**Key mechanisms:**
- Calls `openConversation()` in post-frame callback
- Timer refreshes every 1 second to remove expired messages
- Scroll listener detects new messages and shows "scroll to bottom" button
- Messages display with delivery indicators and expiration timers

---

### Files Involved

1. **`frontend/lib/widgets/chat_action_tiles.dart`** - Timer dialog UI
2. **`frontend/lib/providers/chat_provider.dart`** - Message loading, delivery tracking, expiration
3. **`frontend/lib/services/socket_service.dart`** - WebSocket getMessages emit
4. **`frontend/lib/models/message_model.dart`** - Message structure and enums
5. **`frontend/lib/screens/chat_detail_screen.dart`** - Integration and display