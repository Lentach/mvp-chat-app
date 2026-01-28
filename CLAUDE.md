# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MVP 1-on-1 chat application backend. NestJS + PostgreSQL + WebSocket (Socket.IO) + JWT auth + Docker.

## Commands

```bash
npm run build          # Compile TypeScript
npm run start:dev      # Run with hot-reload (needs local PostgreSQL)
npm run start          # Run compiled version
npm run lint           # ESLint
docker-compose up --build   # Run app + PostgreSQL in Docker (recommended)
```

## Architecture

**Monolith NestJS app** with these modules:

- `AuthModule` — registration (POST /auth/register) and login (POST /auth/login) with JWT. Uses Passport + bcrypt.
- `UsersModule` — User entity and service. Shared dependency for Auth and Chat.
- `ConversationsModule` — Conversation entity linking two users. findOrCreate pattern prevents duplicates.
- `MessagesModule` — Message entity with content, sender, conversation FK.
- `ChatModule` — WebSocket Gateway (Socket.IO). Handles real-time messaging. Verifies JWT on connection via query param `?token=`.

**Data flow for sending a message:**
Client connects via WebSocket with JWT token → emits `sendMessage` with `{recipientId, content}` → Gateway finds/creates conversation → saves message to PostgreSQL → emits `newMessage` to recipient socket (if online) + `messageSent` confirmation to sender.

**WebSocket events:** `sendMessage`, `getMessages`, `getConversations`, `newMessage`, `messageSent`, `messageHistory`, `conversationsList`.

## Database

PostgreSQL with TypeORM. `synchronize: true` auto-creates tables (dev only).
Three tables: `users`, `conversations` (user_one_id, user_two_id), `messages` (sender_id, conversation_id, content).

## Environment variables

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET`, `PORT` — all have defaults for local dev.
