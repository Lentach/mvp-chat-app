# Ostatnia sesja (najnowsze podsumowanie)

**Data:** 2026-02-01  
**Pełne podsumowanie:** [2026-02-01-active-status-fix.md](2026-02-01-active-status-fix.md)

## Skrót
- **Active Status Green Dot Fix:** Naprawiono logikę zielonego kółka - teraz pokazuje się tylko gdy `activeStatus == true` AND `isOnline == true`. Backend sprawdza oba warunki w `toConversationPayloadWithOnline()` (2 pliki) i wszystkich emisjach `friendsList` (4 lokalizacje). Settings screen używa `_activeStatus && chat.socket.isConnected`. Dodano `SocketService.isConnected` getter.
- Backend: chat-conversation.service.ts, chat-friend-request.service.ts - wszystkie payload'y z `isOnline` sprawdzają `onlineUsers.has(id) && activeStatus`
- Frontend: SocketService.isConnected, settings_screen avatar fix, ChatProvider connection logging
- Wszystkie testy kompilacji przeszły pomyślnie. Manual testing wymaga restartu Docker Desktop.
- **Light Mode Color Renovation:** Nowa paleta neutralna (Slack-style), fiolet #4A154B zamiast złota, czytelne nazwy. Wszystkie ekrany theme-aware.
- Migracja avatarów do Cloudinary; AvatarCircle obsługuje pełne URL
- **Theme:** domyślny dark, RpgTheme.themeDataLight, main theme/darkTheme, Settings "Theme" (System/Light/Dark)
