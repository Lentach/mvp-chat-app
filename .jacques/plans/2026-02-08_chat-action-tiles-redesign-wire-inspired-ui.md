# Chat Action Tiles Redesign - Wire-Inspired UI

**Data utworzenia:** 2026-02-05
**Status:** Ready for Implementation
**Cel:** Przeprojektować kafelki akcji w oknie chatu zgodnie z designem Wire messenger - kompaktowe ikony POD polem tekstowym.

---

## Executive Summary

Refaktoryzacja dolnej sekcji okna chatu (`ChatActionTiles`) zgodnie z designem aplikacji Wire messenger:

**Przed (ss1 - obecny stan):**
- Kafelki **NAD** polem tekstowym
- 6 kafelków: Timer, Ping, Camera, Draw, GIF, More
- Wysokość: 60px
- Każdy kafelek: ikona + tekst (70x60px)
- Duże, rozciągnięte

**Po (ss2 - Wire design):**
- Kafelki **POD** polem tekstowym
- 5 kafelków: Timer, **Ping (gwiazdka ✱)**, Camera, Draw, GIF
- Wysokość: **48px** (kompaktowa)
- Tylko **ikony** (bez tekstu), 40x40px circular
- Linia oddzielająca od pola tekstowego (border top)

---

## Kluczowe Decyzje (Brainstorming)

### 1. Pozycja Kafelków
✅ **POD polem tekstowym** (zmiana kolejności w Column)
✅ **Border top** (linia oddzielająca od text input)

### 2. Liczba Kafelków
✅ **5 kafelków** (usunąć "More")
✅ Kolejność: **Timer → Ping → Camera → Draw → GIF**

### 3. Styl Wizualny
✅ **Tylko ikony** (bez tekstu)
✅ Wysokość paska: **48px** (było 60px)
✅ Tile size: **40x40px**, circular (borderRadius 20px)
✅ Icon size: **24px** (bez zmian)
✅ Spacing: **12px** między kafelkami

### 4. Ikona Pinga
✅ **Gwiazdka** ✱ (6-ramienna) jak w Wire
✅ **NIE** Icons.campaign (megafon)
✅ Wire używa ikony gwiazdki dla funkcji Ping

