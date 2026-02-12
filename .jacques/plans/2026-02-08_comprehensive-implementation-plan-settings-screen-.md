Perfect! Now I have a comprehensive understanding of the codebase. Let me create a detailed implementation plan for the settings screen redesign.

# Comprehensive Implementation Plan: Settings Screen Redesign

## Overview
This plan details the complete redesign of the settings screen with profile picture upload, active status, dark mode, privacy settings, device info, password reset, and account deletion features. The implementation follows the existing project patterns (Provider, DTOs, Mappers, Service classes) and maintains the RPG theme.

---

## 1. BACKEND IMPLEMENTATION

### 1.1 Database Schema Changes (User Entity)

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\user.entity.ts`

**Changes Required:**
- Add `profilePictureUrl` column (nullable string, stores relative path like `/uploads/profiles/user-123-timestamp.jpg`)
- Add `activeStatus` column (boolean, default true, controls online/offline visibility)
- TypeORM will auto-migrate with `synchronize: true` in development

**Migration Strategy:**
- Existing users will have `profilePictureUrl = null` (fallback to AvatarCircle gradient)
- Existing users will have `activeStatus = true` (default behavior)

### 1.2 File Upload Infrastructure

**New Directory:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\uploads\profiles`

**Create new module:**
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\upload\upload.module.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\upload\upload.service.ts`
- `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\upload\upload.controller.ts` (NOT needed - will integrate into users module)

**Dependencies to install:**
```bash
npm install --save multer @types/multer
```

**File Upload Service Responsibilities:**
- Validate file type (jpg, jpeg, png only)
- Validate file size (max 5MB)
- Generate unique filename: `user-{userId}-{timestamp}.{ext}`
- Delete old profile picture when uploading new one
- Serve static files via Express static middleware

**Configuration in main.ts:**
```typescript
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads/',
});
```

### 1.3 New REST Endpoints

**File:** Create `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\users.controller.ts` (NEW)

**Endpoints:**

1. **POST /users/profile-picture** (multipart/form-data)
   - DTO: `UpdateProfilePictureDto` (uses `@UseInterceptors(FileInterceptor('file'))`)
   - Auth: JWT required via `@UseGuards(JwtAuthGuard)`
   - Throttle: 10 requests/hour
   - Returns: `{profilePictureUrl: string}`
   - Logic: Save file, delete old file, update user.profilePictureUrl, return new URL

2. **POST /auth/reset-password**
   - DTO: `ResetPasswordDto {oldPassword, newPassword}`
   - Auth: JWT required
   - Throttle: 3 requests/hour
   - Validates: old password matches, new password meets strength requirements
   - Returns: `{message: 'Password updated successfully'}`

3. **DELETE /users/account**
   - DTO: `DeleteAccountDto {password}` (confirmation)
   - Auth: JWT required
   - Throttle: 1 request/hour
   - Cascades: Delete all user's messages, conversations, friend_requests (TypeORM cascade)
   - Returns: `{message: 'Account deleted successfully'}`

4. **PATCH /users/active-status**
   - DTO: `UpdateActiveStatusDto {activeStatus: boolean}`
   - Auth: JWT required
   - Throttle: 20 requests/hour
   - Returns: `{activeStatus: boolean}`

### 1.4 DTOs to Create

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\dto\user.dto.ts` (NEW)

```typescript
export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  oldPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  newPassword: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password: string; // confirmation
}

export class UpdateActiveStatusDto {
  @IsBoolean()
  activeStatus: boolean;
}
```

### 1.5 Users Service Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\users.service.ts`

**New Methods:**
- `updateProfilePicture(userId: number, url: string): Promise<User>`
- `resetPassword(userId: number, oldPassword: string, newPassword: string): Promise<void>`
  - Verify old password with `bcrypt.compare()`
  - Hash new password with `bcrypt.hash(password, 10)`
  - Update user
- `deleteAccount(userId: number, password: string): Promise<void>`
  - Verify password
  - Delete user (cascades via TypeORM)
- `updateActiveStatus(userId: number, activeStatus: boolean): Promise<User>`

### 1.6 WebSocket Events for Active Status

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\dto\chat.dto.ts`

**New DTO:**
```typescript
export class UpdateActiveStatusDto {
  @IsBoolean()
  activeStatus: boolean;
}
```

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\services\chat-friend-request.service.ts`

