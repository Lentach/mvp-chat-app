# Jeśli nie, restart usbmuxd
sudo killall -STOP -c usbd
```

### Problem 2: "Network error" / "Connection refused"

**Objawy:** App się otwiera, ale login fails z "Network error" lub "Connection refused"

**Przyczyny:**
- Telefon i komputer w **różnych sieciach WiFi**
- Firewall blokuje port 3000
- Zły IP w BASE_URL

**Rozwiązanie:**
1. **Sprawdź sieć:**
   - Telefon: Settings → WiFi → sprawdź nazwę sieci
   - Komputer: Sprawdź czy jesteś w tej samej sieci
2. **Sprawdź firewall (Windows):**
   ```powershell
   # Dodaj regułę dla port 3000
   netsh advfirewall firewall add rule name="Flutter Backend" dir=in action=allow protocol=TCP localport=3000
   ```
3. **Sprawdź IP:**
   ```bash
   # Powinno być 192.168.x.x (local network)
   ipconfig
   ```
4. **Sprawdź backend:**
   ```bash
   docker ps  # Backend powinien być RUNNING
   curl http://192.168.1.100:3000  # Zamień IP
   ```

### Problem 3: iOS - "App Transport Security has blocked a cleartext HTTP"

**Objawy:** App crash lub error w Xcode console:
```
NSURLConnection error: -1022
App Transport Security has blocked a cleartext HTTP (http://) resource load...
```

**Przyczyna:** Nie dodałeś `NSAppTransportSecurity` do Info.plist

**Rozwiązanie:** Dodaj do `frontend/ios/Runner/Info.plist` (zobacz [Implementacja - Kod](#implementacja---kod))

### Problem 4: Android - "CLEARTEXT communication not permitted"

**Objawy:** App crash lub logcat error:
```
CLEARTEXT communication to 192.168.1.100 not permitted by network security policy
```

**Przyczyna:** Nie dodałeś `android:usesCleartextTraffic="true"`

**Rozwiązanie:** Dodaj w `<application>` tag w AndroidManifest.xml (zobacz [Implementacja - Kod](#implementacja---kod))

### Problem 5: Xcode - "Signing for Runner requires a development team"

**Objawy:** Xcode build fails:
```
error: Signing for "Runner" requires a development team. Select a development team in the Signing & Capabilities editor.
```

**Rozwiązanie:**
1. Otwórz `frontend/ios/Runner.xcworkspace` w Xcode
2. Kliknij **Runner** (blue icon) w lewym panelu
3. **Signing & Capabilities** tab
4. **Team:** wybierz swój Apple ID (dodaj w Xcode → Preferences → Accounts jeśli nie ma)
5. **Bundle Identifier:** zmień na unikalny (np. `com.twojanazwa.frontend`)

### Problem 6: "Camera permission denied" / Crash on avatar tap

**Objawy:** App crashuje gdy tap na avatar lub pokazuje "Permission denied"

**Przyczyna:** Nie dodałeś camera/photo permissions

**Rozwiązanie:**
- **iOS:** Dodaj `NSCameraUsageDescription` i `NSPhotoLibraryUsageDescription` do Info.plist
- **Android:** Dodaj `CAMERA` i `READ_EXTERNAL_STORAGE` permissions do AndroidManifest.xml
- Zobacz [Implementacja - Kod](#implementacja---kod)

### Problem 7: CORS error w backend logs

**Objawy:** Backend logs pokazują:
```
Access to XMLHttpRequest at 'http://192.168.1.100:3000/auth/login' from origin 'http://192.168.1.50:3000' has been blocked by CORS policy
```

**Przyczyna:** IP telefonu nie jest w `ALLOWED_ORIGINS`

**Rozwiązanie:**
1. Znajdź IP telefonu (Settings → WiFi → (i) icon → IP Address)
2. Dodaj IP do `.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://192.168.1.100:3000,http://192.168.1.50:3000
   ```
3. Restart backend: `docker-compose restart backend`

### Problem 8: Backend nie startuje po zmianie .env

**Rozwiązanie:**
```bash