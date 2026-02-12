# Explore: Explore app network config

> Session: `4b993f03-5d1e-4623-a624-616dd7a5a9bc`
> Date: 2026-01-28
> Tokens: ~14,580

---

Perfect! I've now gathered all the network configuration information. Let me compile a comprehensive report.

## Network Configuration Analysis Report

I've thoroughly examined the NestJS chat app's network configuration. Here are my findings:

### 1. **src/main.ts - Server Listen Binding**
**File:** C:\Users\Lentach\desktop\mvp-chat-app\src\main.ts

The server listens on:
```typescript
const port = process.env.PORT || 3000;
await app.listen(port);
```

**Issue Found (Line 19):**
```typescript
console.log(`Server running on http://localhost:${port}`);
```

This is a **hardcoded "localhost" reference**, but it's only in a console.log message (non-functional). The actual `app.listen(port)` without specifying a host means the server binds to `0.0.0.0` (all interfaces), making it accessible from the network. However, the console message is misleading.

---

### 2. **docker-compose.yml - Port Mappings**
**File:** C:\Users\Lentach\desktop\mvp-chat-app\docker-compose.yml

Port configuration:
```yaml
services:
  app:
    ports:
      - '3000:3000'
```

**Good:** The port mapping `3000:3000` exposes the app on all interfaces within the Docker network. No localhost restriction here.

The database also uses service name `db` (not localhost):
```yaml
environment:
  DB_HOST: db
```

---

### 3. **src/public/index.html - Frontend Connection**
**File:** C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html

**Critical Issue Found (Line 501):**
```javascript
const API = '';
```

The API is set to an **empty string**, which means all API calls use **relative URLs**:
- `fetch(API + '/auth/register')` becomes `fetch('/auth/register')`
- `fetch(API + '/auth/login')` becomes `fetch('/auth/login')`

**WebSocket Connection (Lines 594-596):**
```javascript
socket = io(window.location.origin, {
  auth: { token },
  query: { token }
});
```

**Good:** Uses `window.location.origin`, which automatically adapts to whatever host/port the HTML was loaded from. This is network-friendly.

**Summary:** The frontend uses relative URLs for REST calls and `window.location.origin` for WebSocket, so it will work from any device on the same network.

---

### 4. **src/chat/chat.gateway.ts - CORS Settings**
**File:** C:\Users\Lentach\desktop\mvp-chat-app\src\chat\chat.gateway.ts

**WebSocket CORS Configuration (Line 17):**
```typescript
@WebSocketGateway({ cors: { origin: '*' } })
```

**Issue Found:** CORS is set to `'*'` (wildcard), which allows connections from **any origin**. There's a comment acknowledging this is for MVP:
```typescript
// cors: '*' — simplified for MVP, set a specific domain in production
```

This is permissive but intentional for development.

---

### 5. **Dockerfile - Exposed Ports**
**File:** C:\Users\Lentach\desktop\mvp-chat-app\Dockerfile

```dockerfile
EXPOSE 3000
```

**Good:** Exposes port 3000 to the Docker network without any localhost restriction.

---

## Summary of Hardcoded "localhost" References

| File | Line | Reference | Impact | Severity |
|------|------|-----------|--------|----------|
| src/main.ts | 19 | `console.log('http://localhost:${port}')` | Console message only; misleading but non-functional | Low |
| **None found** | - | **No other hardcoded localhost references** | - | - |

### Key Finding:
**The app is actually network-accessible!** The only hardcoded "localhost" is in a console.log message for user feedback. The actual server binding and frontend connection logic use proper network-friendly approaches:
- Server uses `app.listen(port)` without host restriction (binds to 0.0.0.0)
- Frontend uses `window.location.origin` for WebSocket
- Frontend uses relative URLs for REST calls
- CORS allows all origins

**Devices on the same network can access the app** by navigating to `http://<server-ip>:3000` (e.g., `http://192.168.1.100:3000`).