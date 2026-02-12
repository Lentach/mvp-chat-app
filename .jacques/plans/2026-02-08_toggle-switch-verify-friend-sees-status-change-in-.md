# Toggle switch → Verify friend sees status change in friends list
```

### End-to-End Test Flow
1. User A logs in → Uploads profile picture → Toggles active status OFF
2. User B logs in → Opens friends list → Sees User A's profile picture and offline status
3. User A toggles active status ON → User B sees online indicator (green dot)
4. User A changes dark mode to Dark → Restarts app → Dark mode persisted
5. User A resets password → Logs out → Logs in with new password
6. User A deletes account → Logs out → Cannot log in again → User B's conversations with A are deleted

---

## Gotchas & Edge Cases

### Backend
1. **File upload permissions:** Add volume mount in docker-compose.yml
2. **Old file deletion:** Upload new file FIRST, then delete old (prevent data loss)
3. **Cascade deletion:** Use TypeORM cascade `onDelete: 'CASCADE'` for performance
4. **JWT size:** Monitor payload size with profilePictureUrl (should be <2KB)
5. **Active status sync:** Emit to ALL sockets for same userId (multi-device support)

### Frontend
1. **Image picker permissions:** Add to AndroidManifest.xml and Info.plist
2. **Image size:** Compress before upload (target 500KB max)
3. **SharedPreferences logout:** Use `prefs.remove('jwt_token')` NOT `prefs.clear()`
4. **Profile picture caching:** Append timestamp query param to bust cache
5. **Device name on web:** Will show "Web Browser" (acceptable)
6. **Active status state:** Store in AuthProvider, not just SettingsScreen state
7. **Avatar online indicator:** Careful Stack positioning to prevent overlap

---

## CLAUDE.md Updates

After implementation, update these sections:

**Database Schema:**
```markdown
users
  ├─ profilePictureUrl (nullable, relative path) ← NEW
  ├─ activeStatus (boolean, default true) ← NEW
```

**REST Endpoints:**
```markdown
POST /users/profile-picture (multipart)
POST /auth/reset-password
DELETE /users/account
PATCH /users/active-status
```

**WebSocket Events:**
```markdown
Client→Server: updateActiveStatus {activeStatus}
Server→Client: userStatusChanged {userId, activeStatus}
```

**Project Status:**
```markdown
✅ Settings Screen Redesign (2026-01-XX)
```

**Dependencies:**
```markdown
Backend: multer, @types/multer
Frontend: image_picker, device_info_plus
```

---

## Success Criteria

- [ ] Profile picture uploads successfully and displays in avatar
- [ ] Fallback to gradient AvatarCircle if no photo
- [ ] Camera badge visible and functional
- [ ] Active status toggle updates backend and notifies friends via WebSocket
- [ ] Dark mode persists after app restart
- [ ] Device name displays correctly (platform-specific)
- [ ] Password reset validates old password and updates successfully
- [ ] Account deletion requires confirmation and cascades deletes
- [ ] All settings tiles styled with RPG theme (purple, gold, borders)
- [ ] Responsive design works on mobile (<600px) and desktop (≥600px)
- [ ] No regressions in existing functionality (logout, navigation, chat)


If you need specific details from before exiting plan mode (like exact code snippets, error messages, or content you generated), read the full transcript at: C:\Users\Lentach\.claude\projects\C--Users-Lentach-desktop-mvp-chat-app\4baeefe4-1664-4cc8-a932-1c75da835314.jsonl