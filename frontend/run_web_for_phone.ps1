# Run Flutter web so you can open the app on your phone's browser.
# 1. Backend must be running (docker-compose up) and reachable at 192.168.1.11:3000
# 2. On phone (same WiFi): open http://192.168.1.11:8080
# If page does not load: allow "Dart" or "Flutter" in Windows Firewall when prompted, or allow port 8080.

$HostIP = "192.168.1.11"
Set-Location $PSScriptRoot
flutter run -d web-server --web-hostname $HostIP --web-port 8080 --dart-define=BASE_URL=http://${HostIP}:3000
