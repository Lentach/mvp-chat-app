# Settings Screen Redesign - Implementation Plan

## Overview
Complete redesign of settings screen with profile pictures, active status, dark mode, device info, password reset, and account deletion. Follows RPG theme and existing project patterns.

## Design Reference
Based on user screenshots:
- **Header:** Large circular avatar (120px), username below, email below that, camera icon badge
- **Body:** Full-width tiled menu items with icon left, label, action/chevron right
- **Theme:** Dark background, purple accents, gold highlights (existing RPG palette)

## User Requirements Summary

### Features to Implement
1. **Profile Picture Upload** - Upload + fallback to AvatarCircle, camera badge, backend storage
2. **Active Status Toggle** - On/off switch directly on tile, backend WebSocket tracking
3. **Dark Mode** - System/Light/Dark toggle on tile, persisted via SharedPreferences
4. **Privacy and Safety** - Placeholder tile (no functionality)
5. **Devices** - Show current device name (frontend detection via device_info_plus)
6. **Reset Password** - Dialog with old/new password fields, backend validation
7. **Delete Account** - Confirmation dialog, backend cascade deletion

---

## Phase 1: Backend Foundation

### 1.1 Update User Entity
**File:** `backend/src/users/user.entity.ts`

Add two new columns:
```typescript
@Column({ nullable: true })
profilePictureUrl: string; // Relative path like /uploads/profiles/user-123-timestamp.jpg

@Column({ default: true })
activeStatus: boolean; // Controls online/offline visibility
```

**Migration:** TypeORM auto-migrates with `synchronize: true` (existing users get null/true defaults)

### 1.2 Create DTOs
**File:** `backend/src/users/dto/user.dto.ts` (NEW)

```typescript
export class ResetPasswordDto {
  @IsString() @MinLength(8) oldPassword: string;
  @IsString() @MinLength(8) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/) newPassword: string;
}

export class DeleteAccountDto {
  @IsString() @MinLength(1) password: string;
}

export class UpdateActiveStatusDto {
  @IsBoolean() activeStatus: boolean;
}
```

### 1.3 Update UsersService
**File:** `backend/src/users/users.service.ts`

Add 4 new methods:
```typescript
async updateProfilePicture(userId: number, url: string): Promise<User>
async resetPassword(userId: number, oldPassword: string, newPassword: string): Promise<void>
async deleteAccount(userId: number, password: string): Promise<void>
async updateActiveStatus(userId: number, activeStatus: boolean): Promise<User>
```

**resetPassword logic:**
- Verify old password with `bcrypt.compare()`
- Hash new password with `bcrypt.hash(password, 10)`
- Update user

**deleteAccount logic:**
- Verify password
- Delete user (TypeORM cascades: messages, conversations, friend_requests via `onDelete: 'CASCADE'`)

### 1.4 Create UsersController
**File:** `backend/src/users/users.controller.ts` (NEW)

4 new endpoints:
```typescript
@Post('/profile-picture')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FileInterceptor('file'))
@Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10/hour
async uploadProfilePicture(@UploadedFile() file, @Request() req)

@Post('/auth/reset-password')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3/hour
async resetPassword(@Body() dto: ResetPasswordDto, @Request() req)

@Delete('/account')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 1, ttl: 3600000 } }) // 1/hour
async deleteAccount(@Body() dto: DeleteAccountDto, @Request() req)

@Patch('/active-status')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 20, ttl: 3600000 } })
async updateActiveStatus(@Body() dto: UpdateActiveStatusDto, @Request() req)
```

### 1.5 File Upload Setup
**Install:** `npm install --save multer @types/multer`

**Create directory:** `backend/uploads/profiles/`

**File validation:**
- MIME type: image/jpeg, image/png only
- Max size: 5MB
- Filename: `user-{userId}-{timestamp}.{ext}`
- Delete old file when uploading new one (upload first, then delete)

**Static file serving in main.ts:**
```typescript
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads/',
});
```

**Docker volume mount in docker-compose.yml:**
```yaml
backend:
  volumes:
    - ./backend/uploads:/app/uploads
```

