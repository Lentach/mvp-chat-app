#!/bin/sh
# dev-entrypoint.sh - Flutter web with auto-rebuild on file changes

cd /app

echo "[dev-watch] Building initial Flutter web app..."
flutter build web --dart-define=BASE_URL=${BASE_URL:-http://localhost:3000} --release

echo "[dev-watch] Copying to nginx..."
cp -r build/web/* /usr/share/nginx/html/

echo "[dev-watch] Starting nginx in background..."
nginx -g 'daemon off;' &
NGINX_PID=$!

echo "[dev-watch] Starting file watcher (rebuild on .dart changes)..."

get_hash() {
  find /app/lib -name "*.dart" -exec md5sum {} \; 2>/dev/null | sort | md5sum
}

LAST=$(get_hash)
echo "[dev-watch] Watching for file changes every 3s. Refresh browser after rebuild!"

# Keep watching while nginx is running
while true; do
  # Check if nginx is still running
  if ! kill -0 $NGINX_PID 2>/dev/null; then
    echo "[dev-watch] Nginx stopped, exiting..."
    exit 1
  fi

  sleep 3
  NOW=$(get_hash)
  if [ "$NOW" != "$LAST" ]; then
    echo "[dev-watch] 🔥 File changes detected! Rebuilding..."
    flutter build web --dart-define=BASE_URL=${BASE_URL:-http://localhost:3000} --release
    echo "[dev-watch] ✅ Build complete! Copying to nginx..."
    cp -r build/web/* /usr/share/nginx/html/
    LAST="$NOW"
    echo "[dev-watch] 🎉 Ready! Refresh your browser (F5)"
  fi
done
