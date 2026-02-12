# 3. Test password reset
curl -X POST http://localhost:3000/auth/reset-password \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword": "OldPass123", "newPassword": "NewPass456"}'