### 1.6 JWT Auth Guard
**File:** `backend/src/auth/guards/jwt-auth.guard.ts` (NEW)
**File:** `backend/src/auth/strategies/jwt.strategy.ts` (NEW)

Implement Passport JWT strategy for REST endpoint authentication.

### 1.7 Update JWT Payload
**File:** `backend/src/auth/auth.service.ts`

Include profilePictureUrl in JWT:
```typescript
const payload = {
  email: user.email,
  sub: user.id,
  username: user.username,
  profilePictureUrl: user.profilePictureUrl // NEW
};
```

### 1.8 WebSocket Events for Active Status
**File:** `backend/src/chat/dto/chat.dto.ts`

Add to existing file:
```typescript
export class UpdateActiveStatusDto {
  @IsBoolean() activeStatus: boolean;
}
```

**File:** `backend/src/chat/services/chat-friend-request.service.ts`

Add new handler method:
```typescript
async handleUpdateActiveStatus(client, data, server, onlineUsers) {
  // Update user.activeStatus in database
  // Emit 'userStatusChanged' event to all friends with {userId, activeStatus}
  // Get friends via friendsService.getFriends()
  // For each friend, find socketId in onlineUsers Map, emit event
}
```

**File:** `backend/src/chat/chat.gateway.ts`

Add delegation:
```typescript
@SubscribeMessage('updateActiveStatus')
async handleUpdateActiveStatus(@ConnectedSocket() client, @MessageBody() data) {
  return this.chatFriendRequestService.handleUpdateActiveStatus(
    client, data, this.server, this.onlineUsers
  );
}
```

**Server→Client event:** `userStatusChanged {userId, activeStatus}`

### 1.9 Update UserMapper
**File:** `backend/src/chat/mappers/user.mapper.ts`

Update `toPayload()`:
```typescript
static toPayload(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profilePictureUrl: user.profilePictureUrl, // NEW
    activeStatus: user.activeStatus, // NEW (for friends list)
  };
}
```

### 1.10 Update UsersModule
**File:** `backend/src/users/users.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule, // For auth guards
    MulterModule.register({ dest: './uploads/profiles' }),
  ],
  controllers: [UsersController], // NEW
  providers: [UsersService],
  exports: [UsersService],
})
```

---

## Phase 2: Frontend Foundation

### 2.1 Add Dependencies
**File:** `frontend/pubspec.yaml`

```yaml
dependencies:
  image_picker: ^1.1.2        # Profile picture upload
  device_info_plus: ^11.2.0   # Device name detection
```

Run: `flutter pub get`

### 2.2 Update UserModel
**File:** `frontend/lib/models/user_model.dart`

Add fields:
```dart
final String? profilePictureUrl;
final bool? activeStatus;

// Update constructor and fromJson
```

### 2.3 Update ApiService
**File:** `frontend/lib/services/api_service.dart`

Add 4 methods:
```dart
Future<String> uploadProfilePicture(String token, File imageFile)
Future<void> resetPassword(String token, String oldPassword, String newPassword)
Future<void> deleteAccount(String token, String password)
Future<void> updateActiveStatus(String token, bool activeStatus)
```

### 2.4 Create SettingsProvider
**File:** `frontend/lib/providers/settings_provider.dart` (NEW)

```dart
class SettingsProvider extends ChangeNotifier {
  String _darkModePreference = 'system'; // 'system', 'light', 'dark'

  ThemeMode get themeMode {
    switch (_darkModePreference) {
      case 'light': return ThemeMode.light;
      case 'dark': return ThemeMode.dark;
      default: return ThemeMode.system;
    }
  }

  // Load/save via SharedPreferences key: 'dark_mode_preference'
  Future<void> setDarkModePreference(String preference)
}
```

### 2.5 Update AuthProvider
**File:** `frontend/lib/providers/auth_provider.dart`

Add methods:
```dart
Future<void> updateProfilePicture(File imageFile)
Future<void> resetPassword(String oldPassword, String newPassword)
Future<bool> deleteAccount(String password)
```

