import 'package:web/web.dart' as web;

/// On web: returns whether the page is in a secure context (HTTPS or localhost).
/// Required for getUserMedia / MediaRecorder.
bool isWebSecureContext() => web.window.isSecureContext;
