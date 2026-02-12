# 2. Test profile picture upload
curl -X POST http://localhost:3000/users/profile-picture \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -F "file=@test-image.jpg"