import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/models/user_model.dart';

void main() {
  group('UserModel', () {
    test('fromJson parses minimal user', () {
      final json = {
        'id': 1,
        'email': 'test@example.com',
      };
      final user = UserModel.fromJson(json);
      expect(user.id, 1);
      expect(user.email, 'test@example.com');
      expect(user.username, isNull);
      expect(user.profilePictureUrl, isNull);
    });

    test('fromJson parses full user', () {
      final json = {
        'id': 2,
        'email': 'user@test.com',
        'username': 'testuser',
        'profilePictureUrl': 'https://example.com/avatar.png',
      };
      final user = UserModel.fromJson(json);
      expect(user.id, 2);
      expect(user.email, 'user@test.com');
      expect(user.username, 'testuser');
      expect(user.profilePictureUrl, 'https://example.com/avatar.png');
    });

    test('copyWith preserves unchanged fields', () {
      final user = UserModel(id: 1, email: 'a@b.com', username: 'old');
      final updated = user.copyWith(username: 'new');
      expect(updated.id, 1);
      expect(updated.email, 'a@b.com');
      expect(updated.username, 'new');
    });
  });
}