Update `_loadSavedToken()` to decode profilePictureUrl from JWT.

**IMPORTANT:** Change logout to NOT clear dark mode preference:
```dart
// OLD: await prefs.clear();
// NEW:
await prefs.remove('jwt_token');
```

### 2.6 Update ChatProvider
**File:** `frontend/lib/providers/chat_provider.dart`

Add listener in `connect()`:
```dart
onUserStatusChanged: (data) {
  final userId = data['userId'];
  final activeStatus = data['activeStatus'];
  // Update friends list to reflect new status
  _friends = _friends.map((f) {
    if (f.id == userId) {
      return UserModel(..., activeStatus: activeStatus);
    }
    return f;
  }).toList();
  notifyListeners();
}
```

### 2.7 Update SocketService
**File:** `frontend/lib/services/socket_service.dart`

Add method:
```dart
void updateActiveStatus(bool activeStatus) {
  _socket?.emit('updateActiveStatus', {'activeStatus': activeStatus});
}
```

Add listener:
```dart
_socket!.on('userStatusChanged', onUserStatusChanged);
```

### 2.8 Update AvatarCircle Widget
**File:** `frontend/lib/widgets/avatar_circle.dart`

Add support for:
- Profile picture via `NetworkImage('${baseUrl}$profilePictureUrl')`
- Fallback to existing gradient avatar if no URL or load error
- Optional online indicator (green/grey dot in bottom-right corner)

Parameters:
```dart
final String? profilePictureUrl;
final bool showOnlineIndicator;
final bool isOnline;
```

### 2.9 Create Dialogs
**File:** `frontend/lib/widgets/dialogs/reset_password_dialog.dart` (NEW)
- Two TextFormFields: old password, new password (obscureText: true)
- Validation: min 8 chars, uppercase + lowercase + number
- Cancel and Reset buttons
- Error handling with SnackBar

**File:** `frontend/lib/widgets/dialogs/delete_account_dialog.dart` (NEW)
- Warning text: "This action is permanent and cannot be undone"
- Password TextFormField (confirmation)
- Cancel and Delete (red) buttons

**File:** `frontend/lib/widgets/dialogs/profile_picture_dialog.dart` (NEW)
- Two options: "Take Photo" (camera) and "Choose from Gallery"
- Uses `ImagePicker` package
- Returns File to caller

---

## Phase 3: Settings Screen Redesign

### 3.1 Complete Rewrite
**File:** `frontend/lib/screens/settings_screen.dart`

**Structure:**

**1. Header Section (Column):**
```dart
- SizedBox(height: 24)
- Stack:
  - AvatarCircle(radius: 60, profilePictureUrl: auth.currentUser?.profilePictureUrl)
  - Positioned camera badge (bottom-right):
    - Container(36x36, purple circle, camera icon)
    - GestureDetector onTap: _showProfilePictureDialog
- SizedBox(height: 16)
- Username text (fontSize: 20, bold)
- Email text (fontSize: 14, muted color)
- SizedBox(height: 32)
```

**2. Settings Tiles (6 items):**
Use helper method `_buildSettingsTile()`:

```dart
_buildSettingsTile(
  icon: Icons.circle,
  title: 'Active Status',
  trailing: Switch(value: _activeStatus, onChanged: _updateActiveStatus),
)

_buildSettingsTile(
  icon: Icons.dark_mode,
  title: 'Dark Mode',
  trailing: DropdownButton<String>(
    value: settings.darkModePreference,
    items: ['system', 'light', 'dark'],
    onChanged: settings.setDarkModePreference,
  ),
)

_buildSettingsTile(
  icon: Icons.security,
  title: 'Privacy and Safety',
  trailing: Icon(Icons.chevron_right),
  onTap: () => showSnackBar('Coming soon'),
)

_buildSettingsTile(
  icon: Icons.devices,
  title: 'Devices',
  subtitle: _deviceName ?? 'Loading...',
  trailing: Icon(Icons.chevron_right),
  onTap: null, // Read-only
)

_buildSettingsTile(
  icon: Icons.lock_reset,
  title: 'Reset Password',
  trailing: Icon(Icons.chevron_right),
  onTap: _showResetPasswordDialog,
)

_buildSettingsTile(
  icon: Icons.delete_forever,
  title: 'Delete Account',
  trailing: Icon(Icons.chevron_right),
  onTap: _showDeleteAccountDialog,
  textColor: Color(0xFFFF6666), // Red warning
)
```