**Referencja (image #5):**
- Kafelek Ping na dole: gwiazdka ✱
- Efekt po kliknięciu: "You pinged" z tą samą ikoną

---

## Obecna Implementacja (Analiza)

### Struktura Plików

**ChatInputBar** (`frontend/lib/widgets/chat_input_bar.dart:85-201`):
```dart
SafeArea(
  child: Column(
    children: [
      const ChatActionTiles(),  // <-- NAD tekstem
      Container(...),           // Input row (attach, text field, emoji, mic/send)
      if (_showEmojiPicker) EmojiPicker(...),
    ]
  )
)
```

**ChatActionTiles** (`frontend/lib/widgets/chat_action_tiles.dart`):
- Container height: **60px**
- ListView horizontal scroll
- 6 tiles: Timer, Ping, Camera, Draw, GIF, **More**
- Spacing: 8px między kafelkami

**_ActionTile** (`:180-226`):
- Width: **70px**
- Padding: 8px
- Icon: 24px
- **Label**: Text 10pt (pod ikoną)
- Background: inputBg (theme-aware)
- BorderRadius: 12px

### Ikony (obecne)
- Timer: `Icons.timer_outlined` ✅
- Ping: `Icons.campaign` ❌ (zmienić na gwiazdkę)
- Camera: `Icons.camera_alt` ✅
- Draw: `Icons.brush` ✅
- GIF: `Icons.gif_box` ✅
- More: `Icons.more_horiz` ❌ (usunąć)

---

## Wire Design Reference

**Źródło:** Screenshot ss2 (image #4), ss2 z kafelkiem Ping (image #5)

### Obserwacje z ss2 (Wire)
1. **Pozycja:** Kafelki POD polem "Type a message..."
2. **Linia:** Border top oddziela kafelki od input
3. **Ikony:** Tylko ikony, bez tekstu
4. **Rozmiar:** Bardzo kompaktowe (~40-48px wysokość całego paska)
5. **Spacing:** Równomierne odstępy między ikonami
6. **Kolor:** Szare ikony (theme-aware)

### Kafelek Ping w Wire (ss2, image #5)
- **Ikona:** Gwiazdka ✱ z 6 ramionami
- **Kolor:** Taki sam jak inne ikony (muted)
- **Rozmiar:** Taki sam jak inne kafelki
- **Efekt:** Po kliknięciu pokazuje "You pinged" z tą samą ikoną

**Flutter equivalent:**
- `Icons.auto_awesome` - gwiazdka z promieniami (najbliższy Wire)
- `Icons.stars` - alternatywa

---

## Implementacja - Zmiany Krok po Kroku

### Zmiana 1: ChatInputBar - Zmień Kolejność

**Plik:** `frontend/lib/widgets/chat_input_bar.dart`

**Lokalizacja:** Lines 85-201 (build method)

**PRZED:**
```dart
SafeArea(
  top: false,
  child: Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      // Action tiles row
      const ChatActionTiles(),  // <-- NAD

      // Input row
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(top: BorderSide(color: borderColor)),
        ),
        child: Row(...),
      ),

      // Emoji picker
      if (_showEmojiPicker) SizedBox(...),
    ],
  ),
)
```

**PO:**
```dart
SafeArea(
  top: false,
  child: Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      // Input row
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        decoration: BoxDecoration(
          color: colorScheme.surface,
          border: Border(top: BorderSide(color: borderColor)),
        ),
        child: Row(...),
      ),

      // Action tiles row (POD tekstem)
      const ChatActionTiles(),  // <-- POD

      // Emoji picker
      if (_showEmojiPicker) SizedBox(...),
    ],
  ),
)
```

**Instrukcja:**
1. Wytnij linię 91: `const ChatActionTiles(),`
2. Wklej PO linii 183 (po Container z Input row, przed emoji picker)
3. Sprawdź wcięcia (indent) - ChatActionTiles powinien być na tym samym poziomie co Container

---

### Zmiana 2: ChatActionTiles - Redesign

**Plik:** `frontend/lib/widgets/chat_action_tiles.dart`

#### 2A: Container (wysokość + border)

**Lokalizacja:** Lines 20-24

**PRZED:**
```dart
return Container(
  height: 60,
  decoration: BoxDecoration(
    border: Border(top: BorderSide(color: borderColor)),
  ),
  child: ListView(...)
);
```

**PO:**
```dart
return Container(
  height: 48,  // Zmniejszone z 60 → 48
  decoration: BoxDecoration(
    border: Border(top: BorderSide(color: borderColor)),
  ),
  child: ListView(...)
);
```

#### 2B: ListView Padding

**Lokalizacja:** Line 27

**PRZED:**
```dart
padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
```

**PO:**
```dart
padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
```

#### 2C: Tiles (usunąć More, zmienić Ping icon)

**Lokalizacja:** Lines 28-76

**PRZED:**
```dart
children: [
  _ActionTile(
    icon: Icons.timer_outlined,
    label: 'Timer',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _showTimerDialog(context),
  ),
  const SizedBox(width: 8),
  _ActionTile(
    icon: Icons.campaign,  // <-- Zmienić
    label: 'Ping',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _sendPing(context),
  ),
  const SizedBox(width: 8),
  _ActionTile(
    icon: Icons.camera_alt,
    label: 'Camera',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _openCamera(context),
  ),
  const SizedBox(width: 8),
  _ActionTile(
    icon: Icons.brush,
    label: 'Draw',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _openDrawing(context),
  ),
  const SizedBox(width: 8),
  _ActionTile(
    icon: Icons.gif_box,
    label: 'GIF',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _showComingSoon(context, 'GIF picker'),
  ),
  const SizedBox(width: 8),
  _ActionTile(  // <-- Usunąć całość
    icon: Icons.more_horiz,
    label: 'More',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _showComingSoon(context, 'More options'),
  ),
],
```

**PO:**
```dart
children: [
  _ActionTile(
    icon: Icons.timer_outlined,
    tooltip: 'Timer',  // <-- Dodane (było label)
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _showTimerDialog(context),
  ),
  const SizedBox(width: 12),  // <-- Zwiększone z 8 → 12
  _ActionTile(
    icon: Icons.auto_awesome,  // <-- Zmienione (gwiazdka)
    tooltip: 'Ping',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _sendPing(context),
  ),
  const SizedBox(width: 12),
  _ActionTile(
    icon: Icons.camera_alt,
    tooltip: 'Camera',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _openCamera(context),
  ),
  const SizedBox(width: 12),
  _ActionTile(
    icon: Icons.brush,
    tooltip: 'Draw',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _openDrawing(context),
  ),
  const SizedBox(width: 12),
  _ActionTile(
    icon: Icons.gif_box,
    tooltip: 'GIF',
    color: iconColor,
    backgroundColor: tileColor,
    onTap: () => _showComingSoon(context, 'GIF picker'),
  ),
],
```

**Instrukcje:**
1. Zmień `Icons.campaign` → `Icons.auto_awesome` (linia 39)
2. Usuń cały ostatni `_ActionTile` (More) wraz z `SizedBox` przed nim (linie 68-76)
3. Zmień `label:` → `tooltip:` dla wszystkich 5 kafelków
4. Zmień wszystkie `const SizedBox(width: 8)` → `const SizedBox(width: 12)`

---

#### 2D: _ActionTile Widget (icon-only, circular)

**Lokalizacja:** Lines 180-226

**PRZED:**
```dart
class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String label;  // <-- Usunąć
  final Color color;
  final Color backgroundColor;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.label,  // <-- Usunąć
    required this.color,
    required this.backgroundColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: 70,  // <-- Zmienić na 40
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(12),  // <-- Zmienić na 20
        ),
        child: Column(  // <-- Zmienić na tylko Icon
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 24, color: color),
            const SizedBox(height: 4),
            Text(  // <-- Usunąć
              label,
              style: RpgTheme.bodyFont(
                fontSize: 10,
                color: color,
              ),
              textAlign: TextAlign.center,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
```

**PO:**
```dart
class _ActionTile extends StatelessWidget {
  final IconData icon;
  final String tooltip;  // <-- Zmienione z label
  final Color color;
  final Color backgroundColor;
  final VoidCallback onTap;

  const _ActionTile({
    required this.icon,
    required this.tooltip,  // <-- Zmienione z label
    required this.color,
    required this.backgroundColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Tooltip(  // <-- Dodane
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),  // <-- Zmienione
        child: Container(
          width: 40,  // <-- Zmniejszone z 70
          height: 40,  // <-- Dodane (było tylko width)
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: backgroundColor.withOpacity(0.8),  // <-- Dodane .withOpacity
            shape: BoxShape.circle,  // <-- Zmienione z borderRadius
          ),
          child: Icon(icon, size: 24, color: color),  // <-- Tylko ikona
        ),
      ),
    );
  }
}
```

**Instrukcje:**
1. Zmień `label` → `tooltip` (parametr + constructor)
2. Wrap InkWell w `Tooltip(message: tooltip, child: ...)`
3. InkWell: dodaj `customBorder: const CircleBorder()`
4. Container: width: 70 → 40, dodaj height: 40
5. Container: padding: bez zmian (8px)
6. BoxDecoration:
   - backgroundColor → backgroundColor.withOpacity(0.8)
   - borderRadius → `shape: BoxShape.circle`
7. Child: tylko `Icon(...)`, usuń całe `Column` z `Text`

---

### Zmiana 3: Accessibility (Optional)

**Plik:** `frontend/lib/widgets/chat_action_tiles.dart`

**Lokalizacja:** _ActionTile build method

**Dodaj Semantics wrapper dla lepszej accessibility:**

```dart
return Semantics(
  label: tooltip,
  button: true,
  child: Tooltip(
    message: tooltip,
    child: InkWell(...)
  ),
);
```

**Instrukcja:**
- Wrap cały `Tooltip` w `Semantics`
- label: tooltip
- button: true

---

## Pliki do Modyfikacji (Podsumowanie)

| Plik | Zmiana | Linie |
|------|--------|-------|
| `frontend/lib/widgets/chat_input_bar.dart` | Zmień kolejność: Input row → ChatActionTiles | 85-201 |
| `frontend/lib/widgets/chat_action_tiles.dart` | Container: height 60→48, padding 8→12/6 | 20-27 |
| `frontend/lib/widgets/chat_action_tiles.dart` | Tiles: usunąć More, zmienić Ping icon, tooltip zamiast label, spacing 8→12 | 28-76 |
| `frontend/lib/widgets/chat_action_tiles.dart` | _ActionTile: icon-only, 40x40 circular, Tooltip wrapper | 180-226 |

---

## Weryfikacja

### Test 1: Wizualne Porównanie

**Po zmianach:**
1. Hot reload (`r` w terminalu)
2. Otwórz okno chatu (ChatDetailScreen)
3. **Sprawdź:**
   - ✅ Kafelki są **POD** polem "Type a message..."
   - ✅ Linia oddziela kafelki od pola tekstowego (border top)
   - ✅ Wysokość paska: ~48px (kompaktowa, mniejsza niż przed)
   - ✅ **5 kafelków** (Timer, Ping, Camera, Draw, GIF)
   - ✅ Ping ma **gwiazdkę** (nie megafon)
   - ✅ Tylko ikony, **bez tekstu**
   - ✅ Ikony są **circular** (okrągłe)
   - ✅ Równomierne spacing (~12px)

### Test 2: Funkcjonalność Kafelków

**Sprawdź każdy kafelek:**
1. **Timer** → Dialog z opcjami (30s, 1m, 5m, 1h, 1d, Off)
2. **Ping** (gwiazdka) → SnackBar "Ping sent!" + backend emit
3. **Camera** → ImagePicker camera (lub "Uploading image...")
4. **Draw** → NavigatTo DrawingCanvasScreen
5. **GIF** → SnackBar "GIF picker coming soon"

### Test 3: Tooltip (Long Press)

**Desktop/Web:**
- Hover nad ikoną → tooltip się pojawia

**Mobile:**
- Long press → tooltip się pojawia (zależnie od platformy)

### Test 4: Theme (Dark/Light)

1. Przejdź do Settings
2. Toggle Dark/Light mode
3. Wróć do ChatDetailScreen
4. **Sprawdź:**
   - ✅ Ikony mają poprawny kolor (accentDark / primaryLight)
   - ✅ Background kafelków: semi-transparent inputBg
   - ✅ Linia (border) ma poprawny kolor (convItemBorder)

### Test 5: Embedded vs Standalone

**Mobile (standalone):**
- Push ChatDetailScreen → kafelki POD tekstem ✅

**Desktop (embedded):**
- ConversationsScreen z embedded ChatDetailScreen → kafelki POD tekstem ✅

---

## Porównanie Przed/Po

| Aspect | Przed (ss1) | Po (Wire-inspired) |
|--------|-------------|---------------------|
| **Pozycja** | NAD tekstem | **POD tekstem** |
| **Wysokość** | 60px | **48px** (-20%) |
| **Kafelki** | 6 (+ More) | **5** (bez More) |
| **Styl** | Ikona + tekst | **Tylko ikona** |
| **Tile size** | 70x60px | **40x40px** circular |
| **Icon Ping** | Icons.campaign | **Icons.auto_awesome** (gwiazdka) |
| **Spacing** | 8px | **12px** |
| **Tooltip** | Nie | **Tak** (accessibility) |
| **Wizualny styl** | Duże, rozciągnięte | **Kompaktowe, moderne** |
| **Wire-like** | ⭐⭐ | **⭐⭐⭐⭐⭐** |

---

## Critical Files Reference

### Frontend
- `frontend/lib/widgets/chat_input_bar.dart` - Main input bar z action tiles
- `frontend/lib/widgets/chat_action_tiles.dart` - Action tiles row (Timer, Ping, Camera, Draw, GIF)
- `frontend/lib/screens/chat_detail_screen.dart` - Chat screen (używa ChatInputBar)

### Ikony Flutter
- Timer: `Icons.timer_outlined`
- **Ping: `Icons.auto_awesome`** (gwiazdka, Wire-style)
- Camera: `Icons.camera_alt`
- Draw: `Icons.brush`
- GIF: `Icons.gif_box`

---

## Screenshots Reference

- **ss1** (image #3): Obecny stan - kafelki NAD tekstem, duże, z tekstem
- **ss2** (image #4): Wire design - kafelki POD tekstem, kompaktowe, tylko ikony
- **image #5** (image #5): Wire Ping kafelek - gwiazdka ✱ (czerwona linia na dole)

---

## Estimated Effort

- **Zmiana kolejności (chat_input_bar):** 2 min
- **Container + padding (action_tiles):** 2 min
- **Tiles update (icon, tooltip, spacing):** 10 min
- **_ActionTile redesign (circular, icon-only):** 15 min
- **Testing (wszystkie scenariusze):** 15 min
- **TOTAL:** ~45 min

---

## Risk Assessment

**Niskie ryzyko:**
- ✅ Tylko zmiany UI/layout, bez logiki biznesowej
- ✅ Funkcjonalność pozostaje bez zmian (onTap handlers)
- ✅ Hot reload dostępny (szybka iteracja)
- ✅ Theme-aware colors (dark/light)

**Potencjalne problemy:**
- ⚠️ Tooltip może nie działać na mobile (zależnie od platformy) → nie krytyczne
- ⚠️ Icons.auto_awesome może wyglądać inaczej niż Wire → fallback: Icons.stars

---

## Final Notes

Ten redesign implementuje **Option A** z research planu (`sparkling-cuddling-reef-agent-aa2a25b.md`): kompaktowy, icon-only design inspirowany Wire/Telegram.

**Zgodność z Wire:**
- ✅ Pozycja POD tekstem
- ✅ Kompaktowa wysokość (~48px)
- ✅ Tylko ikony (bez tekstu)
- ✅ Circular tiles
- ✅ Gwiazdka dla Pinga
- ✅ Równomierne spacing

**Zachowane:**
- ✅ Theme-aware colors (RpgTheme)
- ✅ Wszystkie funkcje (Timer, Ping, Camera, Draw, GIF)
- ✅ Accessibility (tooltips)
- ✅ InkWell ripple effect

**User może dalej:**
- Ustawić timer dla disappearing messages
- Wysłać ping
- Otworzyć kamerę / galerie
- Rysować na canvasie
- (GIF picker - coming soon)
