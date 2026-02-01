import 'package:flutter/material.dart';
import '../theme/rpg_theme.dart';

/// Placeholder for future Archive tab. Shows "Coming soon".
class ArchivePlaceholderScreen extends StatelessWidget {
  const ArchivePlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = RpgTheme.isDark(context);
    final mutedColor =
        isDark ? RpgTheme.mutedDark : RpgTheme.textSecondaryLight;
    return Center(
      child: Text(
        'Coming soon',
        style: RpgTheme.bodyFont(fontSize: 16, color: mutedColor),
      ),
    );
  }
}
