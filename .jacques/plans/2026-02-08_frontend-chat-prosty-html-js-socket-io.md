# Frontend Chat — prosty HTML/JS + Socket.IO

**Goal:** Stworzyć minimalny frontend czatu (1 plik HTML) serwowany przez NestJS, z logowaniem, rejestracją i czatem real-time.

## Plan

1. Stworzyć `src/public/index.html` — cały frontend w jednym pliku:
   - Formularz rejestracji i logowania
   - Panel czatu: lista konwersacji, okno wiadomości, pole do wysyłania
   - Socket.IO client (CDN)
   - Vanilla JS — fetch do `/auth/*`, Socket.IO do czatu

2. Zaktualizować `src/main.ts` — dodać serwowanie plików statycznych z folderu `public` (`app.useStaticAssets`)

3. Zaktualizować `Dockerfile` — skopiować folder public do dist

## Pliki do utworzenia/zmiany
- Create: `src/public/index.html`
- Modify: `src/main.ts` (dodać static assets)

## Weryfikacja
- Wejść na `http://localhost:3000` — widać stronę czatu
- Rejestracja i logowanie działają
- Wysyłanie wiadomości między dwoma użytkownikami działa
