# Conversations UI Redesign — Implementation Plan

> **For Claude:** Use this plan for implementation (writing-plans / executing-plans).

**Goal:** Redesign main screen and navigation to match the provided screenshot: new header (avatar+shield, "Conversations", plus-in-circle), bottom nav (Conversations | Archive | Settings), search bar under header, divider lines between contacts, add/invitations behind plus icon; remove logout from top bar.

**Architecture:** MainShell with BottomNavigationBar and three tab contents. Conversations tab has custom header + search bar + list with dividers. Plus icon opens AddOrInvitationsScreen (tabs: Add by email, Friend requests). Search filters the conversation list client-side by contact name/username.

**Tech Stack:** Flutter, Provider, existing RpgTheme and ChatProvider.

---

## 1. Scope (from user + screenshot)

- **Header (top row):** Left = user avatar with shield overlay; center = "Conversations"; right = one icon: **plus in circle** (opens add/invitations; badge for pending requests). No hamburger, no settings, no logout in header.
- **Search bar:** Directly under the header row (same place as on screenshot). Filters the **contact/conversation list** client-side (e.g. 100 friends → type to find one). Placeholder e.g. "Search conversations".
- **List:** Each conversation/contact separated by a **line** (Divider), not just spacing.
- **Bottom nav:** Three tabs — **Conversations** (default on app entry), **Archive** ("Coming soon" on tap), **Settings** (current settings screen; logout only here).
- **Add / invitations:** One **new icon** in the header — **plus in circle** — for inviting and accepting friends. Tapping it opens a single screen with two tabs: "Add by email" (current NewChatScreen flow) and "Friend requests" (current FriendRequestsScreen). Badge on plus = pending requests count.
- **Removals:** Logout and Settings icons from top bar; FAB for new chat (replaced by plus in header).

---

## 2. Current state (brief)

- **main.dart:** AuthGate → ConversationsScreen or AuthScreen; no shell with bottom nav.
- **conversations_screen.dart:** Mobile: AppBar "RPG CHAT", actions: person_add (FriendRequestsScreen), settings, logout; body: list; FAB → NewChatScreen. List uses `ListView.separated` with `SizedBox(height: 2)`. Desktop: sidebar with same icons.
- **settings_screen.dart:** Full screen with Settings, Logout button.
- **new_chat_screen.dart:** Add Friend by email.
- **friend_requests_screen.dart:** Incoming friend requests list.

---

## 3. Target architecture

- **MainShell:** Single Scaffold with `BottomNavigationBar` (3 items: Conversations, Archive, Settings) and `body` = content for selected index (0, 1, 2). Default index 0. Used on both mobile and desktop (same breakpoint as today).
- **Tab 0 (Conversations):** Custom header row (avatar+shield, "Conversations", plus-in-circle with optional badge) + **search bar** (TextField, full width under header) + conversation list. Search filters the list by the other user’s display name / username client-side. List items separated by Divider. No AppBar with settings/logout, no FAB.
- **Tab 1 (Archive):** Placeholder screen; on enter show "Coming soon" (e.g. SnackBar or centered text).
- **Tab 2 (Settings):** Current SettingsScreen as tab content; logout only here.
- **AddOrInvitationsScreen:** New screen opened by tapping plus-in-circle. AppBar + TabBar with two tabs: "Add by email" (current NewChatScreen logic) and "Friend requests" (current FriendRequestsScreen logic). Badge on plus icon in MainShell = `ChatProvider.pendingRequestsCount`.
- **Search:** One `TextEditingController` (or search query state) in ConversationsScreen. Filter `chat.conversations` (or the list passed to the list view) by matching the other user’s display name / username (case-insensitive, contains). Build `ListView.separated` from the filtered list; separator = Divider.

---

## 4. Key files

| Change | File |
|--------|------|
| Shell + bottom nav, default tab Conversations | **New:** `frontend/lib/screens/main_shell.dart`; **Edit:** `frontend/lib/main.dart` (AuthGate returns MainShell when logged in) |
| Header (avatar+shield, Conversations, plus+badge) + search bar + list with Divider | **Edit:** `frontend/lib/screens/conversations_screen.dart` |
| Search filter state and Divider separator | **Edit:** `frontend/lib/screens/conversations_screen.dart` (`_buildConversationList` uses filtered list + Divider) |
| Add/Invitations screen (tabs: Add by email, Friend requests) | **New:** `frontend/lib/screens/add_or_invitations_screen.dart` (or embed NewChatScreen + FriendRequestsScreen as tab bodies) |
| Archive placeholder | **New:** `frontend/lib/screens/archive_placeholder_screen.dart` |

