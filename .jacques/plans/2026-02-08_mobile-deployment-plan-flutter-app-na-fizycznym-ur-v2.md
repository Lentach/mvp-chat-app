# Mobile Deployment Plan - Flutter App na Fizycznym Urządzeniu

**Data utworzenia:** 2026-02-04
**Status:** Draft - do implementacji
**Cel:** Uruchomić aplikację Flutter na fizycznym telefonie (iOS + Android) w trybie debug z backendem działającym na komputerze w lokalnej sieci WiFi.

## Spis Treści
1. [Obecna Konfiguracja](#obecna-konfiguracja)
2. [Problem i Rozwiązanie](#problem-i-rozwiązanie)
3. [Implementacja - Kod](#implementacja---kod)
4. [Procedura Uruchomienia](#procedura-uruchomienia)
5. [Weryfikacja](#weryfikacja)
6. [Troubleshooting](#troubleshooting)
7. [Produkcja - Następne Kroki](#produkcja---następne-kroki)

## Obecna Konfiguracja

### Frontend (Flutter)
- **BASE_URL**: `frontend/lib/config/app_config.dart` używa `String.fromEnvironment('BASE_URL', defaultValue: 'http://localhost:3000')`
- Przekazywane przez `--dart-define=BASE_URL=...` przy `flutter run`

### Backend (NestJS)
- **CORS**: `backend/src/main.ts` czyta `ALLOWED_ORIGINS` z `.env`
- Obecna wartość: `ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080`

### iOS (frontend/ios/Runner/Info.plist)
- ❌ **BRAK** `NSAppTransportSecurity` - iOS domyślnie blokuje HTTP connections
- ❌ **BRAK** camera/photo permissions (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`) - potrzebne dla `image_picker`

### Android (frontend/android/app/src/main/AndroidManifest.xml)
- ❌ **BRAK** `<uses-permission android:name="android.permission.INTERNET"/>` - wymagane dla http/socket.io
- ❌ **BRAK** `android:usesCleartextTraffic="true"` - Android 9+ blokuje HTTP
- ❌ **BRAK** camera/photo permissions - potrzebne dla `image_picker`

## Problem
- Telefon nie ma dostępu do `localhost` - to odnosi się do samego telefonu, nie komputera
- iOS/Android blokują HTTP connections (tylko HTTPS)
- Brak permissions dla kamery/galerii (avatar update nie będzie działać)

## Implementacja - Kod

Wszystkie zmiany w plikach konfiguracyjnych. **3 pliki do edycji:**

### 1. Backend CORS - `.env`

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\.env`

**Zmiana:** Dodaj IP komputera do `ALLOWED_ORIGINS`

**PRZED:**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
```

**PO (przykład z IP 192.168.1.100):**
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://192.168.1.100:3000
```

**❗ Ważne:** Zastąp `192.168.1.100` swoim IP z `ipconfig` (Windows) lub `ifconfig` (Mac/Linux).

### 2. iOS - `frontend/ios/Runner/Info.plist`

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\ios\Runner\Info.plist`

**Zmiana:** Dodaj NSAppTransportSecurity + camera/photo permissions

**Dodaj przed zamykającym `</dict>` (linia 48):**

```xml
	<!-- Allow HTTP connections to local IP (development only) -->
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
	<!-- Camera permission for avatar upload -->
	<key>NSCameraUsageDescription</key>
	<string>Aplikacja potrzebuje dostępu do kamery, aby zaktualizować zdjęcie profilowe.</string>
	<!-- Photo library permission for avatar upload -->
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Aplikacja potrzebuje dostępu do galerii, aby wybrać zdjęcie profilowe.</string>
```

### 3. Android - `frontend/android/app/src/main/AndroidManifest.xml`

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\android\app\src\main\AndroidManifest.xml`

**Zmiana A:** Dodaj permissions po `<manifest>` (przed `<application>`):

```xml
    <!-- Network access for API + Socket.IO -->
    <uses-permission android:name="android.permission.INTERNET"/>

    <!-- Camera/Photo permissions for avatar upload -->
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="28"/>
```

**Zmiana B:** Dodaj `android:usesCleartextTraffic="true"` w `<application>`:

```xml
    <application
        android:label="frontend"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true">
```

---

## Procedura Uruchomienia

### Krok 1: Znajdź IP Komputera
Telefon musi łączyć się z IP komputera w lokalnej sieci.

**Windows:**
```bash
ipconfig
```
Szukaj `IPv4 Address` w sekcji `Wireless LAN adapter Wi-Fi` (np. `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Przykładowy IP: `192.168.1.100`

### Krok 2: Backend - Dodaj IP do CORS

**Plik:** `.env`

```diff
- ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
+ ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://192.168.1.100:3000
```

Zastąp `192.168.1.100` swoim IP z Kroku 1.

**Restart backend:**
```bash
docker-compose down
docker-compose up -d
```

### Krok 3: iOS - HTTP Exception + Permissions

**Plik:** `frontend/ios/Runner/Info.plist`

**PRZED (ostatnie linie pliku):**
```xml
	<key>CADisableMinimumFrameDurationOnPhone</key>
	<true/>
	<key>UIApplicationSupportsIndirectInputEvents</key>
	<true/>
</dict>
</plist>
```

**PO (dodaj przed zamykającym `</dict>`):**
```xml
	<key>CADisableMinimumFrameDurationOnPhone</key>
	<true/>
	<key>UIApplicationSupportsIndirectInputEvents</key>
	<true/>
	<!-- Allow HTTP connections to local IP (development only) -->
	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsArbitraryLoads</key>
		<true/>
	</dict>
	<!-- Camera permission for avatar upload -->
	<key>NSCameraUsageDescription</key>
	<string>Aplikacja potrzebuje dostępu do kamery, aby zaktualizować zdjęcie profilowe.</string>
	<!-- Photo library permission for avatar upload -->
	<key>NSPhotoLibraryUsageDescription</key>
	<string>Aplikacja potrzebuje dostępu do galerii, aby wybrać zdjęcie profilowe.</string>
</dict>
</plist>
```

**Uwaga:** `NSAllowsArbitraryLoads = true` wyłącza ATS (App Transport Security) dla WSZYSTKICH connections. W produkcji użyj `NSExceptionDomains` dla konkretnego IP lub HTTPS.

### Krok 4: Android - Permissions + HTTP

**Plik:** `frontend/android/app/src/main/AndroidManifest.xml`

**PRZED (cały plik):**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application
        android:label="frontend"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <activity
            ...
        </activity>
        ...
    </application>
    <queries>
        ...
    </queries>
</manifest>
```

**PO (pełny nowy plik):**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Network access for API + Socket.IO -->
    <uses-permission android:name="android.permission.INTERNET"/>

    <!-- Camera/Photo permissions for avatar upload -->
    <uses-permission android:name="android.permission.CAMERA"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="28"/>

    <application
        android:label="frontend"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:taskAffinity=""
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme"
              />
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
    <queries>
        <intent>
            <action android:name="android.intent.action.PROCESS_TEXT"/>
            <data android:mimeType="text/plain"/>
        </intent>
    </queries>
</manifest>
```

**Kluczowe zmiany:**
1. Dodane 4 permissions na początku (INTERNET, CAMERA, READ/WRITE_EXTERNAL_STORAGE)
2. Dodane `android:usesCleartextTraffic="true"` w `<application>` - pozwala na HTTP connections (Android 9+)

### Krok 5: iOS Setup - Xcode + Device

**A) Otwórz projekt w Xcode:**
```bash
cd frontend/ios
open Runner.xcworkspace
```

**B) Podłącz iPhone przez USB** i odblokuj telefon.

**C) W Xcode:**
1. Wybierz swoje urządzenie w górnym menu (obok "Runner")
2. **Signing & Capabilities** → Team: wybierz swój Apple ID (bezpłatny Personal Team)
3. Bundle Identifier: zmień na unikalny (np. `com.twojanazwa.frontend`)

**D) Trust Developer na iPhonie:**
Po pierwszym uruchomieniu: Ustawienia → Ogólne → VPN i zarządzanie urządzeniami → zaufaj developerowi

### Krok 6: Flutter Run z BASE_URL

**Terminal (Windows PowerShell):**
```bash
cd frontend