**3. Helper Method:**
```dart
Widget _buildSettingsTile({
  required IconData icon,
  required String title,
  String? subtitle,
  Widget? trailing,
  VoidCallback? onTap,
  Color? textColor,
}) {
  return Container(
    margin: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    decoration: BoxDecoration(
      color: RpgTheme.boxBg,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: RpgTheme.border, width: 1.5),
    ),
    child: ListTile(
      leading: Icon(icon, color: RpgTheme.purple, size: 24),
      title: Text(title, style: RpgTheme.bodyFont(...)),
      subtitle: subtitle != null ? Text(subtitle, ...) : null,
      trailing: trailing,
      onTap: onTap,
    ),
  );
}
```

**4. Device Name Detection:**
```dart
String? _deviceName;

@override
void initState() {
  super.initState();
  _loadDeviceName();
}

Future<void> _loadDeviceName() async {
  final deviceInfo = DeviceInfoPlugin();
  String name = 'Unknown Device';

  if (Platform.isAndroid) {
    final androidInfo = await deviceInfo.androidInfo;
    name = '${androidInfo.manufacturer} ${androidInfo.model}';
  } else if (Platform.isIOS) {
    final iosInfo = await deviceInfo.iosInfo;
    name = '${iosInfo.name} (${iosInfo.systemName})';
  } else if (Platform.isWindows) {
    name = (await deviceInfo.windowsInfo).computerName;
  } else if (kIsWeb) {
    name = 'Web Browser';
  }

  setState(() => _deviceName = name);
}
```

**5. Dialog Handlers:**
```dart
Future<void> _showProfilePictureDialog() async {
  final source = await showDialog<ImageSource>(...);
  if (source == null) return;

  final picker = ImagePicker();
  final image = await picker.pickImage(source: source);
  if (image == null) return;

  try {
    await auth.updateProfilePicture(File(image.path));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Profile picture updated')),
    );
  } catch (e) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Upload failed: $e')),
    );
  }
}

Future<void> _showResetPasswordDialog() async {
  // Show dialog, get old/new passwords, call auth.resetPassword()
}

Future<void> _showDeleteAccountDialog() async {
  // Show confirmation dialog, get password, call auth.deleteAccount()
}

Future<void> _updateActiveStatus(bool value) async {
  setState(() => _activeStatus = value);
  try {
    await chat.socket.updateActiveStatus(value);
  } catch (e) {
    setState(() => _activeStatus = !value); // Revert on error
    ScaffoldMessenger.of(context).showSnackBar(...);
  }
}
```

**6. Logout Button:**
Keep existing logout button at bottom (no changes).

### 3.2 Update main.dart
**File:** `frontend/lib/main.dart`

Add SettingsProvider to MultiProvider:
```dart
ChangeNotifierProvider(create: (_) => SettingsProvider()),
```

Update MaterialApp:
```dart
final settings = context.watch<SettingsProvider>();

return MaterialApp(
  theme: RpgTheme.themeData,
  darkTheme: RpgTheme.themeData, // Same theme (RPG is dark)
  themeMode: settings.themeMode,  // System/Light/Dark
  ...
);
```

---

## Implementation Sequence

### Day 1: Backend Core
1. Update User entity (2 columns)
2. Create DTOs (user.dto.ts)
3. Update UsersService (4 methods)
4. Create UsersController (4 endpoints)
5. Create JWT auth guard and strategy
6. Update UsersModule configuration
7. Test endpoints with curl/Postman