---

## 5. Implementation details

### 5.1 main.dart

- In AuthGate, when `auth.isLoggedIn`, return `MainShell()` instead of `ConversationsScreen()`.

### 5.2 MainShell (new)

- StatefulWidget: `selectedIndex` (default 0).
- Scaffold with `body: IndexedStack(children: [ConversationsScreen(...), ArchivePlaceholderScreen(), SettingsScreen()], index: selectedIndex)` and `bottomNavigationBar: BottomNavigationBar(currentIndex: selectedIndex, onTap: setState, items: Conversations, Archive, Settings)`.
- Labels: e.g. "Conversations", "Archive", "Settings". Icons: e.g. `Icons.chat_bubble_outline`, `Icons.archive_outlined`, `Icons.settings_outlined`.

### 5.3 ConversationsScreen — header + search + list

- **Header row:** Row with: AvatarCircle(currentUser) + small shield overlay (e.g. `Icons.shield` in Positioned bottomRight, blue/surface color); Spacer/Expanded; Text("Conversations"); Spacer; Stack(IconButton(plus-in-circle, onPressed → push AddOrInvitationsScreen), badge with `ChatProvider.pendingRequestsCount` when > 0).
- **Search bar:** Directly below header. Full-width TextField (or TextFormField) with placeholder "Search conversations", clear button optional. Store query in state (e.g. `_searchQuery`). Use theme-appropriate background and border (e.g. RpgTheme input styles).
- **List:** `_buildConversationList()`:
  - Compute filtered list: from `chat.conversations` (and `chat.getOtherUser` / `chat.getOtherUserUsername`) filter where display name or username contains `_searchQuery` (trim, toLowerCase). If `_searchQuery` is empty, show all.
  - `ListView.separated`: itemCount = filtered length, itemBuilder = ConversationTile for each, **separatorBuilder** = `Divider(height: 1, color: convItemBorderDark/convItemBorderLight)`.
- Remove: AppBar with settings/logout, FAB. Desktop: same header + search + list in left column; no settings/logout in sidebar.

### 5.4 AddOrInvitationsScreen (new)

- Scaffold with AppBar (e.g. "Add / Invitations") and TabBar (2 tabs: "Add by email", "Friend requests"). TabBarView with [NewChatScreen content, FriendRequestsScreen content] — either reuse screens as child widgets (without their own Scaffold when embedded) or extract body content into reusable widgets to avoid nested Scaffolds.
- Plus icon in MainShell opens this screen via `Navigator.push(MaterialPageRoute(builder: (_) => AddOrInvitationsScreen()))`. Return value handling for opening a conversation after accept (e.g. pop(conversationId)) same as current flow.

### 5.5 ArchivePlaceholderScreen (new)

- Minimal widget: centered text "Coming soon" or show SnackBar("Coming soon") on first visibility. No extra AppBar (tab content only).

### 5.6 SettingsScreen

- No change in content. Shown as tab 2 in MainShell. Logout remains here only.

### 5.7 Icon and copy

- **Plus-in-circle:** `Icons.add_circle_outline` or `Icons.add_circle` (theme primary/accent). This is the single **new icon** for inviting and accepting friends (replaces FAB and separate person_add in header).
- **Shield:** Small overlay on avatar, e.g. `Icons.shield` (blue or as on screenshot).

---

## 6. Task order

1. Add MainShell with bottom nav and three tab bodies; wire AuthGate to MainShell when logged in.
2. Refactor ConversationsScreen: custom header (avatar+shield, "Conversations", plus+badge), remove AppBar actions and FAB; add search bar under header; filter list by search query; change separator to Divider; desktop layout same header + search + list, no settings/logout.
3. Implement AddOrInvitationsScreen with TabBar (Add by email, Friend requests) and wire plus icon to push it; preserve open-conversation-after-accept behavior.
4. Add ArchivePlaceholderScreen with "Coming soon".
5. Smoke test: enter app → Conversations; search filters list; plus → Add/Invitations; Archive → "Coming soon"; Settings → logout. Update CLAUDE.md (Nav, Quick Reference).

---

## 7. Notes

- **Search:** Client-side only; filters existing `chat.conversations` by other user’s display name/username. No backend search.
- **Hamburger (3 bars):** Not in scope; do not add.
- **Logout:** Only from Settings tab; removed from top bar.
- **Badge:** On plus icon when `pendingRequestsCount > 0`, same style as current person_add badge.
