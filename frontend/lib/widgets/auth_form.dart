import 'package:flutter/material.dart';
import '../theme/rpg_theme.dart';

class AuthForm extends StatefulWidget {
  final bool isLogin;
  final Future<void> Function(String username, String password) onSubmit;

  const AuthForm({
    super.key,
    required this.isLogin,
    required this.onSubmit,
  });

  @override
  State<AuthForm> createState() => _AuthFormState();
}

class _AuthFormState extends State<AuthForm> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_usernameController.text.isEmpty || _passwordController.text.isEmpty) {
      return;
    }
    setState(() => _loading = true);
    await widget.onSubmit(
      _usernameController.text.trim(),
      _passwordController.text,
    );
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _usernameController,
          style: RpgTheme.bodyFont(fontSize: 14, color: colorScheme.onSurface),
          decoration: RpgTheme.rpgInputDecoration(
            hintText: widget.isLogin ? 'Username or username#tag' : 'Username',
            prefixIcon: Icons.person_outlined,
            context: context,
          ),
          onSubmitted: (_) => _handleSubmit(),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: _passwordController,
          style: RpgTheme.bodyFont(fontSize: 14, color: colorScheme.onSurface),
          decoration: RpgTheme.rpgInputDecoration(
            hintText: widget.isLogin ? 'Password' : 'Password (min 8 chars)',
            prefixIcon: Icons.lock_outlined,
            context: context,
          ),
          obscureText: true,
          onSubmitted: (_) => _handleSubmit(),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _loading ? null : _handleSubmit,
          child: _loading
              ? SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colorScheme.primary,
                  ),
                )
              : Text(widget.isLogin ? 'Login' : 'Create Account'),
        ),
      ],
    );
  }
}