**New Handler:** `handleUpdateActiveStatus(client, data, server, onlineUsers)`
- Update user.activeStatus in database
- Emit `userStatusChanged` event to all friends with `{userId, activeStatus}`

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\chat.gateway.ts`

**New Event:**
```typescript
@SubscribeMessage('updateActiveStatus')
async handleUpdateActiveStatus(@ConnectedSocket() client, @MessageBody() data) {
  return this.chatFriendRequestService.handleUpdateActiveStatus(
    client, data, this.server, this.onlineUsers
  );
}
```

**Server→Client Event:** `userStatusChanged {userId, activeStatus}`

### 1.7 Mapper Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\chat\mappers\user.mapper.ts`

**Update `toPayload` method:**
```typescript
static toPayload(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    profilePictureUrl: user.profilePictureUrl, // NEW
    activeStatus: user.activeStatus, // NEW (optional, for friends list)
  };
}
```

### 1.8 Auth Service JWT Payload Update

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\auth.service.ts`

**Update `login()` method to include profilePictureUrl in JWT:**
```typescript
const payload = { 
  email: user.email, 
  sub: user.id, 
  username: user.username,
  profilePictureUrl: user.profilePictureUrl // NEW
};
```

### 1.9 Guards and Security

**New File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\guards\jwt-auth.guard.ts`

**Implement `JwtAuthGuard`:**
- Extends `@nestjs/passport` `AuthGuard('jwt')`
- Used for all authenticated REST endpoints

**Strategy File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\strategies\jwt.strategy.ts`

**Configure Passport JWT Strategy:**
- Extract JWT from Authorization header
- Validate token
- Attach user to request object

### 1.10 Module Configuration Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\users.module.ts`

**Add:**
- `UsersController` to exports
- Import `JwtModule` for auth guards
- Import `MulterModule.register()` for file uploads

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\app.module.ts`

**Add:**
- Static file serving configuration in main.ts (see 1.2)
- Ensure UsersModule exports UsersService for ChatModule

---

## 2. FRONTEND IMPLEMENTATION

### 2.1 Package Dependencies

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\pubspec.yaml`

**Add dependencies:**
```yaml
dependencies:
  image_picker: ^1.1.2        # Profile picture upload
  device_info_plus: ^11.2.0   # Device name detection
```

Run: `flutter pub get`

### 2.2 Model Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\models\user_model.dart`

**Add fields:**
```dart
class UserModel {
  final int id;
  final String email;
  final String? username;
  final String? profilePictureUrl; // NEW
  final bool? activeStatus;        // NEW (optional, from friends list)

  UserModel({
    required this.id,
    required this.email,
    this.username,
    this.profilePictureUrl,
    this.activeStatus,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      email: json['email'] as String,
      username: json['username'] as String?,
      profilePictureUrl: json['profilePictureUrl'] as String?,
      activeStatus: json['activeStatus'] as bool?,
    );
  }
}
```

### 2.3 API Service Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\api_service.dart`

**Add methods:**
```dart
Future<String> uploadProfilePicture(String token, File imageFile) async {
  final request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/users/profile-picture'),
  );
  request.headers['Authorization'] = 'Bearer $token';
  request.files.add(await http.MultipartFile.fromPath('file', imageFile.path));
  
  final streamedResponse = await request.send();
  final response = await http.Response.fromStream(streamedResponse);
  final data = jsonDecode(response.body);
  
  if (response.statusCode != 200) {
    throw Exception(data['message'] ?? 'Upload failed');
  }
  return data['profilePictureUrl'] as String;
}

Future<void> resetPassword(String token, String oldPassword, String newPassword) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/reset-password'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({'oldPassword': oldPassword, 'newPassword': newPassword}),
  );
  
  final data = jsonDecode(response.body);
  if (response.statusCode != 200) {
    throw Exception(data['message'] ?? 'Password reset failed');
  }
}

Future<void> deleteAccount(String token, String password) async {
  final response = await http.delete(
    Uri.parse('$baseUrl/users/account'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({'password': password}),
  );
  
  final data = jsonDecode(response.body);
  if (response.statusCode != 200) {
    throw Exception(data['message'] ?? 'Account deletion failed');
  }
}

Future<void> updateActiveStatus(String token, bool activeStatus) async {
  final response = await http.patch(
    Uri.parse('$baseUrl/users/active-status'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({'activeStatus': activeStatus}),
  );
  
  final data = jsonDecode(response.body);
  if (response.statusCode != 200) {
    throw Exception(data['message'] ?? 'Status update failed');
  }
}
```

