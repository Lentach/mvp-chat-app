# Explore: Explore User entity and auth

> Session: `de9e180f-937a-474c-947c-3491c989514f`
> Date: 2026-01-29
> Tokens: ~24,324

---

Mam już wszystkie informacje potrzebne do analizu. Oto szczegółowy raport:

---

## Analiza Systemu Autentykacji - Email vs Username

Przeprowadziłem kompleksowe badanie systemu autentykacji w aplikacji. Oto kluczowe ustalenia:

### 1. Backend User Entity (TypeORM)

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\users\user.entity.ts`

Entiteta User ma **tylko 4 pola**:
```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // bcrypt hash

  @CreateDateColumn()
  createdAt: Date;
}
```

**Wniosek:** Brak pola `username`. Autentykacja opiera się **wyłącznie na email**.

---

### 2. Rejestracja i Logowanie

#### POST /auth/register
**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\dto\register.dto.ts`

```typescript
export class RegisterDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;
}
```

**Odpowiedź (backend):** `{ id, email }` (bez hasła)

#### POST /auth/login
**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\dto\login.dto.ts`

```typescript
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

**Odpowiedź:** `{ access_token: string }`

**Obsługa w UsersService:**
```typescript
async create(email: string, password: string): Promise<User> {
  // Case-insensitive sprawdzenie czy email istnieje
  const existing = await this.usersRepo.findOne({ where: { email } });
  if (existing) {
    throw new ConflictException('Email already in use');
  }
  const hash = await bcrypt.hash(password, 10);
  const user = this.usersRepo.create({ email, password: hash });
  return this.usersRepo.save(user);
}

async findByEmail(email: string): Promise<User | null> {
  return this.usersRepo
    .createQueryBuilder('user')
    .where('LOWER(user.email) = LOWER(:email)', { email })
    .getOne();
}
```

---

### 3. JWT Payload

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\backend\src\auth\auth.service.ts`

```typescript
async login(email: string, password: string) {
  // ...
  const payload = { sub: user.id, email: user.email };
  return {
    access_token: this.jwtService.sign(payload),
  };
}
```

**JWT zawiera:**
- `sub` (Subject) — userId (typ: number)
- `email` — email użytkownika (typ: string)

**Walidacja JWT:**
```typescript
// jwt.strategy.ts
async validate(payload: { sub: number; email: string }) {
  const user = await this.usersService.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedException();
  }
  return { id: user.id, email: user.email };
}
```

---

### 4. Frontend - Formularz Autentykacji

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\widgets\auth_form.dart`

```dart
TextField(
  controller: _emailController,
  decoration: RpgTheme.rpgInputDecoration(
    hintText: 'Email',
    prefixIcon: Icons.email_outlined,
  ),
  keyboardType: TextInputType.emailAddress,
),
TextField(
  controller: _passwordController,
  obscureText: true,
  decoration: RpgTheme.rpgInputDecoration(
    hintText: widget.isLogin ? 'Password' : 'Password (min 6 chars)',
    prefixIcon: Icons.lock_outlined,
  ),
),
```

Formularz ma **dokładnie 2 pola: email i hasło** (bez username).

---

### 5. Frontend API Service

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\services\api_service.dart`

```dart
Future<Map<String, dynamic>> register(String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/register'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );
  // ...
}

Future<String> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'email': email, 'password': password}),
  );
  // ...
  return data['access_token'] as String;
}
```

---

### 6. Frontend Auth Provider

**Lokalizacja:** `C:\Users\Lentach\desktop\mvp-chat-app\frontend\lib\providers\auth_provider.dart`

```dart
Future<bool> login(String email, String password) async {
  final accessToken = await _api.login(email, password);
  _token = accessToken;

  final payload = JwtDecoder.decode(accessToken);
  _currentUser = UserModel(
    id: payload['sub'] as int,
    email: payload['email'] as String,
  );
  // ...
}

Future<bool> register(String email, String password) async {
  await _api.register(email, password);
  // Zwraca true bez przechowywania tokenu
}
```

**UserModel:**
```dart
class UserModel {
  final int id;
  final String email;

  UserModel({required this.id, required this.email});
}
```

---

## Podsumowanie

| Aspekt | Stan |
|--------|------|
| **Pole username w User entity** | **NIE** — tylko email + password |
| **Autentykacja** | **Email-based** — brak obsługi username |
| **JWT payload** | `{sub: userId, email}` |
| **Formularz auth** | Email + Password (2 pola) |
| **Walidacja email** | Case-insensitive (LOWER w SQL) |
| **Unikatowość** | Email musi być unikalny (constraint w BD) |

**Wniosek:** System autentykacji jest **w pełni oparty na email**. Nie ma nikąd śladu pola `username`. Jeśli chcesz dodać obsługę username, będzie to wymagać:

1. Dodania kolumny `username` do tabeli `users`
2. Zmiany DTO (register/login)
3. Zmian w formularzu frontendowym
4. Potencjalnej obsługi login-by-email OR login-by-username
5. Aktualizacji JWT payload

Czy chcesz to zmienić?