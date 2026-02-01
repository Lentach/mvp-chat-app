# Dark Mode – Delete Account Palette (Design + Implementation)

**Date:** 2026-02-01

> **For Claude:** When implementing from scratch, use superpowers:executing-plans task-by-task.

**Goal:** Dark mode uses the same palette as the Delete Account dialog: reddish-pink (#FF6666) as primary accent instead of gold; borders/secondary in the same family instead of purple; Settings tiles use warning-box style. Light mode unchanged.

---

## Part 1 – Design

### 1.1 Goals and dark mode palette

**Palette (dark mode only):**
- **Primary (main accent):** Reddish-pink `#FF6666` — headers (Settings, titles), logo, accent icons, active tiles, input focus, primary buttons, links.
- **Backgrounds:** Unchanged — main `#0A0A2E`, surfaces/cards `#0F0F3D`.
- **Exception — Settings tiles:** Same as “This action is permanent…” box — background `#FF6666` with alpha 0.1; optional border `#FF6666`.
- **Secondary / borders:** Replace purple (#7B7BF5, #4A4AE0) with same-family shades: e.g. darker reddish-pink `#CC5555` or gray-pink `#8A6A6A` for input borders, outlined buttons (Cancel), inactive tabs, dividers.
- **Text:** Primary text unchanged; muted text shifted toward gray-pink so it fits the new palette.
- **Light mode:** Unchanged (neutral backgrounds, purple primary #4A154B).

### 1.2 Where we change (theme + screens)

**RpgTheme (`frontend/lib/theme/rpg_theme.dart`):**
- Add dark-mode–only constants: e.g. `accentDark = #FF6666`, `borderDark`, `mutedDark` (gray-pink), `settingsTileBgDark`, `settingsTileBorderDark`.
- In dark `themeData`: ColorScheme primary = accentDark; secondary = borderDark; inputDecorationTheme, elevatedButtonTheme, textButtonTheme, floatingActionButtonTheme, textTheme use new dark palette.
- `primaryColor(context)` for dark returns accentDark; light unchanged.

**Screens and widgets (dark only):**
- Any hardcoded `RpgTheme.gold` or `RpgTheme.purple` in dark context → use new constants or `Theme.of(context).colorScheme.primary`.
- **Settings:** In `_buildSettingsTile`, when `isDark`: tile decoration = warning-box style (background FF6666 @ 0.1, border #FF6666).
- **Delete Account dialog:** Use `RpgTheme.accentDark` and settingsTileBgDark/BorderDark for single source of truth.

**Files to touch:** rpg_theme.dart, settings_screen.dart, delete_account_dialog.dart; conversations_screen, chat_detail_screen, conversation_tile, avatar_circle, auth_screen, chat_message_bubble, friend_requests_screen, chat_input_bar, message_date_separator, reset_password_dialog, profile_picture_dialog.

### 1.3 Verification

- **Manual (dark mode):** Auth, Conversations, Chat, Settings, Friend Requests, New Chat, Reset Password dialog, Delete Account dialog, Profile Picture dialog — primary accent reddish-pink, no gold/purple.
- **Settings tiles:** Background and border match “This action is permanent…” box.
- **Light mode:** Quick smoke check — no regressions.
- **Optional:** `flutter analyze` after changes.

---

## Part 2 – Implementation Plan

**Architecture:** Add dark-only color constants in RpgTheme; switch dark ThemeData and primaryColor(context); update Settings tile decoration for dark; replace hardcoded gold/purple in dark branches with new constants or colorScheme.primary.

**Tech Stack:** Flutter, Dart, RpgTheme (ThemeData), Material ColorScheme.

---

### Task 1: Add dark palette constants to RpgTheme

**Files:** Modify `frontend/lib/theme/rpg_theme.dart`

After existing dark colors (e.g. after `timeColor`), add:

```dart
  // Dark mode – Delete Account palette (primary accent, borders, muted)
  static const Color accentDark = Color(0xFFFF6666);
  static const Color borderDark = Color(0xFFCC5555);
  static const Color mutedDark = Color(0xFF9A8A8A);
  static const Color buttonBgDark = Color(0xFF8A3333);
  static const Color activeTabBgDark = Color(0xFF3D2525);
  static const Color tabBorderDark = Color(0xFF8A5555);
  static const Color convItemBorderDark = Color(0xFF5A3535);
  static const Color timeColorDark = Color(0xFF9A7A7A);
  // Settings tiles in dark: same as Delete Account warning box
  static Color get settingsTileBgDark => accentDark.withValues(alpha: 0.1);
  static const Color settingsTileBorderDark = Color(0xFFFF6666);
```

Verify: `flutter analyze lib/theme/rpg_theme.dart` — no errors.

---

### Task 2: Switch dark ThemeData to new palette

**Files:** Modify `frontend/lib/theme/rpg_theme.dart` (themeData getter)

In `themeData` (dark), replace:
- `primary: gold` → `primary: accentDark`; `secondary: purple` → `secondary: borderDark`
- appBarTheme: `color: gold` → `color: accentDark`
- inputDecorationTheme: border/enabledBorder `tabBorder` → `tabBorderDark`; focusedBorder `gold` → `accentDark`; hintStyle/labelStyle `mutedText`/`labelText` → `mutedDark`
- elevatedButtonTheme: backgroundColor `buttonBg` → `buttonBgDark`; foregroundColor and side `gold` → `accentDark`
- textButtonTheme: foregroundColor `purple` → `borderDark`
- floatingActionButtonTheme: backgroundColor `purple` → `accentDark`
- listTileTheme: selectedTileColor `activeTabBg` → `activeTabBgDark`
- dividerTheme: color `convItemBorder` → `convItemBorderDark`
- textTheme: titleLarge `gold` → `accentDark`; bodySmall `mutedText` → `mutedDark`

Verify: `flutter analyze lib/theme/rpg_theme.dart` — no errors.

---

### Task 3: primaryColor(context) for dark

**Files:** Modify `frontend/lib/theme/rpg_theme.dart`

Change `primaryColor(BuildContext context)` to return `accentDark` when dark (replace `gold` with `accentDark` in the dark branch).

Verify: `flutter analyze lib/` — no errors.

---

### Task 4: Settings screen – tile decoration in dark

**Files:** Modify `frontend/lib/screens/settings_screen.dart`

In `_buildSettingsTile`: when `RpgTheme.isDark(context)` is true, use decoration `color: RpgTheme.settingsTileBgDark`, `border: Border.all(color: RpgTheme.settingsTileBorderDark, width: 1.5)`, same borderRadius. When false, keep current colorScheme.surface and outline border.

Verify: `flutter analyze lib/screens/settings_screen.dart` — no errors.

---

### Task 5: Widgets – dark branch use new constants

**Files:** conversations_screen.dart, chat_detail_screen.dart, auth_screen.dart, conversation_tile.dart, avatar_circle.dart, chat_message_bubble.dart, chat_input_bar.dart, message_date_separator.dart, friend_requests_screen.dart, reset_password_dialog.dart, profile_picture_dialog.dart, delete_account_dialog.dart.

Replace dark-only RpgTheme usages:
- **conversations_screen:** mutedText → mutedDark; convItemBorder → convItemBorderDark; timeColor → timeColorDark.
- **chat_detail_screen:** mutedText → mutedDark; convItemBorder → convItemBorderDark.
- **conversation_tile:** activeTabBg → activeTabBgDark; mutedText → mutedDark.
- **avatar_circle:** gradient dark: purple, gold → borderDark, accentDark; overlay dark: gold → accentDark.
- **auth_screen:** tabBorder → tabBorderDark; activeTabBg → activeTabBgDark; gold → accentDark; mutedText → mutedDark.
- **chat_message_bubble:** mine (dark) gold → accentDark; theirs (dark) purple → borderDark; timeColor → timeColorDark.
- **chat_input_bar:** convItemBorder → convItemBorderDark; tabBorder → tabBorderDark; send icon (dark) gold → accentDark; mutedText → mutedDark.
- **message_date_separator:** convItemBorder → convItemBorderDark; timeColor → timeColorDark.
- **friend_requests_screen:** border → borderDark; secondary text (dark) → mutedDark.
- **reset_password_dialog:** border → borderDark; mutedText → mutedDark.
- **profile_picture_dialog:** border → borderDark; mutedText → mutedDark.
- **delete_account_dialog:** All `Color(0xFFFF6666)` → `RpgTheme.accentDark`; warning box use settingsTileBgDark/settingsTileBorderDark; input/Cancel use borderDark and mutedDark for dark.

Also update **rpg_theme.dart** `rpgInputDecoration`: when dark use `mutedDark` for icon color.

Verify: `flutter analyze lib/` — no errors.

---

### Task 6: Optional – convItemBgDark

Skip if design keeps list card backgrounds unchanged. Otherwise: add `convItemBgDark` in RpgTheme; use in friend_requests_screen cardBg when dark.

---

### Task 7: Verification and CLAUDE.md

- Run `flutter analyze` — no errors.
- Manual: dark mode on all screens/dialogs; Settings tiles style; light mode unchanged.
- Update CLAUDE.md: Dark mode Delete Account palette (accent #FF6666, Settings tiles warning-box style); Theme System section – dark palette description.

---

## Execution

Use **executing-plans** to run Tasks 1–5 and 7 (Task 6 optional). On completion use **finishing-a-development-branch** if needed.