### 2.4 New Provider: SettingsProvider

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\settings_provider.dart` (NEW)

**Responsibilities:**
- Manage dark mode state (3 states: system/light/dark)
- Persist dark mode preference via SharedPreferences (key: `dark_mode_preference`)
- Load preference on initialization
- Expose `ThemeMode get themeMode`

**Implementation:**
```dart
class SettingsProvider extends ChangeNotifier {
  String _darkModePreference = 'system'; // 'system', 'light', 'dark'
  
  String get darkModePreference => _darkModePreference;
  
  ThemeMode get themeMode {
    switch (_darkModePreference) {
      case 'light': return ThemeMode.light;
      case 'dark': return ThemeMode.dark;
      default: return ThemeMode.system;
    }
  }
  
  SettingsProvider() {
    _loadPreference();
  }
  
  Future<void> _loadPreference() async {
    final prefs = await SharedPreferences.getInstance();
    _darkModePreference = prefs.getString('dark_mode_preference') ?? 'system';
    notifyListeners();
  }
  
  Future<void> setDarkModePreference(String preference) async {
    _darkModePreference = preference;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('dark_mode_preference', preference);
    notifyListeners();
  }
}
```

### 2.5 AuthProvider Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\auth_provider.dart`

**Add methods:**
```dart
Future<void> updateProfilePicture(File imageFile) async {
  if (_token == null) return;
  try {
    final newUrl = await _api.uploadProfilePicture(_token!, imageFile);
    _currentUser = UserModel(
      id: _currentUser!.id,
      email: _currentUser!.email,
      username: _currentUser!.username,
      profilePictureUrl: newUrl,
    );
    notifyListeners();
  } catch (e) {
    throw Exception(e.toString());
  }
}

Future<void> resetPassword(String oldPassword, String newPassword) async {
  if (_token == null) return;
  await _api.resetPassword(_token!, oldPassword, newPassword);
}

Future<bool> deleteAccount(String password) async {
  if (_token == null) return false;
  try {
    await _api.deleteAccount(_token!, password);
    await logout(); // Clear session
    return true;
  } catch (e) {
    throw Exception(e.toString());
  }
}
```

**Update `_loadSavedToken()` to decode profilePictureUrl:**
```dart
_currentUser = UserModel(
  id: payload['sub'] as int,
  email: payload['email'] as String,
  username: payload['username'] as String?,
  profilePictureUrl: payload['profilePictureUrl'] as String?, // NEW
);
```

### 2.6 ChatProvider Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\chat_provider.dart`

**Add listener in `connect()` method:**
```dart
onUserStatusChanged: (data) {
  final userId = (data as Map<String, dynamic>)['userId'] as int;
  final activeStatus = data['activeStatus'] as bool;
  
  // Update friends list
  _friends = _friends.map((f) {
    if (f.id == userId) {
      return UserModel(
        id: f.id,
        email: f.email,
        username: f.username,
        profilePictureUrl: f.profilePictureUrl,
        activeStatus: activeStatus,
      );
    }
    return f;
  }).toList();
  
  notifyListeners();
},
```

### 2.7 SocketService Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\socket_service.dart`

**Add method:**
```dart
void updateActiveStatus(bool activeStatus) {
  _socket?.emit('updateActiveStatus', {'activeStatus': activeStatus});
}
```

**Add listener registration in `connect()`:**
```dart
_socket!.on('userStatusChanged', onUserStatusChanged);
```

### 2.8 Enhanced AvatarCircle Widget

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\avatar_circle.dart`

**Update to support profile pictures:**
```dart
class AvatarCircle extends StatelessWidget {
  final String email;
  final String? profilePictureUrl;
  final double radius;
  final bool showOnlineIndicator; // NEW
  final bool isOnline;            // NEW

  const AvatarCircle({
    super.key,
    required this.email,
    this.profilePictureUrl,
    this.radius = 22,
    this.showOnlineIndicator = false,
    this.isOnline = false,
  });