### Day 2: Backend File Upload & WebSocket
1. Install multer, create uploads directory
2. Add static file serving in main.ts
3. Implement profile picture upload endpoint
4. Update JWT payload (auth.service.ts)
5. Add WebSocket event for active status
6. Update UserMapper
7. Update docker-compose.yml volume mount
8. Test file upload and WebSocket event

### Day 3: Frontend Models & Providers
1. Add dependencies (image_picker, device_info_plus)
2. Update UserModel (2 fields)
3. Update ApiService (4 methods)
4. Update SocketService (emit + listener)
5. Create SettingsProvider
6. Update AuthProvider (3 methods, fix logout)
7. Update ChatProvider (userStatusChanged listener)
8. Update main.dart (add provider)

### Day 4: Frontend Widgets & UI
1. Update AvatarCircle (profile pictures + online indicator)
2. Create 3 dialogs (reset password, delete account, profile picture)
3. Redesign settings_screen.dart (header + 6 tiles)
4. Implement device name detection
5. Wire up all tap handlers
6. Test responsive design (<600px, ≥600px)

### Day 5: Testing & Polish
1. Test profile picture upload end-to-end
2. Test password reset (verify old password check)
3. Test account deletion (verify cascades)
4. Test active status toggle (verify WebSocket)
5. Test dark mode persistence
6. Test on web, Android (if available)
7. Add loading states and error handling
8. Update CLAUDE.md

---

## Critical Files to Modify

### Backend (10 files)
1. `backend/src/users/user.entity.ts` — Add 2 columns
2. `backend/src/users/users.service.ts` — Add 4 methods
3. `backend/src/users/users.module.ts` — Add controller, imports
4. `backend/src/users/users.controller.ts` — NEW, 4 endpoints
5. `backend/src/users/dto/user.dto.ts` — NEW, 3 DTOs
6. `backend/src/auth/auth.service.ts` — Update JWT payload
7. `backend/src/auth/guards/jwt-auth.guard.ts` — NEW
8. `backend/src/auth/strategies/jwt.strategy.ts` — NEW
9. `backend/src/chat/chat.gateway.ts` — Add 1 event
10. `backend/src/chat/services/chat-friend-request.service.ts` — Add handler
11. `backend/src/chat/dto/chat.dto.ts` — Add DTO
12. `backend/src/chat/mappers/user.mapper.ts` — Update toPayload
13. `backend/src/main.ts` — Add static file serving
14. `docker-compose.yml` — Add volume mount

### Frontend (12 files)
1. `frontend/lib/models/user_model.dart` — Add 2 fields
2. `frontend/lib/providers/auth_provider.dart` — Add 3 methods, fix logout
3. `frontend/lib/providers/chat_provider.dart` — Add listener
4. `frontend/lib/providers/settings_provider.dart` — NEW
5. `frontend/lib/services/api_service.dart` — Add 4 methods
6. `frontend/lib/services/socket_service.dart` — Add emit + listener
7. `frontend/lib/screens/settings_screen.dart` — Complete rewrite
8. `frontend/lib/widgets/avatar_circle.dart` — Add profile picture support
9. `frontend/lib/widgets/dialogs/reset_password_dialog.dart` — NEW
10. `frontend/lib/widgets/dialogs/delete_account_dialog.dart` — NEW
11. `frontend/lib/widgets/dialogs/profile_picture_dialog.dart` — NEW
12. `frontend/lib/main.dart` — Add provider
13. `frontend/pubspec.yaml` — Add 2 dependencies

---

## Verification Steps

### Backend Verification
```bash
# 1. Check database schema
docker exec -it mvp-chat-app-db-1 psql -U postgres -d chatdb -c "\d users"
# Should show: profile_picture_url (varchar), active_status (boolean)

# 2. Test profile picture upload
curl -X POST http://localhost:3000/users/profile-picture \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@test-image.jpg"
# Should return: {"profilePictureUrl": "/uploads/profiles/user-1-timestamp.jpg"}

# 3. Test password reset
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword": "OldPass123", "newPassword": "NewPass456"}'
# Should return: {"message": "Password updated successfully"}

# 4. Test active status WebSocket
# Connect to ws://localhost:3000 with token, emit 'updateActiveStatus'
# Verify 'userStatusChanged' event sent to friends

# 5. Check uploaded file exists
ls backend/uploads/profiles/
# Should show uploaded image file
```

