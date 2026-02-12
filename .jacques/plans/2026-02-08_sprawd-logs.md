# Sprawdź logs
docker logs mvp-chat-app-backend-1 --tail 50
```

---

## Pliki do Modyfikacji (Podsumowanie)

| Plik | Zmiana | Czas |
|------|--------|------|
| `.env` | Dodaj IP do `ALLOWED_ORIGINS` | 1 min |
| `frontend/ios/Runner/Info.plist` | NSAppTransportSecurity + camera/photo permissions | 2 min |
| `frontend/android/app/src/main/AndroidManifest.xml` | INTERNET + usesCleartextTraffic + camera/photo permissions | 2 min |

## Uwagi

### Produkcja - Następne Kroki

Ten setup jest **TYLKO dla development**. Przed publikacją w App Store/Google Play:

### 1. Backend Deployment (Render.com)

**Co zrobić:**
- Deploy backend na Render.com z managed PostgreSQL
- Render auto-SSL (HTTPS)
- Update `ALLOWED_ORIGINS` w Render.com environment variables:
  ```
  ALLOWED_ORIGINS=https://twoja-domena.com
  ```

**Backend URL:** `https://twoja-app.onrender.com`

### 2. iOS - Usuń HTTP Exception

**Plik:** `frontend/ios/Runner/Info.plist`

**USUŃ (lub zamień na NSExceptionDomains dla dev):**
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>  <!-- ❌ Nie akceptowane w App Store review! -->
</dict>
```

**Produkcja:** Użyj HTTPS URL, ATS będzie działać automatycznie.

**Development (alternatywa):** Jeśli chcesz mieć HTTP tylko dla local IP:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSExceptionDomains</key>
    <dict>
        <key>192.168.1.100</key>
        <dict>
            <key>NSExceptionAllowsInsecureHTTPLoads</key>
            <true/>
        </dict>
    </dict>
</dict>
```

### 3. Android - Usuń usesCleartextTraffic

**Plik:** `frontend/android/app/src/main/AndroidManifest.xml`

**USUŃ:**
```xml
android:usesCleartextTraffic="true"  <!-- ❌ Nie zalecane w produkcji! -->
```

**Produkcja:** Użyj HTTPS URL, cleartext nie będzie potrzebny.

### 4. Flutter Build - Production BASE_URL

**Debug (development):**
```bash
flutter run --dart-define=BASE_URL=http://192.168.1.100:3000
```

**Release (production):**
```bash