# Oferta Studio

Generator ofert handlowych z podglądem dokumentu i eksportem do PDF.

## Jak korzystać

1. Otwórz aplikację na hostingu statycznym, np. GitHub Pages. Lokalny podgląd również powinien udostępniać folder przez HTTP, ponieważ aplikacja wczytuje moduły JavaScript i plik czcionki. Samo otwarcie HTML przez `file://` nie wystarcza.
2. W **Firma i klient** wybierz wystawcę i wpisz dane klienta.
3. W **Pozycje** dodaj produkty lub usługi, ilość, cenę netto i stawkę VAT. W razie potrzeby ustaw rabat.
4. W **Szczegóły** uzupełnij tytuł, numer, daty, warunki współpracy, płatność i podpis.
5. Wybierz styl **Editorial**, **Classic** lub **Minimal** i sprawdź podgląd. Strzałki nad dokumentem przełączają strony.
6. Kliknij **Pobierz ofertę PDF**. Aplikacja wskaże brakujące lub nieprawidłowe dane.

**Nowa oferta** tworzy pusty formularz klienta i pozycję do uzupełnienia. **Wczytaj przykład** przywraca ofertę przykładową. Zastąpienie bieżącego szkicu wymaga potwierdzenia.

Szkic zapisuje się automatycznie w tej przeglądarce. **Zapisz wersję** zachowuje osobną kopię, dostępną w **Zapisane oferty**. Można przechowywać do 20 wersji.

W **Zapisane oferty** wybierz **Eksportuj bieżący szkic**, aby pobrać JSON do dalszej edycji lub przeniesienia na inne urządzenie. **Wczytaj plik oferty** odtwarza taki plik. PDF służy do przekazania gotowego dokumentu klientowi.

Dane dołączonych firm są przykładowe. Generowany dokument jest ofertą handlową.

## Jak działa

Aplikacja składa się z osobnych plików HTML, CSS i JavaScript. Hosting udostępnia te pliki, a obliczenia, podgląd i tworzenie PDF wykonuje przeglądarka. Projekt nie wymaga Node.js, instalacji pakietów, procesu budowania, własnego backendu ani bazy danych.

| Plik | Rola |
| --- | --- |
| `index.html` | Struktura strony, formularze i przyciski. |
| `style.css` | Wygląd interfejsu i układ na różnych ekranach. |
| `app.js` | Obsługa formularzy, przycisków, podglądu i zapisywania. |
| `core.js` | Profile firm, obliczenia i sprawdzanie danych. |
| `pdf.js` | Układ stron, podgląd SVG i tworzenie PDF. |
| `assets/` | Czcionka, jej licencja i ikona aplikacji. |
| `README.md` | Instrukcja korzystania i opis działania. |

Dane formularza są przechowywane w obiekcie `state`. Zmiana pola aktualizuje dane, przelicza wartości i odświeża podgląd. Profile wystawców są zapisane w tablicy `COMPANIES` w `core.js`; wybór firmy zmienia jej oznaczenie, kolory, kontakty i pozostałe dane dokumentu.

Kwoty obliczane są w groszach. Dla każdej pozycji najpierw wyliczana jest wartość netto, następnie rabat i VAT od kwoty po rabacie. Wyniki są zaokrąglane osobno dla każdej pozycji i sumowane w podsumowaniu.

Wspólny układ stron służy do wyświetlenia podglądu SVG i utworzenia pliku PDF. Dłuższe oferty są dzielone na strony. PDF zawiera osadzoną czcionkę i tekst możliwy do zaznaczania.

Szkic i zapisane wersje trafiają do `localStorage` tej przeglądarki. Nie synchronizują się między urządzeniami. Wyczyszczenie danych witryny może je usunąć; eksport JSON pozwala zachować osobną kopię.

Aby opublikować projekt, umieść wszystkie pliki i folder `assets/` w katalogu głównym hostingu lub repozytorium używanego przez GitHub Pages. Zachowaj ich nazwy i wzajemne położenie. Zmiany w HTML, CSS i JavaScript działają bez dodatkowej komendy budowania.
