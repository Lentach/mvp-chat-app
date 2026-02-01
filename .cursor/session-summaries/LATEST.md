# Ostatnia sesja (najnowsze podsumowanie)

**Data:** 2026-02-01  
**Pełne podsumowanie:** [2026-02-01-session.md](2026-02-01-session.md)

## Skrót
- **Avatar update fix:** Backend nie usuwał już dopiero wgranego avatara (deleteAvatar tylko gdy oldPublicId !== newPublicId). Ikona kamery otwiera galerię bezpośrednio (usunięto ProfilePictureDialog).
- **Wcześniej – Dark Mode Delete Account Palette:** Dark mode w jednej kolorystyce jak dialog Delete Account. Akcent czerwono-różowy (#FF6666) zamiast złota; obwódki/secondary (borderDark, mutedDark) zamiast fioletu. Kafelki w Settings w dark: tło i obwódka jak komunikat „This action is permanent…”. Light mode bez zmian. RpgTheme: accentDark, borderDark, mutedDark, settingsTileBgDark, itd.; wszystkie widgety w dark zaktualizowane.