  @override
  Widget build(BuildContext context) {
    final letter = email.isNotEmpty ? email[0].toUpperCase() : '?';
    
    Widget avatar;
    if (profilePictureUrl != null && profilePictureUrl!.isNotEmpty) {
      avatar = CircleAvatar(
        radius: radius,
        backgroundImage: NetworkImage('${AppConfig.baseUrl}$profilePictureUrl'),
        onBackgroundImageError: (_, __) {}, // Fallback to gradient
        child: Container(), // Placeholder during load
      );
    } else {
      // Existing gradient avatar
      avatar = Container(
        width: radius * 2,
        height: radius * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [RpgTheme.purple, RpgTheme.gold],
          ),
        ),
        alignment: Alignment.center,
        child: Text(letter, style: RpgTheme.bodyFont(...)),
      );
    }
    
    if (showOnlineIndicator) {
      return Stack(
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: radius * 0.4,
              height: radius * 0.4,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOnline ? Colors.green : Colors.grey,
                border: Border.all(color: RpgTheme.background, width: 2),
              ),
            ),
          ),
        ],
      );
    }
    
    return avatar;
  }
}
```

### 2.9 New Dialogs

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\dialogs\reset_password_dialog.dart` (NEW)

**Implementation:**
- Two TextFormFields: old password, new password (obscureText: true)
- Validation: min 8 chars, uppercase + lowercase + number
- Cancel and Reset buttons
- Error handling with SnackBar

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\dialogs\delete_account_dialog.dart` (NEW)

**Implementation:**
- Warning text: "This action is permanent and cannot be undone"
- Password TextFormField (confirmation)
- Cancel (TextButton) and Delete (ElevatedButton with errorColor) buttons
- Error handling

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\dialogs\profile_picture_dialog.dart` (NEW)

**Implementation:**
- Two options: "Take Photo" (camera) and "Choose from Gallery" (gallery)
- Uses `image_picker` package
- Returns selected File to caller

### 2.10 Settings Screen Redesign

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\settings_screen.dart` (COMPLETE REWRITE)

**Structure:**

**1. Header Section** (inside ListView, top section):
```dart
Column(
  children: [
    SizedBox(height: 24),
    // Large avatar with camera badge
    Stack(
      children: [
        AvatarCircle(
          email: auth.currentUser?.email ?? '',
          profilePictureUrl: auth.currentUser?.profilePictureUrl,
          radius: 60, // 120px diameter
        ),
        Positioned(
          right: 0,
          bottom: 0,
          child: GestureDetector(
            onTap: _showProfilePictureDialog,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: RpgTheme.purple,
                shape: BoxShape.circle,
                border: Border.all(color: RpgTheme.background, width: 2),
              ),
              child: Icon(Icons.camera_alt, color: Colors.white, size: 20),
            ),
          ),
        ),
      ],
    ),
    SizedBox(height: 16),
    Text(
      auth.currentUser?.username ?? auth.currentUser?.email ?? '',
      style: RpgTheme.bodyFont(fontSize: 20, fontWeight: FontWeight.w700),
    ),
    SizedBox(height: 4),
    Text(
      auth.currentUser?.email ?? '',
      style: RpgTheme.bodyFont(fontSize: 14, color: RpgTheme.mutedText),
    ),
    SizedBox(height: 32),
  ],
)
```

**2. Settings Tiles** (full-width ListTiles in Container):
```dart
_buildSettingsTile(
  icon: Icons.circle,
  title: 'Active Status',
  trailing: Switch(
    value: _activeStatus,
    onChanged: (value) async {
      setState(() => _activeStatus = value);
      await _updateActiveStatus(value);
    },
  ),
),
_buildSettingsTile(
  icon: Icons.dark_mode,
  title: 'Dark Mode',
  trailing: DropdownButton<String>(
    value: settings.darkModePreference,
    items: [
      DropdownMenuItem(value: 'system', child: Text('System')),
      DropdownMenuItem(value: 'light', child: Text('Light')),
      DropdownMenuItem(value: 'dark', child: Text('Dark')),
    ],
    onChanged: (value) {
      if (value != null) settings.setDarkModePreference(value);
    },
  ),
),
_buildSettingsTile(
  icon: Icons.security,
  title: 'Privacy and Safety',
  trailing: Icon(Icons.chevron_right),
  onTap: () {
    // Placeholder - no functionality yet
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Coming soon')),
    );
  },
),
_buildSettingsTile(
  icon: Icons.devices,
  title: 'Devices',
  subtitle: _deviceName ?? 'Loading...',
  trailing: Icon(Icons.chevron_right),
  onTap: null, // Read-only
),
_buildSettingsTile(
  icon: Icons.lock_reset,
  title: 'Reset Password',
  trailing: Icon(Icons.chevron_right),
  onTap: _showResetPasswordDialog,
),
_buildSettingsTile(
  icon: Icons.delete_forever,
  title: 'Delete Account',
  trailing: Icon(Icons.chevron_right),
  onTap: _showDeleteAccountDialog,
  textColor: RpgTheme.errorColor, // Red warning
),
```

**3. Logout Button** (at bottom):
```dart
Padding(
  padding: EdgeInsets.all(16),
  child: ElevatedButton(
    onPressed: () {
      chat.disconnect();
      auth.logout();
      Navigator.pop(context);
    },
    style: ElevatedButton.styleFrom(
      backgroundColor: RpgTheme.logoutRed,
      // ... existing style
    ),
    child: Row(...), // Existing logout button UI
  ),
)
```

**4. Helper Method:**
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
      title: Text(
        title,
        style: RpgTheme.bodyFont(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: textColor ?? Colors.white,
        ),
      ),
      subtitle: subtitle != null
          ? Text(subtitle, style: RpgTheme.bodyFont(fontSize: 12, color: RpgTheme.mutedText))
          : null,
      trailing: trailing,
      onTap: onTap,
    ),
  );
}
```

