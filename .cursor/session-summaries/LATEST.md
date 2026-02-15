# Ostatnia sesja (najnowsze podsumowanie)

**Data:** 2026-02-13  
**Pełne podsumowanie:** [2026-02-13-mobile-http-debugging.md](2026-02-13-mobile-http-debugging.md)

## Skrót
- **Mobile HTTP debugging (REVERTED):** Próba naprawy ładowania wiadomości na mobile. Odkryto że Android nie może tworzyć nowych połączeń TCP kiedy WebSocket jest aktywny. Wszystkie zmiany (~641 linii) cofnięte. Czysty stan z ostatniego commita.
- **Rekomendacja:** Użyć WebSocket chunking bezpośrednio (bez HTTP) — wiadomości ładują się w ~2s przez WS chunki.
