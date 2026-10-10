# Fonts: source

Downloaded 2026-10-10 from Google Fonts (fonts.gstatic.com, WOFF2 as served to desktop Chrome), from this CSS request:

`https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Literata:ital,opsz,wght@0,7..72,500;0,7..72,600;1,7..72,500&display=swap`

| Family | Google Fonts version | Files |
|---|---|---|
| Literata | `/s/literata/v40/` | roman: variable (wght 400-900, opsz 7-72); italic 500: static weight with opsz 7-72 |
| IBM Plex Sans | `/s/ibmplexsans/v23/` | roman: variable (wght 100-700); italic 400: static |
| IBM Plex Mono | `/s/ibmplexmono/v20/` | 400 and 500: static |

Subsets: `cyrillic` and `latin` only (cyrillic-ext, latin-ext, greek, greek-ext, vietnamese skipped). The `unicode-range` values in `fonts.css` are copied unchanged from the Google CSS. Font files are unmodified.

License: SIL Open Font License 1.1.
- Literata: `OFL-Literata.txt` (google/fonts `ofl/literata/OFL.txt`).
- IBM Plex Sans and IBM Plex Mono: `OFL-IBM-Plex.txt` (google/fonts `ofl/ibmplexsans/OFL.txt`; identical to `ofl/ibmplexmono/OFL.txt`). Reserved Font Name "Plex".

## Изменения для /liver-update/ (2026-10-10)

- **Literata** (OFL 1.1, без Reserved Font Name — изменённая версия может сохранять имя):
  `literata-cyrillic.woff2` и `literata-latin.woff2` пересобраны fontTools 4.61.1:
  ось `wght` сужена до 500–600 (`fontTools.varLib.instancer wght=500:600`), ось `opsz` 7–72 сохранена;
  latin-файл урезан до U+0020-007E, U+00A0-00FF, U+2010-2027, U+2030-203A, U+20AC, U+2122, U+2212.
  Итог: 46,8 → 39 КБ и 83,8 → 67 КБ. Курсив Literata удалён (не используется).
- **IBM Plex Sans / Mono** (OFL 1.1, Reserved Font Name «Plex») — файлы не изменялись; Plex Mono 500 удалён (используется только 400).