**5. Device Name Detection:**
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
    final windowsInfo = await deviceInfo.windowsInfo;
    name = windowsInfo.computerName;
  } else if (Platform.isLinux) {
    final linuxInfo = await deviceInfo.linuxInfo;
    name = linuxInfo.name;
  } else if (Platform.isMacOS) {
    final macInfo = await deviceInfo.macOsInfo;
    name = macInfo.computerName;
  } else {
    name = 'Web Browser';
  }
  
  setState(() => _deviceName = name);
}
```

### 2.11 Main App Updates

**File:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\main.dart`

**Add SettingsProvider:**
```dart
void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()), // NEW
      ],
      child: const MyApp(),
    ),
  );
}
```

**Update MaterialApp to use SettingsProvider:**
```dart
class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>();
    
    return MaterialApp(
      title: 'MVP Chat',
      theme: RpgTheme.themeData,        // Light theme
      darkTheme: RpgTheme.themeData,    // Dark theme (same for RPG style)
      themeMode: settings.themeMode,    // System/Light/Dark from settings
      // ... rest of MaterialApp
    );
  }
}
```

---

## 3. FILE STRUCTURE SUMMARY

### New Backend Files
```
backend/src/
  users/
    users.controller.ts (NEW)
    dto/
      user.dto.ts (NEW)
  auth/
    guards/
      jwt-auth.guard.ts (NEW)
    strategies/
      jwt.strategy.ts (NEW)
  upload/ (NEW module - optional, can inline in users module)
    upload.service.ts (NEW)
backend/uploads/
  profiles/ (NEW directory for uploaded images)
```

### New Frontend Files
```
frontend/lib/
  providers/
    settings_provider.dart (NEW)
  widgets/
    dialogs/
      reset_password_dialog.dart (NEW)
      delete_account_dialog.dart (NEW)
      profile_picture_dialog.dart (NEW)
```

### Modified Backend Files
```
backend/src/
  users/
    user.entity.ts (add profilePictureUrl, activeStatus columns)
    users.service.ts (add 4 new methods)
    users.module.ts (add controller, imports)
  auth/
    auth.service.ts (include profilePictureUrl in JWT)
  chat/
    chat.gateway.ts (add updateActiveStatus event)
    dto/chat.dto.ts (add UpdateActiveStatusDto)
    services/chat-friend-request.service.ts (add handleUpdateActiveStatus)
    mappers/user.mapper.ts (add profilePictureUrl to payload)
  main.ts (add static file serving)
```

### Modified Frontend Files
```
frontend/lib/
  models/
    user_model.dart (add profilePictureUrl, activeStatus)
  providers/
    auth_provider.dart (add upload, reset, delete methods)
    chat_provider.dart (add userStatusChanged listener)
  services/
    api_service.dart (add 4 new REST methods)
    socket_service.dart (add updateActiveStatus emit)
  screens/
    settings_screen.dart (complete redesign)
  widgets/
    avatar_circle.dart (support profile pictures + online indicator)
  main.dart (add SettingsProvider, themeMode)
  pubspec.yaml (add image_picker, device_info_plus)
```

---

## 4. IMPLEMENTATION SEQUENCE

### Phase 1: Backend Foundation (Day 1)
1. Update User entity (profilePictureUrl, activeStatus columns)
2. Create DTOs (user.dto.ts, update chat.dto.ts)
3. Create JWT auth guard and strategy
4. Update UsersService with 4 new methods
5. Create UsersController with 4 endpoints
6. Update UsersModule configuration
7. Test endpoints with Postman/curl

