Now I have a comprehensive understanding of the codebase. Let me design a detailed Flutter migration plan.

# Phase 2.5: Flutter Migration Implementation Plan

## Overview

This plan migrates the HTML/JS frontend to a cross-platform Flutter application while maintaining the existing NestJS backend. The Flutter app will be placed in `flutter_app/` within the monorepo and will communicate with the backend via REST API and Socket.IO WebSocket.

## Architecture Summary

**Backend (No Changes)**: NestJS at `http://localhost:3000`
- REST endpoints: `/auth/*`, `/users/*`
- WebSocket: Socket.IO with JWT auth
- Static file serving: `/uploads/avatars/`

**Frontend (New)**: Flutter app in `flutter_app/`
- State: Riverpod providers
- API: Dio for HTTP, socket_io_client for WebSocket
- Storage: flutter_secure_storage for tokens
- Theme: RPG 16-bit pixel-art with dark background

---

## Sub-Phase 2.5.1: Project Setup & Dependencies

### Step 1.1: Create Flutter project structure

**Action**: Run Flutter CLI to create project

**Command**:
```bash
cd C:\Users\Lentach\desktop\mvp-chat-app
flutter create --org com.rpgchat --project-name rpg_chat flutter_app
cd flutter_app
```

**Files created by Flutter CLI**:
- `flutter_app/pubspec.yaml` - Dependencies manifest
- `flutter_app/lib/main.dart` - App entry point
- `flutter_app/android/` - Android platform code
- `flutter_app/ios/` - iOS platform code
- `flutter_app/web/` - Web platform code
- `flutter_app/lib/` - Main Dart source directory

### Step 1.2: Configure dependencies

**File**: `flutter_app/pubspec.yaml`

**Action**: Add dependencies to `dependencies:` section:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State management
  flutter_riverpod: ^2.5.1
  
  # Networking
  dio: ^5.4.0
  socket_io_client: ^2.0.3+1
  
  # Secure storage
  flutter_secure_storage: ^9.0.0
  
  # Image handling
  image_picker: ^1.0.7
  cached_network_image: ^3.3.1
  
  # Navigation
  go_router: ^13.2.0
  
  # Audio
  audioplayers: ^5.2.1
  
  # UI utilities
  intl: ^0.19.0  # Date formatting
  
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
```

**Command to install**:
```bash
cd flutter_app
flutter pub get
```

### Step 1.3: Configure Android permissions

**File**: `flutter_app/android/app/src/main/AndroidManifest.xml`

**Action**: Add permissions before `<application>` tag:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.CAMERA"/>
```

Also add inside `<application>` tag for file access on Android 11+:
```xml
<application
    android:requestLegacyExternalStorage="true"
    ...>
```

### Step 1.4: Configure iOS permissions

**File**: `flutter_app/ios/Runner/Info.plist`

**Action**: Add before closing `</dict>`:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photo library to upload avatar images</string>
<key>NSCameraUsageDescription</key>
<string>We need access to your camera to take photos for avatars</string>
<key>NSMicrophoneUsageDescription</key>
<string>We need access to play notification sounds</string>
```

### Step 1.5: Configure backend URL constants

**File**: `flutter_app/lib/core/constants/api_constants.dart` (CREATE)

```dart
class ApiConstants {
  // Change these for production
  static const String baseUrl = 'http://localhost:3000';
  static const String wsUrl = 'http://localhost:3000';
  
  // REST endpoints
  static const String authRegister = '/auth/register';
  static const String authLogin = '/auth/login';
  static const String authRefresh = '/auth/refresh';
  static const String authLogout = '/auth/logout';
  static const String usersMe = '/users/me';
  static const String usersMeAvatar = '/users/me/avatar';
  
  // Upload base
  static String avatarUrl(String path) => '$baseUrl$path';
}
```

**Dependencies**: None (first file)

---

## Sub-Phase 2.5.2: Theme & Styling System

### Step 2.1: Define RPG color palette

**File**: `flutter_app/lib/core/theme/app_colors.dart` (CREATE)

```dart
import 'package:flutter/material.dart';

class AppColors {
  // Dark RPG theme
  static const Color darkBackground = Color(0xFF0a0a2e);
  static const Color darkerBackground = Color(0xFF050514);
  static const Color primary = Color(0xFF4a4ae0);
  static const Color primaryDark = Color(0xFF2a2a8e);
  static const Color accent = Color(0xFFf4a261);
  static const Color campfireOrange = Color(0xFFff6b35);
  static const Color campfireYellow = Color(0xFFffd23f);
  
  // UI elements
  static const Color textPrimary = Color(0xFFe8e8e8);
  static const Color textSecondary = Color(0xFFa0a0a0);
  static const Color messageBubbleSent = Color(0xFF2a2a8e);
  static const Color messageBubbleReceived = Color(0xFF1a1a3e);
  static const Color inputBackground = Color(0xFF1a1a3e);
  static const Color divider = Color(0xFF2a2a4e);
  
  // Status colors
  static const Color online = Color(0xFF4ecdc4);
  static const Color offline = Color(0xFF6c6c8e);
  static const Color typing = Color(0xFFffe66d);
  
  // Avatar default colors (for hash-based generation)
  static const List<Color> avatarColors = [
    Color(0xFF4a8fc2),
    Color(0xFFc24a8f),
    Color(0xFF8fc24a),
    Color(0xFFc2684a),
    Color(0xFF4ac28f),
    Color(0xFF8f4ac2),
  ];
}
```

### Step 2.2: Create app theme

**File**: `flutter_app/lib/core/theme/app_theme.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData darkTheme() {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.primary,
        secondary: AppColors.accent,
        surface: AppColors.darkerBackground,
        background: AppColors.darkBackground,
      ),
      
      // Pixel-art font (fallback to system monospace)
      fontFamily: 'Courier',  // Can be replaced with pixel font asset
      
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.darkerBackground,
        elevation: 0,
        centerTitle: true,
      ),
      
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.inputBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.divider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
      ),
      
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.textPrimary,
          minimumSize: const Size(double.infinity, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      ),
    );
  }
}
```

**Dependencies**: `app_colors.dart`

---

## Sub-Phase 2.5.3: Data Models

### Step 3.1: User model

**File**: `flutter_app/lib/models/user.dart` (CREATE)

```dart
class User {
  final int id;
  final String username;
  final String? displayName;
  final String? avatarUrl;
  final String? avatarColor;
  final DateTime? lastSeenAt;
  final DateTime createdAt;

