import 'dart:convert';

/// E2E encrypted message envelope format. Single source of truth for build/parse.
class E2eEnvelope {
  E2eEnvelope._();

  static const String _keyContent = 'content';
  static const String _keyLinkPreview = 'linkPreview';
  static const String _keyUrl = 'url';
  static const String _keyTitle = 'title';
  static const String _keyImageUrl = 'imageUrl';

  /// Build envelope JSON map for encryption.
  static Map<String, dynamic> build(
    String content, [
    Map<String, String?>? linkPreview,
  ]) {
    final envelope = <String, dynamic>{_keyContent: content};
    if (linkPreview != null) envelope[_keyLinkPreview] = linkPreview;
    return envelope;
  }

  /// Parse decrypted envelope JSON. Returns content + link preview fields.
  static ({String content, String? linkPreviewUrl, String? linkPreviewTitle, String? linkPreviewImageUrl})
      parse(String jsonStr) {
    final envelope = jsonDecode(jsonStr) as Map<String, dynamic>;
    final content = envelope[_keyContent] as String? ?? '';
    final lp = envelope[_keyLinkPreview] as Map<String, dynamic>?;
    return (
      content: content,
      linkPreviewUrl: lp?[_keyUrl] as String?,
      linkPreviewTitle: lp?[_keyTitle] as String?,
      linkPreviewImageUrl: lp?[_keyImageUrl] as String?,
    );
  }
}