### Phase 2: Backend File Upload (Day 1-2)
1. Install multer dependencies
2. Create uploads/profiles directory
3. Add static file serving in main.ts
4. Implement profile picture upload endpoint
5. Test file upload with Postman
6. Test old file deletion logic

### Phase 3: Backend WebSocket (Day 2)
1. Add UpdateActiveStatusDto to chat.dto.ts
2. Add handleUpdateActiveStatus to ChatFriendRequestService
3. Wire up event in ChatGateway
4. Update UserMapper to include new fields
5. Update AuthService JWT payload
6. Test with WebSocket client (Postman or Socket.IO client)

### Phase 4: Frontend Models & Services (Day 2-3)
1. Update UserModel (add fields)
2. Update ApiService (add 4 REST methods)
3. Update SocketService (add emit + listener)
4. Test API calls in isolation

### Phase 5: Frontend Providers (Day 3)
1. Create SettingsProvider (dark mode logic)
2. Update AuthProvider (upload, reset, delete methods)
3. Update ChatProvider (userStatusChanged listener)
4. Wire up SettingsProvider in main.dart
5. Test provider state changes

### Phase 6: Frontend Widgets (Day 3-4)
1. Update AvatarCircle (profile pictures + online indicator)
2. Create ResetPasswordDialog
3. Create DeleteAccountDialog
4. Create ProfilePictureDialog
5. Test dialogs in isolation

### Phase 7: Settings Screen UI (Day 4)
1. Add image_picker and device_info_plus to pubspec.yaml
2. Redesign settings_screen.dart (header section)
3. Add settings tiles (all 6 items)
4. Implement device name detection
5. Wire up all tap handlers
6. Test responsive design (mobile <600px, desktop ≥600px)

### Phase 8: Integration Testing (Day 5)
1. Test profile picture upload end-to-end
2. Test password reset flow
3. Test account deletion (verify cascades)
4. Test active status toggle (verify WebSocket events)
5. Test dark mode persistence
6. Test on multiple devices (web, Android, iOS if available)
7. Test error scenarios (network failures, invalid passwords)

### Phase 9: Polish & Documentation (Day 5)
1. Update CLAUDE.md with new features
2. Add loading states to settings screen
3. Add error handling SnackBars
4. Optimize image upload (compress before sending)
5. Add rate limiting feedback to user
6. Test logout → re-login preserves settings

---

## 5. TESTING STRATEGY

### Backend Unit Tests
**Files to test:**
- `users.service.spec.ts` (new methods: updateProfilePicture, resetPassword, deleteAccount, updateActiveStatus)
- `users.controller.spec.ts` (4 new endpoints)
- `chat-friend-request.service.spec.ts` (handleUpdateActiveStatus)

**Test cases:**
- Password reset: verify old password, hash new password, reject weak passwords
- Account deletion: verify password, check cascades (messages, conversations, friend_requests)
- Profile picture upload: validate file type, validate size, delete old file
- Active status: verify WebSocket event emission to friends

### Frontend Widget Tests
**Files to test:**
- `settings_screen_test.dart` (UI rendering, tap handlers)
- `avatar_circle_test.dart` (profile picture fallback, online indicator)
- Dialog tests (reset password validation, delete account confirmation)

**Test cases:**
- Settings screen renders all 6 tiles
- Camera badge visible on avatar
- Dark mode toggle updates SettingsProvider
- Device name displays correctly
- Dialogs show/hide properly

### Integration Tests
**Files to test:**
- `e2e/profile_picture_flow_test.dart` (upload → verify URL in avatar)
- `e2e/password_reset_flow_test.dart` (reset → logout → login with new password)
- `e2e/account_deletion_flow_test.dart` (delete → verify logout → verify login fails)

**Test cases:**
- Upload profile picture, refresh page, verify persistence
- Toggle active status, check friend sees status change
- Change dark mode, restart app, verify preference persisted
- Reset password, logout, login with new password

### Manual Testing Checklist
- [ ] Upload profile picture (jpg, png)
- [ ] Upload invalid file type (pdf) - verify rejection
- [ ] Upload large file (>5MB) - verify rejection
- [ ] Toggle active status - verify friend sees change
- [ ] Change dark mode (system/light/dark) - verify UI updates
- [ ] Click Privacy and Safety - verify "Coming soon" message
- [ ] View device name on Android, iOS, web
- [ ] Reset password - verify old password check
- [ ] Reset password with weak password - verify rejection
- [ ] Delete account - verify password confirmation
- [ ] Delete account - verify logout and data deletion
- [ ] Logout - verify all settings cleared (except dark mode preference)

