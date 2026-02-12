# Explore: Explore old static files in backend

> Session: `be787bf3-df9a-4d6c-83a7-8fbf6476b03a`
> Date: 2026-01-29
> Tokens: ~38,324

---

Perfect! Now I have a comprehensive understanding. Let me create a summary report of my findings.

## Investigation Report: Old HTML Page Being Served on Port 3000

Based on my thorough exploration of the codebase, here are my findings:

### Summary
The NestJS backend on port 3000 is **NOT currently configured to serve any static HTML file**. The old RPG-themed HTML page that was previously at `src/public/index.html` has been deleted from the working tree (marked as `D src/public/index.html` in git status).

### Key Findings

**1. Backend Source Code Structure**
- Backend: `/backend/src/` contains only TypeScript modules:
  - `app.module.ts` - Main app module with database and feature imports
  - `auth/` - Authentication module
  - `chat/` - WebSocket gateway (Socket.IO)
  - `conversations/` - Conversation entity and service
  - `messages/` - Message entity and service
  - `users/` - User entity and service
  - No `public/` or `static/` directory exists

**2. Backend Entry Point (`main.ts`)**
Located at: `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\main.ts`

The server only:
- Creates the NestJS app
- Applies ValidationPipe
- Enables CORS with `origin: '*'`
- Listens on port 3000

**No static file serving is configured.** There are no calls to `express.static()`, `ServeStaticModule`, or any file-serving middleware.

**3. Backend AppModule (`app.module.ts`)**
Located at: `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\app.module.ts`

Only imports:
- TypeOrmModule (PostgreSQL configuration)
- AuthModule
- UsersModule
- ConversationsModule
- MessagesModule
- ChatModule

**No ServeStaticModule import** - this is the NestJS module that would serve static files.

**4. Backend Package.json**
Located at: `C:\Users\Lentach\desktop\mvp-chat-app\backend\package.json`

Dependencies do NOT include:
- `@nestjs/serve-static` (the package needed to serve static files)

**5. Old Public HTML File**
The deleted file was: `C:\Users\Lentach\desktop\mvp-chat-app\src\public\index.html` (at project root)
- Git status shows: `D src/public/index.html`
- This file existed in the last two commits
- It contains an RPG-themed HTML page with Socket.IO client-side code
- **Currently deleted and not present in any backend directory**

**6. Frontend Structure**
The Flutter frontend has its own HTML files:
- `/frontend/web/index.html` - Flutter template placeholder
- `/frontend/build/web/index.html` - Built Flutter app (also a placeholder, actual app is JavaScript)
- `/frontend/nginx.conf` - Nginx config that:
  - Serves Flutter web app on port 8080 (line 80)
  - Proxies `/auth/*` requests to backend:3000
  - Proxies `/socket.io/*` requests to backend:3000

### Conclusion

**The backend is NOT serving the old HTML page.** The problem likely occurs when:
1. You access `http://localhost:3000` directly without specifying a route
2. NestJS/Express by default returns a 404 or an HTML error page
3. Or there's a mismatch in how the frontend is configured to communicate with the backend

**Recommendation:**
If you're seeing an old HTML page on port 3000, it's either:
- Cached in your browser
- Being served by a different service/process
- The backend was previously compiled with static file serving that's now being used from dist/
- A middleware or configuration issue in a running container

You may want to verify by checking:
1. Browser network tab to confirm the actual response headers and content
2. If `dist/public/` exists in the running container
3. Whether the old backend code is still running from a cached build