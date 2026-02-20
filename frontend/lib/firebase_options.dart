// THIS FILE IS A PLACEHOLDER — replace it by running FlutterFire CLI:
//
//   npm install -g firebase-tools
//   dart pub global activate flutterfire_cli
//   cd frontend
//   flutterfire configure --project=<your-firebase-project-id>
//
// The CLI will overwrite this file with real credentials for each platform.
// Do NOT commit real Firebase credentials to version control.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  // TODO: Replace with real values from Firebase Console → Project Settings → Web app
  // (also set the VAPID key in push_service.dart)
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'TODO_REPLACE_WITH_REAL_API_KEY',
    appId: 'TODO_REPLACE_WITH_REAL_APP_ID',
    messagingSenderId: 'TODO_REPLACE_WITH_REAL_SENDER_ID',
    projectId: 'TODO_REPLACE_WITH_REAL_PROJECT_ID',
    authDomain: 'TODO_REPLACE.firebaseapp.com',
    storageBucket: 'TODO_REPLACE.firebasestorage.app',
    measurementId: 'TODO_REPLACE',
  );

  // TODO: Replace with real values (from google-services.json → android/app/)
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'TODO_REPLACE_WITH_REAL_API_KEY',
    appId: 'TODO_REPLACE_WITH_REAL_APP_ID',
    messagingSenderId: 'TODO_REPLACE_WITH_REAL_SENDER_ID',
    projectId: 'TODO_REPLACE_WITH_REAL_PROJECT_ID',
    storageBucket: 'TODO_REPLACE.firebasestorage.app',
  );

  // TODO: Replace with real values (from GoogleService-Info.plist → ios/Runner/)
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'TODO_REPLACE_WITH_REAL_API_KEY',
    appId: 'TODO_REPLACE_WITH_REAL_APP_ID',
    messagingSenderId: 'TODO_REPLACE_WITH_REAL_SENDER_ID',
    projectId: 'TODO_REPLACE_WITH_REAL_PROJECT_ID',
    storageBucket: 'TODO_REPLACE.firebasestorage.app',
    iosBundleId: 'com.rpgchat.frontend',
  );
}