---

## 6. POTENTIAL GOTCHAS & EDGE CASES

### Backend Gotchas

1. **File Upload Permissions**
   - Issue: Docker container may not have write permissions to `/uploads`
   - Solution: Add volume mount in docker-compose.yml: `- ./backend/uploads:/app/uploads`
   - Create directory with proper permissions before first upload

2. **Old File Deletion Race Condition**
   - Issue: If upload fails after deleting old file, user loses profile picture
   - Solution: Upload new file first, verify success, THEN delete old file

3. **Cascade Deletion Performance**
   - Issue: Deleting account with 1000+ messages may timeout
   - Solution: Use database-level cascades (ON DELETE CASCADE), not application-level
   - Add index on `sender_id` in messages table for faster cascade

4. **JWT Payload Size**
   - Issue: Adding profilePictureUrl increases JWT size
   - Solution: Store only relative path (not full URL), max 255 chars
   - Monitor JWT size, consider refresh token if >2KB

5. **Active Status Synchronization**
   - Issue: User opens app on 2 devices, toggles status on one device
   - Solution: Emit `userStatusChanged` to ALL sockets for the same userId (loop onlineUsers)

6. **TypeORM Synchronize in Production**
   - Issue: `synchronize: true` drops columns in production
   - Solution: Disable synchronize in production, use migrations instead
   - Document migration: `ALTER TABLE users ADD COLUMN profile_picture_url VARCHAR(255), ADD COLUMN active_status BOOLEAN DEFAULT true`

### Frontend Gotchas

1. **Image Picker Permissions**
   - Issue: Camera/gallery permission denied on first use
   - Solution: Add permission requests in `AndroidManifest.xml` and `Info.plist`
   - Handle `PermissionDeniedException` gracefully with user-friendly message

2. **Image Upload Size**
   - Issue: Uploading 10MB image on slow network causes timeout
   - Solution: Compress image before upload using `flutter_image_compress` package
   - Target: 500KB max, 800x800px max dimensions

3. **SharedPreferences Clear on Logout**
   - Issue: `prefs.clear()` in logout removes dark mode preference
   - Solution: Only clear JWT token, not all preferences
   - Change `logout()` to `prefs.remove('jwt_token')` instead of `clear()`

4. **Profile Picture Caching**
   - Issue: Uploaded new image but old image still shows (browser cache)
   - Solution: Append timestamp query param: `NetworkImage('$url?v=${DateTime.now().millisecondsSinceEpoch}')`

5. **Dark Mode System Setting**
   - Issue: User selects "System", but RPG theme looks same in light/dark
   - Solution: RPG theme is inherently dark, light theme not suitable
   - Consider disabling "Light" mode or creating separate light RPG palette

6. **Device Name on Web**
   - Issue: `device_info_plus` returns generic "Web Browser" on web
   - Solution: Parse `window.navigator.userAgent` for better browser detection
   - Fallback: Display "Web Browser" (acceptable)

7. **Active Status State Management**
   - Issue: User toggles status, but UI reverts on page refresh
   - Solution: Fetch user profile on connect to sync activeStatus from backend
   - Store activeStatus in AuthProvider, not just SettingsScreen state

8. **Avatar Circle Online Indicator Overlap**
   - Issue: Online indicator overlaps profile picture edge
   - Solution: Careful Stack positioning (right: 0, bottom: 0), add white border

---

## 7. SECURITY CONSIDERATIONS

1. **File Upload Validation**
   - Validate MIME type (not just extension)
   - Validate file size server-side (not just client-side)
   - Use randomized filenames to prevent directory traversal
   - Store files outside webroot, serve via Express static middleware

2. **Password Reset**
   - Require old password (no email-based reset in MVP)
   - Rate limit to 3 requests/hour
   - Log password changes for security audit

3. **Account Deletion**
   - Require password confirmation (prevent accidental deletion)
   - Rate limit to 1 request/hour
   - Consider soft delete (mark user as deleted, actual deletion after 30 days)

4. **JWT Auth Guards**
   - All new endpoints require `@UseGuards(JwtAuthGuard)`
   - Verify token expiry (already handled by JwtStrategy)
   - Extract userId from JWT, not request body (prevent user impersonation)

