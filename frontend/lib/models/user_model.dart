class UserModel {
  final int id;
  final String username;
  final String tag;
  final String? profilePictureUrl;

  UserModel({
    required this.id,
    required this.username,
    required this.tag,
    this.profilePictureUrl,
  });

  String get displayHandle => '$username#$tag';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      username: json['username'] as String,
      tag: json['tag'] as String? ?? '0000',
      profilePictureUrl: json['profilePictureUrl'] as String?,
    );
  }

  UserModel copyWith({
    int? id,
    String? username,
    String? tag,
    String? profilePictureUrl,
  }) {
    return UserModel(
      id: id ?? this.id,
      username: username ?? this.username,
      tag: tag ?? this.tag,
      profilePictureUrl: profilePictureUrl ?? this.profilePictureUrl,
    );
  }
}
