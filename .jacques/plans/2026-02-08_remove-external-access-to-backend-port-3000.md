# Plan: Remove external access to backend port 3000

## Problem
Port 3000 (NestJS backend) is exposed externally in `docker-compose.yml`, allowing direct browser access. The Flutter frontend on port 8080 already proxies all API (`/auth/`) and WebSocket (`/socket.io/`) requests to the backend internally via nginx. There's no need to expose port 3000 to the host.

## Changes

### 1. `docker-compose.yml` — remove external port mapping for backend
- Remove `ports: - '3000:3000'` from the `backend` service
- The backend remains accessible to the frontend container via Docker's internal network (`http://backend:3000`)
- Add `expose: - '3000'` to document the internal port (optional but good practice)

## Verification
1. Run `docker-compose down && docker-compose up --build`
2. Confirm `http://localhost:3000` is no longer accessible
3. Confirm `http://localhost:8080` serves the Flutter app and API/WebSocket requests work through nginx proxy