5. **Active Status Privacy**
   - Only friends can see active status (emit `userStatusChanged` only to friends)
   - Add privacy setting to hide status from all users (future enhancement)

---

## 8. PERFORMANCE CONSIDERATIONS

1. **Image Upload Optimization**
   - Frontend: Compress images before upload (target 500KB)
   - Backend: Use streaming upload (multer handles this)
   - CDN: Consider serving images from CDN in production (future)

2. **Active Status Event Fan-out**
   - User with 1000 friends toggling status = 1000 socket emits
   - Solution: Use Socket.IO rooms (join room per friendship), emit once to room
   - Alternative: Batch emits every 100 users to prevent event loop blocking

3. **Profile Picture Loading**
   - Use `CachedNetworkImage` package for better caching (optional)
   - Add loading placeholder in AvatarCircle
   - Handle slow network gracefully (show gradient while loading)

4. **Dark Mode Switching**
   - Theme switching rebuilds entire widget tree
   - Acceptable for MVP (instant on modern devices)
   - If laggy, consider `AnimatedTheme` wrapper

---

## 9. DOCUMENTATION UPDATES

### CLAUDE.md Updates Required

**Section: Database Schema**
```markdown
users
  ├─ id (PK)
  ├─ email (unique)
  ├─ username (unique)
  ├─ password (bcrypt)
  ├─ profilePictureUrl (nullable, relative path) ← NEW
  ├─ activeStatus (boolean, default true) ← NEW
  └─ createdAt
```

**Section: REST Endpoints**
```markdown
| Endpoint | Body | Response |
|----------|------|----------|
| POST /auth/register | ... | ... |
| POST /auth/login | ... | ... |
| POST /users/profile-picture | multipart: file | {profilePictureUrl} ← NEW
| POST /auth/reset-password | {oldPassword, newPassword} | {message} ← NEW
| DELETE /users/account | {password} | {message} ← NEW
| PATCH /users/active-status | {activeStatus} | {activeStatus} ← NEW
```

**Section: WebSocket Events**
```markdown
Client → Server:
  updateActiveStatus {activeStatus} ← NEW

Server → Client:
  userStatusChanged {userId, activeStatus} ← NEW
```

**Section: Frontend Architecture**
```markdown
Providers:
  - AuthProvider (JWT + profile picture upload)
  - ChatProvider (WebSocket + active status listener)
  - SettingsProvider (dark mode preference) ← NEW
```

**Section: Project Status - Completed**
```markdown
✅ Settings Screen Redesign (2026-01-XX)
- Profile picture upload with camera badge
- Active status toggle (visible to friends only)
- Dark mode (System/Light/Dark) with persistence
- Device name detection
- Password reset with validation
- Account deletion with cascade cleanup
```

---

## 10. ROLLBACK PLAN

If critical bugs discovered after deployment:

1. **Database Rollback:**
   - Remove columns: `ALTER TABLE users DROP COLUMN profile_picture_url, DROP COLUMN active_status`
   - No data loss (columns are nullable/defaulted)

2. **Backend Rollback:**
   - Revert to previous commit: `git revert <commit-hash>`
   - Redeploy backend without new endpoints
   - Remove JWT payload changes (breaks frontend)

3. **Frontend Rollback:**
   - Revert settings_screen.dart to previous version (minimal UI)
   - Remove SettingsProvider from main.dart
   - Remove new packages from pubspec.yaml
   - Clear app data on devices to reset dark mode preference

4. **Partial Rollback:**
   - Keep profile picture feature, disable active status (comment out WebSocket handler)
   - Keep password reset, disable account deletion (comment out endpoint)

---

### Critical Files for Implementation

Based on the complexity and centrality of changes, these are the 5 most critical files:

1. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\user.entity.ts**
   - Reason: Foundation of all backend changes, database schema modifications required for all features

2. **C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\users.service.ts**
   - Reason: Core business logic for profile upload, password reset, account deletion, status updates

3. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\screens\settings_screen.dart**
   - Reason: Complete UI redesign, integrates all 6 new features, primary user interface

4. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\auth_provider.dart**
   - Reason: Manages profile picture state, handles upload/reset/delete operations, JWT decoding updates

5. **C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\avatar_circle.dart**
   - Reason: Used throughout app (conversations list, chat detail, settings), supports profile pictures + online indicators