# Session: Conversations UI redesign (plan execution)

**Date:** 2026-02-01

## Done
- **MainShell:** New `main_shell.dart` with BottomNavigationBar (Conversations, Archive, Settings). `main.dart` AuthGate now returns `MainShell()` when logged in instead of `ConversationsScreen()`.
- **ConversationsScreen:** Removed AppBar (RPG CHAT, settings, logout, person_add), removed FAB. Added custom header: avatar with shield overlay, "Conversations" title, plus-in-circle with pending-requests badge. Plus opens `AddOrInvitationsScreen`. Desktop layout: same custom header in sidebar, no settings/logout icons.
- **List separator:** Replaced `SizedBox(height: 2)` with `Divider` using `convItemBorderDark` / `convItemBorderLight`.
- **AddOrInvitationsScreen:** New `add_or_invitations_screen.dart` with TabBar ("Add by email", "Friend requests"). Tab content: Add by email form (from NewChatScreen logic), Friend requests list (from FriendRequestsScreen logic). No nested Scaffolds. Pop with conversation id on accept/open so caller can open chat.
- **ArchivePlaceholderScreen:** New `archive_placeholder_screen.dart` with centered "Coming soon".
- **SettingsScreen:** Logout only calls `Navigator.pop(context)` when `canPop()` (safe when used as tab in MainShell).
- **CLAUDE.md:** Updated Quick Reference (Nav, Auto-open), Architecture (MainShell, AddOrInvitationsScreen, Archive), Recent Changes, Theme line.

## Key files
- `frontend/lib/main.dart` — AuthGate → MainShell
- `frontend/lib/screens/main_shell.dart` — new
- `frontend/lib/screens/archive_placeholder_screen.dart` — new
- `frontend/lib/screens/add_or_invitations_screen.dart` — new
- `frontend/lib/screens/conversations_screen.dart` — custom header, no AppBar/FAB, Divider separator, plus → AddOrInvitationsScreen
- `frontend/lib/screens/settings_screen.dart` — logout pop only when canPop
- `CLAUDE.md` — nav and architecture updated

## Notes
- NewChatScreen and FriendRequestsScreen remain in the repo (AddOrInvitationsScreen reuses their logic in tabs). Primary entry for add/invitations is plus → AddOrInvitationsScreen.
- Flutter analyze: one info fixed (separatorBuilder `(_, __)` → `(_, _index)`). Other infos in dialogs (prefer_final_fields) unchanged.
