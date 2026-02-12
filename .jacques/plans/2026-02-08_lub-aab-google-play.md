# lub AAB (Google Play)
flutter build appbundle --dart-define=BASE_URL=https://twoja-app.onrender.com
```

### 5. iOS Signing (App Store)

**Development (Personal Team):** Bezpłatny Apple ID, max 7 dni validity, tylko personal devices

**Production (Apple Developer Program):** $99/rok, pełne provisioning profiles, App Store distribution

**Kroki:**
1. Enroll in Apple Developer Program: https://developer.apple.com/programs/
2. Xcode → Signing & Capabilities → Team: wybierz płatny team
3. Xcode → Product → Archive → Distribute App → App Store Connect
4. App Store Connect: dodaj screenshots, opis, submit for review

### 6. Android Signing (Google Play)

**Generowanie keystore:**
```bash
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

**Konfiguracja:** `frontend/android/key.properties`
```properties
storePassword=<password>
keyPassword=<password>
keyAlias=upload
storeFile=C:/Users/YourName/upload-keystore.jks
```

**Build signed AAB:**
```bash
flutter build appbundle --dart-define=BASE_URL=https://twoja-app.onrender.com
```

**Upload:** Google Play Console → Create app → Upload AAB

### 7. Checklist przed publikacją

- [ ] Backend na HTTPS (Render.com lub inny)
- [ ] Usuń `NSAllowsArbitraryLoads` z Info.plist
- [ ] Usuń `usesCleartextTraffic` z AndroidManifest.xml
- [ ] Update BASE_URL na production URL
- [ ] Test E2E na production backend
- [ ] iOS signing (Apple Developer)
- [ ] Android signing (keystore)
- [ ] App Store screenshots + opis
- [ ] Google Play screenshots + opis
- [ ] Privacy Policy (wymagane dla obu stores)
- [ ] Test avatar upload (Cloudinary production)
- [ ] Test Socket.IO (production backend)
- [ ] Beta testing (TestFlight/Internal Testing)

### Android Alternative (jeśli nie masz Androida)
Wszystkie zmiany Android są już w planie - gdy będziesz testować na Android (emulator lub fizyczne urządzenie), po prostu użyj tego samego `flutter run` command z Android device ID.

### Hot Reload
Debug build obsługuje hot reload - po zmianach w kodzie Dart naciśnij `r` w terminalu (hot reload) lub `R` (hot restart).

## Timeline
- Znalezienie IP + zmiana .env: **2 min**
- iOS/Android config changes: **5 min**
- iOS Xcode setup (signing): **5-10 min** (pierwszy raz)
- Flutter run + test: **5 min**
- **Total: ~20-25 min** (pierwszy raz)

## Ryzyko
- **Xcode signing**: Jeśli nie masz Apple ID dodanego w Xcode, trzeba go dodać (Preferences → Accounts)
- **USB trust**: Pierwszy raz wymaga "Trust This Computer" na iPhonie
- **Firewall**: Windows Defender może blokować port 3000 - dodaj regułę jeśli problem
- **Flutter devices**: Jeśli `flutter devices` nie widzi iPhone, sprawdź czy iTunes/Apple Devices jest zainstalowane (Windows)


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\6f22bc08-6066-404e-a5af-bce2d7f55d2b.jsonl