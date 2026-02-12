# Explore: Find Polish text in codebase

> Session: `4b993f03-5d1e-4623-a624-616dd7a5a9bc`
> Date: 2026-01-28
> Tokens: ~15,651

---

Perfect! I found Polish language text throughout the codebase. Let me compile the complete findings excluding node_modules:

## Polish Language Text Found in Codebase

The codebase contains extensive Polish language comments and text. Here are all the files with Polish content:

### 1. **docker-compose.yml**
- Line 1: `# docker-compose.yml — uruchamia PostgreSQL + aplikację NestJS`
- Line 3: `# Baza danych PostgreSQL`
- Line 15: `# Aplikacja NestJS`

### 2. **README.md**
- Line 3: `Aplikacja do czatu 1-na-1 w czasie rzeczywistym. Backend oparty na NestJS z komunikacja WebSocket (Socket.IO), autoryzacja JWT i baza PostgreSQL. Calosc uruchamiana jednym poleceniem dzieki Docker Compose.`
- Line 12: `| Baza danych    | PostgreSQL 16                |`
- Line 33: `Aplikacja bedzie dostepna pod adresem **http://localhost:3000**`
- Line 87: `Odpowiedz zwraca `access_token` (JWT), ktorego uzywasz do polaczenia WebSocket.`
- Line 106: `| `startConversation`     | `{ recipientEmail }`                   | Rozpocznij rozmowe po emailu      |`
- Line 107: `| `getMessages`           | `{ conversationId }`                   | Pobierz historie wiadomosci       |`
- Line 108: `| `getConversations`      | *(brak)*                               | Pobierz liste konwersacji         |`
- Line 114: `| `messageHistory`        | Historia wiadomosci konwersacji        |`
- Line 115: `| `conversationsList`     | Lista konwersacji uzytkownika          |`

### 3. **src/app.module.ts**
- Line 14: `// TypeORM automatycznie tworzy tabele (synchronize: true).`
- Line 15: `// W produkcji wyłącz synchronize i używaj migracji!`

### 4. **src/public/index.html**
- Line 217: `/* Sidebar — lista konwersacji / nowy czat */`
- Line 340: `/* Moja wiadomość — wyrównana do prawej, złoty border */`

### 5. **src/auth/strategies/jwt.strategy.ts**
- Line 7: `// i wstrzykuje dane użytkownika do request.user`
- Line 18: `// Zwracamy obiekt użytkownika, który trafi do request.user.`

### 6. **src/messages/messages.service.ts**
- Line 24: `// Ostatnie 50 wiadomości z konwersacji, od najstarszej do najnowszej.`

### 7. **src/main.ts**
- Line 11: `// whitelist: true — ignoruje pola których nie ma w DTO (bezpieczeństwo).`

### 8. **src/chat/chat.gateway.ts**
- Line 16: `// cors: '*' — uproszczenie dla MVP, w produkcji ustaw konkretną domenę`
- Line 22: `// Mapa: userId -> socketId, żeby wiedzieć kto jest online`
- Line 32: `// Przy połączeniu WebSocket — weryfikujemy JWT token.`
- Line 33: `// Klient wysyła token w query: ?token=xxx`
- Line 34: `// Uproszczenie: w produkcji lepiej użyć middleware lub handshake headers.`
- Line 54: `// Zapisujemy dane użytkownika w obiekcie socketa`
- Line 71: `// Klient wysyła: { recipientId: number, content: string }`
- Line 73: `//   1. Znajduje lub tworzy konwersację`
- Line 74: `//   2. Zapisuje wiadomość w bazie`
- Line 75: `//   3. Wysyła wiadomość do odbiorcy (jeśli jest online)`
- Line 93: `// Znajdź lub utwórz konwersację między tymi dwoma użytkownikami`
- Line 99: `// Zapisz wiadomość w PostgreSQL`
- Line 115: `// Wyślij do odbiorcy jeśli jest online`
- Line 125: `// Rozpocznij konwersację po emailu — frontend wysyła email drugiego użytkownika`
- Line 152: `// Odśwież listę konwersacji dla nadawcy`
- Line 162: `// Automatycznie otwórz nową konwersację`
- Line 166: `// Pobierz historię wiadomości danej konwersacji`
- Line 188: `// Pobierz listę konwersacji użytkownika`

### 9. **src/auth/auth.service.ts**
- Line 15: `// Nie zwracamy hasła w odpowiedzi`
- Line 30: `// Payload tokena — sub to standard JWT dla "subject" (id użytkownika)`

### 10. **src/auth/auth.controller.ts**
- Line 10: `// POST /auth/register — tworzy nowego użytkownika`
- Line 16: `// POST /auth/login — zwraca JWT token`

### 11. **src/conversations/conversation.entity.ts**
- Line 10: `// Konwersacja łączy dwóch użytkowników.`

### 12. **src/conversations/conversations.service.ts**
- Line 14: `// Szukamy istniejącej konwersacji między dwoma użytkownikami.`
- Line 15: `// Jeśli nie ma — tworzymy nową. Dzięki temu nie powstają duplikaty.`
- Line 34: `// Wszystkie konwersacje danego użytkownika`

**Summary:** The entire codebase is written in Polish, including comments in source files (TypeScript, HTML), configuration files (YAML), and documentation (Markdown). The Polish text is predominantly technical comments explaining the functionality and architecture of the chat application.