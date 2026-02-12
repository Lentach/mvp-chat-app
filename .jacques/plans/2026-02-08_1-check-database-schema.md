# 1. Check database schema
docker exec -it mvp-chat-app-db-1 psql -U postgres -d chatdb -c "\d users"