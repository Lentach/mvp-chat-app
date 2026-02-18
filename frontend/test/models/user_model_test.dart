import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/models/user_model.dart';

void main() {
  group('UserModel', () {
    test('fromJson parses user', () {
      final json = {
        'id': 1,
        'username': 'testuser',
      };
      final user = UserModel.fromJson(json);
      expect(user.id, 1);
      expect(user.username, 'testuser');
      expect(user.profilePictureUrl, isNull);
    });

    test('fromJson parses full user', () {
      final json = {
        'id': 2,
        'username': 'testuser',
        'profilePictureUrl': 'https://example.com/avatar.png',
      };
      final user = UserModel.fromJson(json);
      expect(user.id, 2);
      expect(user.username, 'testuser');
      expect(user.profilePictureUrl, 'https://example.com/avatar.png');
    });

    test('copyWith preserves unchanged fields', () {
      final user = UserModel(id: 1, username: 'old');
      final updated = user.copyWith(username: 'new');
      expect(updated.id, 1);
      expect(updated.username, 'new');
    });
  });
}
