import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/models/conversation_model.dart';

void main() {
  group('ConversationModel', () {
    test('fromJson parses conversation', () {
      final json = {
        'id': 1,
        'userOne': {'id': 10, 'email': 'a@b.com'},
        'userTwo': {'id': 20, 'email': 'b@c.com'},
        'createdAt': '2026-02-01T12:00:00.000Z',
      };
      final conv = ConversationModel.fromJson(json);
      expect(conv.id, 1);
      expect(conv.userOne.id, 10);
      expect(conv.userOne.email, 'a@b.com');
      expect(conv.userTwo.id, 20);
      expect(conv.userTwo.email, 'b@c.com');
      expect(conv.createdAt, DateTime.utc(2026, 2, 1, 12, 0, 0));
    });
  });
}
