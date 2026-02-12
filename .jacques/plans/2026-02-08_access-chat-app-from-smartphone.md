# Plan: Access chat app from smartphone

## Context
The app is already network-friendly — no code changes needed. The frontend uses `window.location.origin` and relative URLs, so it adapts to any host automatically.

## Steps

### 1. Find the computer's local IP address
Run in terminal:
```bash
ipconfig
```
Look for the **IPv4 Address** under the active Wi-Fi or Ethernet adapter (e.g. `192.168.1.100`).

### 2. Allow port 3000 through Windows Firewall
Add a firewall rule to allow incoming connections on port 3000:
```powershell
netsh advfirewall firewall add rule name="Chat App Port 3000" dir=in action=allow protocol=TCP localport=3000
```

### 3. Start the app with Docker Compose
```bash
docker-compose up --build
```

### 4. Open on smartphone
On the phone's browser, navigate to:
```
http://<COMPUTER_IP>:3000
```
For example: `http://192.168.1.100:3000`

## Files to modify
None — no code changes required.

## Verification
1. Run `ipconfig` to get the local IP
2. Add the firewall rule
3. Start the app via `docker-compose up --build`
4. On the phone browser, open `http://<IP>:3000`
5. Register, login, and send a test message


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\4b993f03-5d1e-4623-a624-616dd7a5a9bc.jsonl