### Frontend Verification
```bash
# 1. Run app
cd frontend && flutter run -d chrome

# 2. Navigate to Settings
# Open app → Click Settings icon (bottom nav)

# 3. Verify header
# Should show: large avatar, username, email, camera badge

# 4. Verify tiles
# Should show 6 tiles: Active Status, Dark Mode, Privacy, Devices, Reset Password, Delete Account

# 5. Test profile picture upload
# Click camera badge → Select image → Verify avatar updates

# 6. Test dark mode toggle
# Change dropdown → Verify UI updates → Refresh page → Verify persisted

# 7. Test device name
# Should show device name (e.g., "Google Pixel 6", "Web Browser")

# 8. Test password reset
# Click Reset Password → Enter old/new → Verify success message

# 9. Test account deletion
# Click Delete Account → Enter password → Verify logout and redirect to login

# 10. Test active status
# Toggle switch → Verify friend sees status change in friends list
```

### End-to-End Test Flow
1. User A logs in → Uploads profile picture → Toggles active status OFF
2. User B logs in → Opens friends list → Sees User A's profile picture and offline status
3. User A toggles active status ON → User B sees online indicator (green dot)
4. User A changes dark mode to Dark → Restarts app → Dark mode persisted
5. User A resets password → Logs out → Logs in with new password
6. User A deletes account → Logs out → Cannot log in again → User B's conversations with A are deleted

---

## Gotchas & Edge Cases

### Backend
1. **File upload permissions:** Add volume mount in docker-compose.yml
2. **Old file deletion:** Upload new file FIRST, then delete old (prevent data loss)
3. **Cascade deletion:** Use TypeORM cascade `onDelete: 'CASCADE'` for performance
4. **JWT size:** Monitor payload size with profilePictureUrl (should be <2KB)
5. **Active status sync:** Emit to ALL sockets for same userId (multi-device support)

### Frontend
1. **Image picker permissions:** Add to AndroidManifest.xml and Info.plist
2. **Image size:** Compress before upload (target 500KB max)
3. **SharedPreferences logout:** Use `prefs.remove('jwt_token')` NOT `prefs.clear()`
4. **Profile picture caching:** Append timestamp query param to bust cache
5. **Device name on web:** Will show "Web Browser" (acceptable)
6. **Active status state:** Store in AuthProvider, not just SettingsScreen state
7. **Avatar online indicator:** Careful Stack positioning to prevent overlap

---

## CLAUDE.md Updates

After implementation, update these sections:

**Database Schema:**
```markdown
users
  ├─ profilePictureUrl (nullable, relative path) ← NEW
  ├─ activeStatus (boolean, default true) ← NEW
```

**REST Endpoints:**
```markdown
POST /users/profile-picture (multipart)
POST /auth/reset-password
DELETE /users/account
PATCH /users/active-status
```

**WebSocket Events:**
```markdown
Client→Server: updateActiveStatus {activeStatus}
Server→Client: userStatusChanged {userId, activeStatus}
```

**Project Status:**
```markdown
✅ Settings Screen Redesign (2026-01-XX)
```

**Dependencies:**
```markdown
Backend: multer, @types/multer
Frontend: image_picker, device_info_plus
```

---

## Success Criteria

- [ ] Profile picture uploads successfully and displays in avatar
- [ ] Fallback to gradient AvatarCircle if no photo
- [ ] Camera badge visible and functional
- [ ] Active status toggle updates backend and notifies friends via WebSocket
- [ ] Dark mode persists after app restart
- [ ] Device name displays correctly (platform-specific)
- [ ] Password reset validates old password and updates successfully
- [ ] Account deletion requires confirmation and cascades deletes
- [ ] All settings tiles styled with RPG theme (purple, gold, borders)
- [ ] Responsive design works on mobile (<600px) and desktop (≥600px)
- [ ] No regressions in existing functionality (logout, navigation, chat)
