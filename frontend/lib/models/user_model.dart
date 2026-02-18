class UserModel {
  final int id;
  final String username;
  final String? profilePictureUrl;

  UserModel({
    required this.id,
    required this.username,
    this.profilePictureUrl,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      username: json['username'] as String,
      profilePictureUrl: json['profilePictureUrl'] as String?,
    );
  }

  UserModel copyWith({
    int? id,
    String? username,
    String? profilePictureUrl,
  }) {
    return UserModel(
      id: id ?? this.id,
      username: username ?? this.username,
      profilePictureUrl: profilePictureUrl ?? this.profilePictureUrl,
    );
  }
}
