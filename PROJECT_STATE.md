# Project State — denisyudin.com

> Последнее обновление: 2026-04-12

## Обзор

Статический экспорт персонального сайта-портфолио **denisyudin.com**, извлечённого из Webflow и захостенного на GitHub Pages.

## Текущий статус

| Параметр | Значение |
|----------|----------|
| **URL продакшн** | https://inkhv.github.io/denisyudin.com/ |
| **Исходный домен** | denisyudin.com (Webflow) |
| **Репозиторий** | https://github.com/inkhv/denisyudin.com |
| **Ветка деплоя** | `main` |
| **Хостинг** | GitHub Pages |
| **Тип сайта** | Статический HTML/CSS/JS |
| **Размер** | ~425 МБ (590 ассетов) |

## Структура файлов

```
denisyudin.com/
├── index.html                  # Главная страница
├── about.html                  # О себе
├── portfolio.html              # Портфолио (все кейсы)
├── archive.html                # Архив работ
├── journal.html                # Журнал / блог
├── robots.txt                  # (пустой)
│
├── cases/                      # Кейсы (8 проектов)
│   ├── atom.html
│   ├── binadi.html
│   ├── bolmat.html
│   ├── emerging.html
│   ├── gabrielandester.html
│   ├── samokat.html
│   ├── tsaritsino.html
│   ├── wildberries.html
│   └── yakov-partners.html
│
├── blog/                       # Статьи (5 постов)
│   ├── breaking-boundaries-with-augmented-reality-...html
│   ├── designing-for-user-experience-...html
│   ├── from-sketch-to-screen-...html
│   ├── the-rise-of-sustainable-design-...html
│   └── unleashing-the-potential-of-typography-...html
│
├── categories/                 # Фильтры по категориям
│   ├── art-direction.html
│   ├── concept.html
│   └── web-design.html
│
├── claude/                     # Страница с конспектом Claude Code
│   └── index.html              # /claude — отдельная вёрстка, не Webflow
│
└── assets/                     # Все ассеты (590 файлов, ~425 МБ)
    ├── denis-yudin.webflow.shared.e11572194.css   # Главный CSS
    ├── jquery-3.5.1.min.dc5e7f18c8.js             # jQuery
    ├── webflow.*.js                                # Webflow runtime (3 файла)
    ├── *.jpg / *.png / *.webp                      # Изображения
    ├── *.mp4 / *.webm                              # Видео
    └── *.gif                                       # Анимации
```

## Технологический стек

| Компонент | Технология |
|-----------|------------|
| Вёрстка | HTML5, Webflow-generated |
| Стили | Webflow CSS (shared), inline `<style>` per page |
| JS | jQuery 3.5.1, Webflow runtime |
| Шрифты | Google Fonts: Lato, IBM Plex Serif, Manrope |
| Хостинг | GitHub Pages (static) |
| Страница /claude | Самостоятельная вёрстка, Inter + JetBrains Mono |

## Что было сделано

1. **Экспорт из Webflow** — скачаны все 22 HTML-страницы через `wget --mirror`
2. **Скачивание ассетов** — 590 файлов с CDN `cdn.prod.website-files.com` и CloudFront
3. **Локализация путей** — все CDN-ссылки заменены на локальные `./assets/` / `../assets/`
4. **Обработка encoded URLs** — double-encoded пути в CMS-шаблонах Webflow (wf-template) декодированы и заменены
5. **Публикация** — создан репозиторий на GitHub, включён GitHub Pages
6. **Страница /claude** — свёрстана отдельная страница с конспектом курса по Claude Code (тёмная тема, Inter/JetBrains Mono)

## Известные особенности

- **Большой файл** — `67a53f2334eca52bccb5bbed_wb_4-p-1600.jpg` весит 84 МБ (GitHub предупреждает, но не блокирует)
- **CMS-шаблоны** — Webflow CMS-контент в `cases/` хранится в URL-encoded `<script type="text/x-wf-template">` блоках. Ссылки внутри них также заменены на локальные
- **robots.txt** — пустой файл (Webflow не сгенерировал содержимое)
- **Webflow badge** — в HTML могут присутствовать следы Webflow-бейджа
- **Анимации** — Webflow-анимации (через webflow.js) могут работать не полностью без оригинального JS-рантайма

## Git-история

```
4362376 Add /claude page with Claude Code course notes
297878d Initial commit: denisyudin.com static export from Webflow
```
