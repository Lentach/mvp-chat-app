# Plan: Professional Messenger UI (Signal/WhatsApp style)

## Goal
Transform the Flutter frontend from a fixed-size retro RPG box into a mobile-first, professional messenger app while keeping the RPG dark-blue/gold/purple color palette.

## Key Design Decisions
- **Mobile-first** responsive layout (works on phones, adapts to desktop)
- **Keep RPG colors** (dark blue, gold, purple) but use readable font (`Inter`) for body text; `Press Start 2P` only for titles/logos
- **Navigation**: conversations list → tap → full-screen chat (mobile) or side-by-side (desktop ≥600px)
- **No backend changes** — work within existing WebSocket events and REST endpoints
- **Material 3 widgets** — replace custom GestureDetector buttons with proper ElevatedButton, ListTile, FloatingActionButton, etc.

---

## Implementation Phases

### Phase 1: Theme Foundation
**Modify** `frontend/lib/theme/rpg_theme.dart`
- Keep all color constants
- Add `static ThemeData get themeData` — full `ThemeData.dark()` override with RPG colors mapped to colorScheme, appBarTheme, inputDecorationTheme (rounded 8px corners), buttonThemes, listTileTheme
- Add `bodyFont()` helper using `GoogleFonts.inter()` for readable text
- Keep `pressStart2P()` for titles only
- Update `rpgInputDecoration` to use `BorderRadius.circular(8)` instead of `BorderRadius.zero`

**Modify** `frontend/lib/main.dart`
- Apply `RpgTheme.themeData` as the app theme
- AuthGate points to `ConversationsScreen` instead of `ChatScreen`

### Phase 2: Auth Screen Modernization
**Rewrite** `frontend/lib/screens/auth_screen.dart`
- Responsive: `SafeArea` + `SingleChildScrollView` + `Center` + `ConstrainedBox(maxWidth: 400)`
- Keep RPG CHAT title in Press Start 2P gold
- Use readable font for form fields and buttons
- `ElevatedButton` instead of `GestureDetector` containers
- `SegmentedButton` or styled toggle for LOGIN/REGISTER

**Rewrite** `frontend/lib/widgets/auth_form.dart`
- Modern Material inputs with rounded corners
- Readable font, proper validation UX

### Phase 3: Conversations Screen + Navigation
**Create** `frontend/lib/widgets/avatar_circle.dart`
- CircleAvatar with purple-to-gold gradient, first letter of email

**Create** `frontend/lib/widgets/conversation_tile.dart`
- ListTile with avatar, email, last message preview, timestamp
- InkWell tap feedback, active state highlight

**Create** `frontend/lib/screens/conversations_screen.dart`
- **Mobile** (width ≤600): AppBar ("RPG Chat" in Press Start 2P + logout icon), scrollable conversation list, FAB to start new chat
- **Desktop** (width >600): `Row` with 320px conversation list on left + chat detail on right
- Uses `LayoutBuilder` for responsive breakpoint

**Modify** `frontend/lib/providers/chat_provider.dart`
- Add `Map<int, MessageModel> _lastMessages` — track last message per conversation (from `onMessageSent`/`onNewMessage`)
- Add `int? _pendingOpenConversationId` — set by `onOpenConversation`, consumed by UI to navigate after `startConversation`
- Add `consumePendingOpen()` method
- Add helper to get other user from conversation

### Phase 4: Chat Detail Screen
**Create** `frontend/lib/widgets/message_date_separator.dart`
- "Today", "Yesterday", or formatted date — centered with horizontal lines

**Create** `frontend/lib/widgets/chat_message_bubble.dart`
- Rounded corners (16px) with directional tail
- Sent = right-aligned, gold left border, `mineMsgBg`
- Received = left-aligned, purple left border, `theirsMsgBg`
- Timestamp inside bubble, bottom-right, muted
- Readable font for message content

**Create** `frontend/lib/widgets/chat_input_bar.dart`
- TextField (rounded) + circular send IconButton (gold icon, purple bg)
- `SafeArea(top: false)` for phone gesture bars

**Create** `frontend/lib/screens/chat_detail_screen.dart`
- AppBar with back arrow (mobile) + contact email
- Message list with auto-scroll to bottom
- Input bar at bottom
- Connects to `ChatProvider.openConversation()` on init

### Phase 5: New Chat Flow
**Create** `frontend/lib/screens/new_chat_screen.dart`
- AppBar "New Chat"
- Email text field + "Start" button
- Calls `chatProvider.startConversation(email)`
- Listens to `pendingOpenConversationId` to navigate to chat after creation
- Error display

### Phase 6: Cleanup
**Delete** unused files:
- `frontend/lib/screens/chat_screen.dart` (replaced by conversations_screen)
- `frontend/lib/widgets/rpg_box.dart`
- `frontend/lib/widgets/sidebar.dart`
- `frontend/lib/widgets/conversation_item.dart`
- `frontend/lib/widgets/message_bubble.dart`
- `frontend/lib/widgets/message_input_bar.dart`
- `frontend/lib/widgets/no_chat_selected.dart`
- `frontend/lib/widgets/blinking_cursor.dart`
- `frontend/lib/widgets/tab_bar_widget.dart`

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `frontend/lib/theme/rpg_theme.dart` |
| Modify | `frontend/lib/main.dart` |
| Modify | `frontend/lib/screens/auth_screen.dart` |
| Modify | `frontend/lib/widgets/auth_form.dart` |
| Modify | `frontend/lib/providers/chat_provider.dart` |
| Create | `frontend/lib/screens/conversations_screen.dart` |
| Create | `frontend/lib/screens/chat_detail_screen.dart` |
| Create | `frontend/lib/screens/new_chat_screen.dart` |
| Create | `frontend/lib/widgets/avatar_circle.dart` |
| Create | `frontend/lib/widgets/conversation_tile.dart` |
| Create | `frontend/lib/widgets/chat_message_bubble.dart` |
| Create | `frontend/lib/widgets/chat_input_bar.dart` |
| Create | `frontend/lib/widgets/message_date_separator.dart` |
| Delete | `frontend/lib/screens/chat_screen.dart` + 8 old widgets |

**Unchanged**: models, services, config, pubspec.yaml

---

## Verification
1. `cd frontend && flutter pub get` — dependencies resolve
2. `flutter analyze` — no static analysis errors
3. `flutter build web` — compiles successfully
4. Manual test: register → login → see conversations list → start new chat by email → send/receive messages → logout
5. Test on narrow viewport (mobile) and wide viewport (desktop) — responsive layout adapts

## Pre-implementation: Update CLAUDE.md
Before starting implementation, update CLAUDE.md with:
- Detailed frontend architecture notes (navigation flow, responsive breakpoints, theme system)
- Known backend limitations and gotchas
- Widget patterns and conventions


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\c64e528e-e9d5-4dea-ac57-487ada3b19ad.jsonl