  User({
    required this.id,
    required this.username,
    this.displayName,
    this.avatarUrl,
    this.avatarColor,
    this.lastSeenAt,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      username: json['username'] as String,
      displayName: json['displayName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      avatarColor: json['avatarColor'] as String?,
      lastSeenAt: json['lastSeenAt'] != null 
          ? DateTime.parse(json['lastSeenAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'displayName': displayName,
      'avatarUrl': avatarUrl,
      'avatarColor': avatarColor,
      'lastSeenAt': lastSeenAt?.toIso8601String(),
      'createdAt': createdAt.toIso8601String(),
    };
  }

  String get displayNameOrUsername => displayName ?? username;
  
  bool get hasAvatar => avatarUrl != null && avatarUrl!.isNotEmpty;
}
```

### Step 3.2: Message model

**File**: `flutter_app/lib/models/message.dart` (CREATE)

```dart
class Message {
  final int id;
  final String content;
  final int senderId;
  final String senderUsername;
  final int conversationId;
  final DateTime? readAt;
  final DateTime createdAt;

  Message({
    required this.id,
    required this.content,
    required this.senderId,
    required this.senderUsername,
    required this.conversationId,
    this.readAt,
    required this.createdAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as int,
      content: json['content'] as String,
      senderId: json['senderId'] as int,
      senderUsername: json['senderUsername'] as String,
      conversationId: json['conversationId'] as int,
      readAt: json['readAt'] != null 
          ? DateTime.parse(json['readAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  bool get isRead => readAt != null;
  
  Message copyWith({DateTime? readAt}) {
    return Message(
      id: id,
      content: content,
      senderId: senderId,
      senderUsername: senderUsername,
      conversationId: conversationId,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt,
    );
  }
}
```

### Step 3.3: Conversation model

**File**: `flutter_app/lib/models/conversation.dart` (CREATE)

```dart
import 'user.dart';

class Conversation {
  final int id;
  final User userOne;
  final User userTwo;
  final ConversationOtherUser otherUser;
  final int unreadCount;
  final DateTime createdAt;

  Conversation({
    required this.id,
    required this.userOne,
    required this.userTwo,
    required this.otherUser,
    required this.unreadCount,
    required this.createdAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as int,
      userOne: User.fromJson(json['userOne'] as Map<String, dynamic>),
      userTwo: User.fromJson(json['userTwo'] as Map<String, dynamic>),
      otherUser: ConversationOtherUser.fromJson(
        json['otherUser'] as Map<String, dynamic>
      ),
      unreadCount: json['unreadCount'] as int,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}

class ConversationOtherUser extends User {
  final bool isOnline;

  ConversationOtherUser({
    required super.id,
    required super.username,
    super.displayName,
    super.avatarUrl,
    super.avatarColor,
    super.lastSeenAt,
    required super.createdAt,
    required this.isOnline,
  });

  factory ConversationOtherUser.fromJson(Map<String, dynamic> json) {
    return ConversationOtherUser(
      id: json['id'] as int,
      username: json['username'] as String,
      displayName: json['displayName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      avatarColor: json['avatarColor'] as String?,
      lastSeenAt: json['lastSeenAt'] != null 
          ? DateTime.parse(json['lastSeenAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      isOnline: json['isOnline'] as bool,
    );
  }
}
```

**Dependencies**: `user.dart`

---

## Sub-Phase 2.5.4: Services Layer

### Step 4.1: Secure storage service

**File**: `flutter_app/lib/services/storage_service.dart` (CREATE)

```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static const _storage = FlutterSecureStorage();
  
  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyUserId = 'user_id';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<void> saveUserId(int userId) async {
    await _storage.write(key: _keyUserId, value: userId.toString());
  }

  Future<int?> getUserId() async {
    final id = await _storage.read(key: _keyUserId);
    return id != null ? int.tryParse(id) : null;
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
```

### Step 4.2: API client with Dio

**File**: `flutter_app/lib/services/api_client.dart` (CREATE)

```dart
import 'package:dio/dio.dart';
import '../core/constants/api_constants.dart';
import 'storage_service.dart';

class ApiClient {
  late final Dio _dio;
  final StorageService _storage;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Request interceptor: add JWT to headers
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // Handle 401: try refresh token
        if (error.response?.statusCode == 401) {
          final refreshToken = await _storage.getRefreshToken();
          if (refreshToken != null) {
            try {
              final response = await _dio.post(
                ApiConstants.authRefresh,
                data: {'refreshToken': refreshToken},
              );
              
              final newAccessToken = response.data['accessToken'] as String;
              final newRefreshToken = response.data['refreshToken'] as String;
              
              await _storage.saveTokens(
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
              );
              
              // Retry original request
              error.requestOptions.headers['Authorization'] = 'Bearer $newAccessToken';
              return handler.resolve(await _dio.fetch(error.requestOptions));
            } catch (e) {
              // Refresh failed, clear tokens
              await _storage.clearAll();
              return handler.reject(error);
            }
          }
        }
        return handler.next(error);
      },
    ));
  }

  Dio get dio => _dio;
}
```

**Dependencies**: `api_constants.dart`, `storage_service.dart`

### Step 4.3: Auth service

**File**: `flutter_app/lib/services/auth_service.dart` (CREATE)

```dart
import 'package:dio/dio.dart';
import '../core/constants/api_constants.dart';
import '../models/user.dart';
import 'api_client.dart';
import 'storage_service.dart';

class AuthService {
  final ApiClient _apiClient;
  final StorageService _storage;

  AuthService(this._apiClient, this._storage);

  Future<User> register({
    required String username,
    required String password,
    String? displayName,
  }) async {
    final response = await _apiClient.dio.post(
      ApiConstants.authRegister,
      data: {
        'username': username,
        'password': password,
        if (displayName != null) 'displayName': displayName,
      },
    );
    
    return User.fromJson(response.data);
  }

  Future<User> login({
    required String username,
    required String password,
  }) async {
    final response = await _apiClient.dio.post(
      ApiConstants.authLogin,
      data: {
        'username': username,
        'password': password,
      },
    );

    final accessToken = response.data['accessToken'] as String;
    final refreshToken = response.data['refreshToken'] as String;
    
    await _storage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
    );

    // Get user profile
    return await getProfile();
  }

  Future<User> getProfile() async {
    final response = await _apiClient.dio.get(ApiConstants.usersMe);
    final user = User.fromJson(response.data);
    await _storage.saveUserId(user.id);
    return user;
  }

  Future<User> updateProfile({String? displayName}) async {
    final response = await _apiClient.dio.patch(
      ApiConstants.usersMe,
      data: {'displayName': displayName},
    );
    return User.fromJson(response.data);
  }

  Future<String> uploadAvatar(String filePath) async {
    final formData = FormData.fromMap({
      'avatar': await MultipartFile.fromFile(filePath),
    });

    final response = await _apiClient.dio.post(
      ApiConstants.usersMeAvatar,
      data: formData,
    );

    return response.data['avatarUrl'] as String;
  }

  Future<void> deleteAvatar() async {
    await _apiClient.dio.delete(ApiConstants.usersMeAvatar);
  }

  Future<void> logout() async {
    final refreshToken = await _storage.getRefreshToken();
    if (refreshToken != null) {
      try {
        await _apiClient.dio.post(
          ApiConstants.authLogout,
          data: {'refreshToken': refreshToken},
        );
      } catch (_) {
        // Ignore errors on logout
      }
    }
    await _storage.clearAll();
  }
}
```

**Dependencies**: `api_client.dart`, `storage_service.dart`, `user.dart`, `api_constants.dart`

### Step 4.4: Socket.IO service

**File**: `flutter_app/lib/services/socket_service.dart` (CREATE)

```dart
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/constants/api_constants.dart';
import '../models/message.dart';
import '../models/conversation.dart';
import 'storage_service.dart';

class SocketService {
  IO.Socket? _socket;
  final StorageService _storage;

  SocketService(this._storage);

  Future<void> connect() async {
    final token = await _storage.getAccessToken();
    if (token == null) return;

    _socket = IO.io(
      ApiConstants.wsUrl,
      IO.OptionBuilder()
          .setTransports(['websocket'])
          .enableAutoConnect()
          .setAuth({'token': token})
          .build(),
    );

    _socket?.connect();
  }

  Future<void> disconnect() async {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  Future<void> reconnectWithNewToken() async {
    await disconnect();
    await connect();
  }

  void sendMessage({required int recipientId, required String content}) {
    _socket?.emit('sendMessage', {
      'recipientId': recipientId,
      'content': content,
    });
  }

  void startConversation({required String recipientUsername}) {
    _socket?.emit('startConversation', {
      'recipientUsername': recipientUsername,
    });
  }

  void getMessages({
    required int conversationId,
    int? before,
    int? limit,
  }) {
    _socket?.emit('getMessages', {
      'conversationId': conversationId,
      if (before != null) 'before': before,
      if (limit != null) 'limit': limit,
    });
  }

  void getConversations() {
    _socket?.emit('getConversations', {});
  }

  void typing({required int conversationId}) {
    _socket?.emit('typing', {'conversationId': conversationId});
  }

  void stopTyping({required int conversationId}) {
    _socket?.emit('stopTyping', {'conversationId': conversationId});
  }

  void markRead({required int conversationId}) {
    _socket?.emit('markRead', {'conversationId': conversationId});
  }

  void getOnlineUsers() {
    _socket?.emit('getOnlineUsers', {});
  }

  // Event listeners
  void onMessageSent(Function(Message) callback) {
    _socket?.on('messageSent', (data) {
      callback(Message.fromJson(data));
    });
  }

  void onNewMessage(Function(Message) callback) {
    _socket?.on('newMessage', (data) {
      callback(Message.fromJson(data));
    });
  }

  void onMessageHistory(Function(List<Message>, bool hasMore) callback) {
    _socket?.on('messageHistory', (data) {
      final messages = (data['messages'] as List)
          .map((m) => Message.fromJson(m))
          .toList();
      final hasMore = data['hasMore'] as bool;
      callback(messages, hasMore);
    });
  }

  void onConversationsList(Function(List<Conversation>) callback) {
    _socket?.on('conversationsList', (data) {
      final conversations = (data as List)
          .map((c) => Conversation.fromJson(c))
          .toList();
      callback(conversations);
    });
  }

  void onUserTyping(Function(int userId, int conversationId) callback) {
    _socket?.on('userTyping', (data) {
      callback(data['userId'] as int, data['conversationId'] as int);
    });
  }

  void onUserStoppedTyping(Function(int userId, int conversationId) callback) {
    _socket?.on('userStoppedTyping', (data) {
      callback(data['userId'] as int, data['conversationId'] as int);
    });
  }

  void onMessagesRead(Function(int conversationId, DateTime readAt) callback) {
    _socket?.on('messagesRead', (data) {
      callback(
        data['conversationId'] as int,
        DateTime.parse(data['readAt'] as String),
      );
    });
  }

  void onUserOnline(Function(int userId) callback) {
    _socket?.on('userOnline', (data) {
      callback(data['userId'] as int);
    });
  }

  void onUserOffline(Function(int userId) callback) {
    _socket?.on('userOffline', (data) {
      callback(data['userId'] as int);
    });
  }

  void onOnlineUsers(Function(List<int>) callback) {
    _socket?.on('onlineUsers', (data) {
      callback((data as List).cast<int>());
    });
  }

  void onError(Function(String) callback) {
    _socket?.on('error', (data) {
      callback(data['message'] as String);
    });
  }

  void onOpenConversation(Function(int conversationId) callback) {
    _socket?.on('openConversation', (data) {
      callback(data['conversationId'] as int);
    });
  }
}
```

**Dependencies**: `api_constants.dart`, `storage_service.dart`, `message.dart`, `conversation.dart`

### Step 4.5: Audio notification service

**File**: `flutter_app/lib/services/audio_service.dart` (CREATE)

```dart
import 'package:audioplayers/audioplayers.dart';

class AudioService {
  final AudioPlayer _player = AudioPlayer();
  bool _isMuted = false;

  Future<void> playMessageSound() async {
    if (_isMuted) return;
    
    // Generate simple RPG-style beep using frequency
    // Alternative: use asset audio file
    try {
      await _player.play(AssetSource('sounds/message_beep.mp3'));
    } catch (e) {
      // Fallback: system beep or silent
    }
  }

  void toggleMute() {
    _isMuted = !_isMuted;
  }

  bool get isMuted => _isMuted;
}
```

**Note**: Requires audio asset at `flutter_app/assets/sounds/message_beep.mp3` (create simple RPG chime with audio editor or use generated tone).

---

## Sub-Phase 2.5.5: Riverpod Providers

### Step 5.1: Provider setup

**File**: `flutter_app/lib/providers/providers.dart` (CREATE)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/storage_service.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/socket_service.dart';
import '../services/audio_service.dart';

// Service providers (singletons)
final storageServiceProvider = Provider((ref) => StorageService());

final apiClientProvider = Provider((ref) {
  final storage = ref.watch(storageServiceProvider);
  return ApiClient(storage);
});

final authServiceProvider = Provider((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final storage = ref.watch(storageServiceProvider);
  return AuthService(apiClient, storage);
});

final socketServiceProvider = Provider((ref) {
  final storage = ref.watch(storageServiceProvider);
  return SocketService(storage);
});

final audioServiceProvider = Provider((ref) => AudioService());
```

**Dependencies**: All service files

### Step 5.2: Auth state provider

**File**: `flutter_app/lib/providers/auth_provider.dart` (CREATE)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import 'providers.dart';

// Auth state
class AuthState {
  final User? user;
  final bool isLoading;
  final String? error;

  AuthState({this.user, this.isLoading = false, this.error});

  AuthState copyWith({User? user, bool? isLoading, String? error}) {
    return AuthState(
      user: user ?? this.user,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

// Auth state notifier
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(AuthState());

  Future<void> checkAuth() async {
    state = state.copyWith(isLoading: true);
    try {
      final user = await _authService.getProfile();
      state = AuthState(user: user);
    } catch (e) {
      state = AuthState();
    }
  }

  Future<void> login(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await _authService.login(
        username: username,
        password: password,
      );
      state = AuthState(user: user);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      rethrow;
    }
  }

  Future<void> register(String username, String password, {String? displayName}) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _authService.register(
        username: username,
        password: password,
        displayName: displayName,
      );
      // Auto-login after register
      await login(username, password);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
      rethrow;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    state = AuthState();
  }

  Future<void> updateProfile({String? displayName}) async {
    try {
      final user = await _authService.updateProfile(displayName: displayName);
      state = state.copyWith(user: user);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> uploadAvatar(String filePath) async {
    try {
      final avatarUrl = await _authService.uploadAvatar(filePath);
      final updatedUser = state.user!.toJson()..['avatarUrl'] = avatarUrl;
      state = state.copyWith(user: User.fromJson(updatedUser));
    } catch (e) {
      rethrow;
    }
  }
}

// Provider
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService);
});
```

**Dependencies**: `user.dart`, `auth_service.dart`, `providers.dart`

### Step 5.3: Chat state provider

**File**: `flutter_app/lib/providers/chat_provider.dart` (CREATE)

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/conversation.dart';
import '../models/message.dart';
import '../services/socket_service.dart';
import 'providers.dart';

// Chat state
class ChatState {
  final List<Conversation> conversations;
  final Map<int, List<Message>> messagesByConversation;
  final Map<int, bool> hasMoreByConversation;
  final Set<int> onlineUserIds;
  final Map<int, int> typingUsers; // conversationId -> userId typing

  ChatState({
    this.conversations = const [],
    this.messagesByConversation = const {},
    this.hasMoreByConversation = const {},
    this.onlineUserIds = const {},
    this.typingUsers = const {},
  });

  ChatState copyWith({
    List<Conversation>? conversations,
    Map<int, List<Message>>? messagesByConversation,
    Map<int, bool>? hasMoreByConversation,
    Set<int>? onlineUserIds,
    Map<int, int>? typingUsers,
  }) {
    return ChatState(
      conversations: conversations ?? this.conversations,
      messagesByConversation: messagesByConversation ?? this.messagesByConversation,
      hasMoreByConversation: hasMoreByConversation ?? this.hasMoreByConversation,
      onlineUserIds: onlineUserIds ?? this.onlineUserIds,
      typingUsers: typingUsers ?? this.typingUsers,
    );
  }
}

// Chat notifier
class ChatNotifier extends StateNotifier<ChatState> {
  final SocketService _socketService;

  ChatNotifier(this._socketService) : super(ChatState()) {
    _setupListeners();
  }

  void _setupListeners() {
    _socketService.onConversationsList((conversations) {
      state = state.copyWith(conversations: conversations);
    });

    _socketService.onMessageHistory((messages, hasMore) {
      if (messages.isEmpty) return;
      final convId = messages.first.conversationId;
      final existing = state.messagesByConversation[convId] ?? [];
      final updated = {...state.messagesByConversation};
      updated[convId] = [...messages.reversed, ...existing];
      
      final hasMoreMap = {...state.hasMoreByConversation};
      hasMoreMap[convId] = hasMore;

      state = state.copyWith(
        messagesByConversation: updated,
        hasMoreByConversation: hasMoreMap,
      );
    });

    _socketService.onNewMessage((message) {
      _addMessage(message);
    });

    _socketService.onMessageSent((message) {
      _addMessage(message);
    });

    _socketService.onUserTyping((userId, conversationId) {
      final updated = {...state.typingUsers};
      updated[conversationId] = userId;
      state = state.copyWith(typingUsers: updated);
    });

    _socketService.onUserStoppedTyping((userId, conversationId) {
      final updated = {...state.typingUsers};
      updated.remove(conversationId);
      state = state.copyWith(typingUsers: updated);
    });

    _socketService.onUserOnline((userId) {
      final updated = {...state.onlineUserIds};
      updated.add(userId);
      state = state.copyWith(onlineUserIds: updated);
    });

    _socketService.onUserOffline((userId) {
      final updated = {...state.onlineUserIds};
      updated.remove(userId);
      state = state.copyWith(onlineUserIds: updated);
    });

    _socketService.onOnlineUsers((userIds) {
      state = state.copyWith(onlineUserIds: userIds.toSet());
    });
  }

  void _addMessage(Message message) {
    final convId = message.conversationId;
    final existing = state.messagesByConversation[convId] ?? [];
    final updated = {...state.messagesByConversation};
    updated[convId] = [...existing, message];
    state = state.copyWith(messagesByConversation: updated);
  }

  void sendMessage(int recipientId, String content) {
    _socketService.sendMessage(recipientId: recipientId, content: content);
  }

  void startConversation(String recipientUsername) {
    _socketService.startConversation(recipientUsername: recipientUsername);
  }

  void loadMessages(int conversationId, {int? before}) {
    _socketService.getMessages(
      conversationId: conversationId,
      before: before,
      limit: 50,
    );
  }

  void loadConversations() {
    _socketService.getConversations();
  }

  void typing(int conversationId) {
    _socketService.typing(conversationId: conversationId);
  }

  void stopTyping(int conversationId) {
    _socketService.stopTyping(conversationId: conversationId);
  }

  void markRead(int conversationId) {
    _socketService.markRead(conversationId: conversationId);
  }
}

// Provider
final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  final socketService = ref.watch(socketServiceProvider);
  return ChatNotifier(socketService);
});
```

**Dependencies**: `conversation.dart`, `message.dart`, `socket_service.dart`, `providers.dart`

---

## Sub-Phase 2.5.6: Reusable Widgets

### Step 6.1: Avatar widget

**File**: `flutter_app/lib/widgets/avatar_circle.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../core/theme/app_colors.dart';
import '../core/constants/api_constants.dart';

class AvatarCircle extends StatelessWidget {
  final String? avatarUrl;
  final String? avatarColor;
  final String username;
  final double size;
  final bool showOnlineIndicator;
  final bool isOnline;

  const AvatarCircle({
    super.key,
    this.avatarUrl,
    this.avatarColor,
    required this.username,
    this.size = 48,
    this.showOnlineIndicator = false,
    this.isOnline = false,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: _parseColor(avatarColor) ?? AppColors.primary,
          ),
          child: avatarUrl != null
              ? ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: ApiConstants.avatarUrl(avatarUrl!),
                    fit: BoxFit.cover,
                    placeholder: (_, __) => _buildInitial(),
                    errorWidget: (_, __, ___) => _buildInitial(),
                  ),
                )
              : _buildInitial(),
        ),
        if (showOnlineIndicator)
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: size * 0.25,
              height: size * 0.25,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isOnline ? AppColors.online : AppColors.offline,
                border: Border.all(
                  color: AppColors.darkBackground,
                  width: 2,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildInitial() {
    return Center(
      child: Text(
        username.isNotEmpty ? username[0].toUpperCase() : '?',
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: size * 0.4,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Color? _parseColor(String? colorString) {
    if (colorString == null || !colorString.startsWith('#')) return null;
    return Color(int.parse(colorString.substring(1), radix: 16) + 0xFF000000);
  }
}
```

**Dependencies**: `app_colors.dart`, `api_constants.dart`

### Step 6.2: Message bubble widget

**File**: `flutter_app/lib/widgets/message_bubble.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/theme/app_colors.dart';
import '../models/message.dart';

class MessageBubble extends StatelessWidget {
  final Message message;
  final bool isSent;

  const MessageBubble({
    super.key,
    required this.message,
    required this.isSent,
  });

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isSent ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.7,
        ),
        decoration: BoxDecoration(
          color: isSent 
              ? AppColors.messageBubbleSent 
              : AppColors.messageBubbleReceived,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.content,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  DateFormat('HH:mm').format(message.createdAt.toLocal()),
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 11,
                  ),
                ),
                if (isSent) ...[
                  const SizedBox(width: 4),
                  Icon(
                    message.isRead ? Icons.done_all : Icons.done,
                    size: 14,
                    color: message.isRead 
                        ? AppColors.online 
                        : AppColors.textSecondary,
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
```

**Dependencies**: `app_colors.dart`, `message.dart`

### Step 6.3: Campfire scene widget

**File**: `flutter_app/lib/widgets/campfire_scene.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../models/user.dart';
import 'avatar_circle.dart';

class CampfireScene extends StatefulWidget {
  final User currentUser;
  final User otherUser;
  final bool isOtherOnline;
  final bool isOtherTyping;

  const CampfireScene({
    super.key,
    required this.currentUser,
    required this.otherUser,
    required this.isOtherOnline,
    this.isOtherTyping = false,
  });

  @override
  State<CampfireScene> createState() => _CampfireSceneState();
}

class _CampfireSceneState extends State<CampfireScene> 
    with SingleTickerProviderStateMixin {
  late AnimationController _fireController;

  @override
  void initState() {
    super.initState();
    _fireController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _fireController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.35,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            AppColors.darkerBackground,
            AppColors.darkBackground,
          ],
        ),
      ),
      child: Stack(
        children: [
          // Stars background
          ...List.generate(20, (i) => _buildStar(i)),
          
          // Ground
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            height: 60,
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0xFF1a1a2e),
                    Color(0xFF0f0f1a),
                  ],
                ),
              ),
            ),
          ),
          
          // Campfire center
          Positioned(
            bottom: 70,
            left: MediaQuery.of(context).size.width / 2 - 30,
            child: _buildCampfire(),
          ),
          
          // Left avatar (current user)
          Positioned(
            bottom: 80,
            left: MediaQuery.of(context).size.width * 0.2,
            child: Column(
              children: [
                AvatarCircle(
                  avatarUrl: widget.currentUser.avatarUrl,
                  avatarColor: widget.currentUser.avatarColor,
                  username: widget.currentUser.username,
                  size: 64,
                ),
                const SizedBox(height: 4),
                Text(
                  widget.currentUser.displayNameOrUsername,
                  style: const TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          
          // Right avatar (other user)
          Positioned(
            bottom: 80,
            right: MediaQuery.of(context).size.width * 0.2,
            child: Column(
              children: [
                if (widget.isOtherTyping)
                  _buildTypingBubble(),
                AvatarCircle(
                  avatarUrl: widget.otherUser.avatarUrl,
                  avatarColor: widget.otherUser.avatarColor,
                  username: widget.otherUser.username,
                  size: 64,
                  showOnlineIndicator: true,
                  isOnline: widget.isOtherOnline,
                ),
                const SizedBox(height: 4),
                Text(
                  widget.otherUser.displayNameOrUsername,
                  style: TextStyle(
                    color: widget.isOtherOnline 
                        ? AppColors.textSecondary 
                        : AppColors.offline,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCampfire() {
    return AnimatedBuilder(
      animation: _fireController,
      builder: (context, child) {
        return Column(
          children: [
            // Flames
            Container(
              width: 60,
              height: 80 + (_fireController.value * 10),
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    AppColors.campfireYellow,
                    AppColors.campfireOrange,
                    Colors.transparent,
                  ],
                  stops: const [0.3, 0.6, 1.0],
                ),
                borderRadius: BorderRadius.circular(30),
              ),
            ),
            // Logs
            Container(
              width: 80,
              height: 20,
              decoration: BoxDecoration(
                color: const Color(0xFF3a2a1a),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTypingBubble() {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.typing.withOpacity(0.9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text(
        '...',
        style: TextStyle(
          color: AppColors.darkBackground,
          fontSize: 18,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildStar(int index) {
    final random = index * 123.456;
    final left = (random % 100) / 100 * MediaQuery.of(context).size.width;
    final top = ((random * 7) % 60) / 60 * 100;
    
    return Positioned(
      left: left,
      top: top,
      child: Container(
        width: 2,
        height: 2,
        decoration: const BoxDecoration(
          color: Colors.white70,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
```

**Dependencies**: `app_colors.dart`, `user.dart`, `avatar_circle.dart`

---

## Sub-Phase 2.5.7: Screens

### Step 7.1: Login screen

**File**: `flutter_app/lib/screens/login_screen.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../core/theme/app_colors.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    try {
      await ref.read(authProvider.notifier).login(
        _usernameController.text.trim(),
        _passwordController.text,
      );
      if (mounted) context.go('/conversations');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Login failed: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  // Title
                  const Icon(
                    Icons.shield,
                    size: 80,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'RPG Chat',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 48),
                  
                  // Username field
                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      prefixIcon: Icon(Icons.person),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Username required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  // Password field
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      prefixIcon: Icon(Icons.lock),
                    ),
                    obscureText: true,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Password required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  
                  // Login button
                  ElevatedButton(
                    onPressed: authState.isLoading ? null : _handleLogin,
                    child: authState.isLoading
                        ? const CircularProgressIndicator()
                        : const Text('Login'),
                  ),
                  const SizedBox(height: 16),
                  
                  // Register link
                  TextButton(
                    onPressed: () => context.go('/register'),
                    child: const Text('Don\'t have an account? Register'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

**Dependencies**: `auth_provider.dart`, `app_colors.dart`

### Step 7.2: Register screen

**File**: `flutter_app/lib/screens/register_screen.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../core/theme/app_colors.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _displayNameController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _displayNameController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    if (!_formKey.currentState!.validate()) return;

    try {
      await ref.read(authProvider.notifier).register(
        _usernameController.text.trim(),
        _passwordController.text,
        displayName: _displayNameController.text.trim().isEmpty 
            ? null 
            : _displayNameController.text.trim(),
      );
      if (mounted) context.go('/conversations');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Registration failed: ${e.toString()}')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/login'),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  const Text(
                    'Create Account',
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 32),
                  
                  TextFormField(
                    controller: _usernameController,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      hintText: '3-30 characters, alphanumeric + underscore',
                      prefixIcon: Icon(Icons.person),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().length < 3) {
                        return 'Username must be at least 3 characters';
                      }
                      if (!RegExp(r'^[a-zA-Z0-9_]+$').hasMatch(value.trim())) {
                        return 'Only letters, numbers, and underscores';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  TextFormField(
                    controller: _passwordController,
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      hintText: 'At least 6 characters',
                      prefixIcon: Icon(Icons.lock),
                    ),
                    obscureText: true,
                    validator: (value) {
                      if (value == null || value.length < 6) {
                        return 'Password must be at least 6 characters';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  
                  TextFormField(
                    controller: _displayNameController,
                    decoration: const InputDecoration(
                      labelText: 'Display Name (optional)',
                      prefixIcon: Icon(Icons.badge),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  ElevatedButton(
                    onPressed: authState.isLoading ? null : _handleRegister,
                    child: authState.isLoading
                        ? const CircularProgressIndicator()
                        : const Text('Register'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
```

**Dependencies**: `auth_provider.dart`, `app_colors.dart`

### Step 7.3: Conversations list screen

**File**: `flutter_app/lib/screens/conversations_list_screen.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../providers/providers.dart';
import '../widgets/avatar_circle.dart';
import '../core/theme/app_colors.dart';
import 'package:intl/intl.dart';

class ConversationsListScreen extends ConsumerStatefulWidget {
  const ConversationsListScreen({super.key});

  @override
  ConsumerState<ConversationsListScreen> createState() => _ConversationsListScreenState();
}

class _ConversationsListScreenState extends ConsumerState<ConversationsListScreen> {
  @override
  void initState() {
    super.initState();
    // Connect socket and load conversations
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(socketServiceProvider).connect();
      ref.read(chatProvider.notifier).loadConversations();
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final chatState = ref.watch(chatProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('RPG Chat'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await ref.read(socketServiceProvider).disconnect();
              await ref.read(authProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: chatState.conversations.isEmpty
          ? const Center(
              child: Text(
                'No conversations yet.\nStart one by searching users!',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.textSecondary),
              ),
            )
          : ListView.builder(
              itemCount: chatState.conversations.length,
              itemBuilder: (context, index) {
                final conv = chatState.conversations[index];
                final other = conv.otherUser;
                
                return ListTile(
                  leading: AvatarCircle(
                    avatarUrl: other.avatarUrl,
                    avatarColor: other.avatarColor,
                    username: other.username,
                    showOnlineIndicator: true,
                    isOnline: other.isOnline,
                  ),
                  title: Text(
                    other.displayNameOrUsername,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  subtitle: Text(
                    other.isOnline 
                        ? 'Online' 
                        : 'Last seen ${_formatLastSeen(other.lastSeenAt)}',
                    style: TextStyle(
                      color: other.isOnline 
                          ? AppColors.online 
                          : AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  trailing: conv.unreadCount > 0
                      ? Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: AppColors.accent,
                            shape: BoxShape.circle,
                          ),
                          child: Text(
                            conv.unreadCount.toString(),
                            style: const TextStyle(
                              color: AppColors.darkBackground,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        )
                      : null,
                  onTap: () {
                    context.go('/chat/${conv.id}');
                  },
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showStartConversationDialog(),
        child: const Icon(Icons.add),
      ),
    );
  }

  String _formatLastSeen(DateTime? lastSeen) {
    if (lastSeen == null) return 'unknown';
    final now = DateTime.now();
    final diff = now.difference(lastSeen);
    
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inHours < 1) return '${diff.inMinutes}m ago';
    if (diff.inDays < 1) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(lastSeen);
  }

  void _showStartConversationDialog() {
    final controller = TextEditingController();
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Start Conversation'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Enter username',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              final username = controller.text.trim();
              if (username.isNotEmpty) {
                ref.read(chatProvider.notifier).startConversation(username);
                Navigator.pop(context);
              }
            },
            child: const Text('Start'),
          ),
        ],
      ),
    );
  }
}
```

**Dependencies**: `auth_provider.dart`, `chat_provider.dart`, `providers.dart`, `avatar_circle.dart`, `app_colors.dart`

### Step 7.4: Chat screen with campfire scene

**File**: `flutter_app/lib/screens/chat_screen.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../providers/chat_provider.dart';
import '../widgets/campfire_scene.dart';
import '../widgets/message_bubble.dart';
import '../core/theme/app_colors.dart';
import 'dart:async';

class ChatScreen extends ConsumerStatefulWidget {
  final int conversationId;

  const ChatScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _typingDebounce;
  bool _isTyping = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(chatProvider.notifier).loadMessages(widget.conversationId);
      ref.read(chatProvider.notifier).markRead(widget.conversationId);
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    _typingDebounce?.cancel();
    super.dispose();
  }

  void _handleTyping() {
    if (!_isTyping) {
      _isTyping = true;
      ref.read(chatProvider.notifier).typing(widget.conversationId);
    }

    _typingDebounce?.cancel();
    _typingDebounce = Timer(const Duration(milliseconds: 300), () {
      _isTyping = false;
      ref.read(chatProvider.notifier).stopTyping(widget.conversationId);
    });
  }

  void _sendMessage() {
    final content = _messageController.text.trim();
    if (content.isEmpty) return;

    final conv = ref.read(chatProvider).conversations.firstWhere(
      (c) => c.id == widget.conversationId,
    );

    ref.read(chatProvider.notifier).sendMessage(
      conv.otherUser.id,
      content,
    );

    _messageController.clear();
    _isTyping = false;
    ref.read(chatProvider.notifier).stopTyping(widget.conversationId);
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final chatState = ref.watch(chatProvider);
    
    final conv = chatState.conversations.firstWhere(
      (c) => c.id == widget.conversationId,
      orElse: () => chatState.conversations.first,
    );
    
    final messages = chatState.messagesByConversation[widget.conversationId] ?? [];
    final isOtherTyping = chatState.typingUsers[widget.conversationId] != null;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/conversations'),
        ),
        title: Text(conv.otherUser.displayNameOrUsername),
      ),
      body: Column(
        children: [
          // Campfire scene (top 35%)
          CampfireScene(
            currentUser: authState.user!,
            otherUser: conv.otherUser,
            isOtherOnline: conv.otherUser.isOnline,
            isOtherTyping: isOtherTyping,
          ),
          
          // Messages list
          Expanded(
            child: messages.isEmpty
                ? const Center(
                    child: Text(
                      'No messages yet. Start the conversation!',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final message = messages[index];
                      final isSent = message.senderId == authState.user!.id;
                      
                      return MessageBubble(
                        message: message,
                        isSent: isSent,
                      );
                    },
                  ),
          ),
          
          // Input area
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: AppColors.inputBackground,
              border: Border(
                top: BorderSide(color: AppColors.divider),
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _messageController,
                    decoration: const InputDecoration(
                      hintText: 'Type a message...',
                      border: InputBorder.none,
                    ),
                    maxLines: null,
                    onChanged: (_) => _handleTyping(),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _sendMessage,
                  color: AppColors.primary,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

**Dependencies**: `auth_provider.dart`, `chat_provider.dart`, `campfire_scene.dart`, `message_bubble.dart`, `app_colors.dart`

---

## Sub-Phase 2.5.8: Navigation & App Entry

### Step 8.1: Router configuration

**File**: `flutter_app/lib/core/router/app_router.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../screens/login_screen.dart';
import '../../screens/register_screen.dart';
import '../../screens/conversations_list_screen.dart';
import '../../screens/chat_screen.dart';
import '../../providers/auth_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isLoggedIn = authState.user != null;
      final isLoggingIn = state.matchedLocation == '/login' || 
                          state.matchedLocation == '/register';

      if (!isLoggedIn && !isLoggingIn) {
        return '/login';
      }
      
      if (isLoggedIn && isLoggingIn) {
        return '/conversations';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/conversations',
        builder: (context, state) => const ConversationsListScreen(),
      ),
      GoRoute(
        path: '/chat/:id',
        builder: (context, state) {
          final id = int.parse(state.pathParameters['id']!);
          return ChatScreen(conversationId: id);
        },
      ),
    ],
  );
});
```

**Dependencies**: All screen files, `auth_provider.dart`

### Step 8.2: Main app entry

**File**: `flutter_app/lib/main.dart` (REPLACE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';
import 'providers/auth_provider.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  @override
  void initState() {
    super.initState();
    // Check if user is already logged in
    Future.microtask(() {
      ref.read(authProvider.notifier).checkAuth();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'RPG Chat',
      theme: AppTheme.darkTheme(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

**Dependencies**: `app_theme.dart`, `app_router.dart`, `auth_provider.dart`

---

## Sub-Phase 2.5.9: Integration & Testing

### Step 9.1: Handle WebSocket reconnection on token refresh

**File**: `flutter_app/lib/services/api_client.dart` (MODIFY)

Add after successful refresh in interceptor:

```dart
// Notify socket to reconnect
ref.read(socketServiceProvider).reconnectWithNewToken();
```

**Note**: This requires passing `ref` to ApiClient or using a callback pattern. Recommend using a global event bus or StateNotifier to trigger reconnection.

**Alternative approach** - Add to `auth_provider.dart`:

After token refresh in `checkAuth()`, call:
```dart
await ref.read(socketServiceProvider).reconnectWithNewToken();
```

### Step 9.2: Add auto-refresh timer

**File**: `flutter_app/lib/main.dart` (MODIFY _MyAppState)

Add timer in `initState`:

```dart
Timer.periodic(const Duration(minutes: 14), (_) async {
  final storage = ref.read(storageServiceProvider);
  final refreshToken = await storage.getRefreshToken();
  if (refreshToken != null) {
    try {
      final response = await ref.read(apiClientProvider).dio.post(
        ApiConstants.authRefresh,
        data: {'refreshToken': refreshToken},
      );
      await storage.saveTokens(
        accessToken: response.data['accessToken'],
        refreshToken: response.data['refreshToken'],
      );
      await ref.read(socketServiceProvider).reconnectWithNewToken();
    } catch (_) {
      // Token refresh failed, logout
      await ref.read(authProvider.notifier).logout();
    }
  }
});
```

### Step 9.3: Configure backend CORS for Flutter web

**File**: `C:\Users\Lentach\desktop\mvp-chat-app\.env` (MODIFY)

Change `CORS_ORIGIN` to allow Flutter web dev server:

```
CORS_ORIGIN=http://localhost:*
```

Or specific port:
```
CORS_ORIGIN=http://localhost:8080
```

### Step 9.4: Update docker-compose for development

**File**: `C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml` (MODIFY)

Ensure CORS allows Flutter dev:

```yaml
environment:
  CORS_ORIGIN: '*'  # For development only
```

---

## Sub-Phase 2.5.10: Avatar Upload & Sound Notifications

### Step 10.1: Image picker integration

**File**: `flutter_app/lib/screens/profile_screen.dart` (CREATE)

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../widgets/avatar_circle.dart';
import '../core/theme/app_colors.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  Future<void> _pickImage(BuildContext context, WidgetRef ref) async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
    );

    if (image != null) {
      try {
        await ref.read(authProvider.notifier).uploadAvatar(image.path);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Avatar uploaded!')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Upload failed: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final user = authState.user!;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/conversations'),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            GestureDetector(
              onTap: () => _pickImage(context, ref),
              child: Stack(
                children: [
                  AvatarCircle(
                    avatarUrl: user.avatarUrl,
                    avatarColor: user.avatarColor,
                    username: user.username,
                    size: 120,
                  ),
                  const Positioned(
                    bottom: 0,
                    right: 0,
                    child: CircleAvatar(
                      backgroundColor: AppColors.primary,
                      child: Icon(Icons.camera_alt, size: 20),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              user.displayNameOrUsername,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              '@${user.username}',
              style: const TextStyle(
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

Add route to `app_router.dart`:
```dart
GoRoute(
  path: '/profile',
  builder: (context, state) => const ProfileScreen(),
),
```

**Dependencies**: `auth_provider.dart`, `avatar_circle.dart`, `app_colors.dart`

### Step 10.2: Sound notification on new message

**File**: `flutter_app/lib/providers/chat_provider.dart` (MODIFY)

In `_setupListeners()`, modify `onNewMessage`:

```dart
_socketService.onNewMessage((message) {
  _addMessage(message);
  
  // Play sound if app is in background or different conversation
  ref.read(audioServiceProvider).playMessageSound();
});
```

### Step 10.3: Add audio asset

**File**: `flutter_app/pubspec.yaml` (MODIFY)

Add assets section:

```yaml
flutter:
  assets:
    - assets/sounds/message_beep.mp3
```

Create directory and add audio file:
```bash
mkdir -p flutter_app/assets/sounds
# Add message_beep.mp3 file (generate 8-bit RPG chime)
```

---

## Sub-Phase 2.5.11: Platform-Specific Build Configuration

### Step 11.1: Android build configuration

**File**: `flutter_app/android/app/build.gradle` (MODIFY)

Ensure minimum SDK:

```gradle
android {
    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 33
    }
}
```

### Step 11.2: iOS build configuration

**File**: `flutter_app/ios/Podfile` (MODIFY)

Uncomment platform:

```ruby
platform :ios, '12.0'
```

### Step 11.3: Web configuration

**File**: `flutter_app/web/index.html` (MODIFY)

Change title and add meta:

```html
<title>RPG Chat</title>
<meta name="description" content="Secure RPG-themed chat application">
```

---

## Sub-Phase 2.5.12: Docker & Deployment

### Step 12.1: Add Flutter web build to backend Docker

**File**: `C:\Users\Lentach\desktop\mvp-chat-app\Dockerfile` (MODIFY)

Add Flutter build stage:

```dockerfile
# Stage 1: Build Flutter web
FROM ghcr.io/cirruslabs/flutter:stable AS flutter-build
WORKDIR /flutter_app
COPY flutter_app/pubspec.yaml flutter_app/pubspec.lock ./
RUN flutter pub get
COPY flutter_app/ ./
RUN flutter build web --release

# Stage 2: Build NestJS
FROM node:18-alpine AS nest-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=nest-build /app/dist ./dist
COPY --from=nest-build /app/node_modules ./node_modules
COPY --from=flutter-build /flutter_app/build/web ./dist/public
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/main"]
```

**Note**: This serves Flutter web build from NestJS static files.

### Step 12.2: Update NestJS to serve Flutter build

**File**: `C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts` (MODIFY)

Change static assets path:

```typescript
app.useStaticAssets(join(__dirname, '..', 'public'));
app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
```

---

## Verification Checklist

After implementation:

1. **Backend running**: `docker-compose up --build`
2. **Flutter dev (mobile)**: `cd flutter_app && flutter run`
3. **Flutter dev (web)**: `cd flutter_app && flutter run -d chrome`
4. **Register** new account from Flutter app
5. **Login** and verify JWT stored securely
6. **Upload avatar** from gallery/camera
7. **Start conversation** with another user
8. **Send messages** in real-time
9. **Verify campfire scene** renders with avatars
10. **Test typing indicators** appear as bubbles
11. **Check online/offline** status updates
12. **Test read receipts** (double checkmarks)
13. **Verify sound** plays on new message
14. **Test token auto-refresh** (wait 14 min or mock)
15. **Build APK**: `flutter build apk`
16. **Build iOS**: `flutter build ios` (requires macOS)

---

## Critical Files for Implementation

- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\pubspec.yaml` - Dependency manifest, must configure all packages
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\main.dart` - App entry point with Riverpod setup and auto-refresh
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\services\socket_service.dart` - WebSocket client managing all real-time events
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\providers\chat_provider.dart` - Central state for messages, conversations, typing, online status
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\widgets\campfire_scene.dart` - Core UI feature with animated campfire and avatars
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\screens\chat_screen.dart` - Main chat interface combining campfire scene + messages
- `C:\Users\Lentach\desktop\mvp-chat-app\flutter_app\lib\services\api_client.dart` - Dio client with automatic JWT refresh interceptor