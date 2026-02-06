#!/bin/sh
# dev-entrypoint.sh - Flutter web dev server with polling-based change detection
# Needed because Docker volumes on Windows don't propagate inotify events to Linux containers

cd /app

# Content hash of Dart files (touch only changes mtime, not content - no false positives)
get_hash() {
  find /app/lib -name "*.dart" -exec md5sum {} \; 2>/dev/null | sort | md5sum
}

echo "[dev-watch] Starting Flutter web dev server..."
flutter run -d web-server --web-port=8080 --web-hostname=0.0.0.0 \
  --dart-define=BASE_URL=http://localhost:3000 &
FLUTTER_PID=$!

# Wait for initial compilation
sleep 5

LAST=$(get_hash)
echo "[dev-watch] Polling for file changes every 2s..."

while kill -0 $FLUTTER_PID 2>/dev/null; do
  sleep 2
  NOW=$(get_hash)
  if [ "$NOW" != "$LAST" ]; then
    echo "[dev-watch] File changes detected, triggering rebuild..."
    # Touch dart files to generate inotify events inside container
    find /app/lib -name "*.dart" -exec touch {} \;
    # Touch directories too (for new/deleted files)
    find /app/lib -type d -exec touch {} \;
    LAST="$NOW"
    echo "[dev-watch] Rebuild triggered. Refresh browser when ready."
  fi
done

echo "[dev-watch] Flutter process exited."
wait $FLUTTER_PID
