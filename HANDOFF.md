# Handoff — denisyudin.com

> Инструкция для продолжения работы с проектом (для AI-агента или разработчика).

## Быстрый старт

```bash
cd /Users/denisyudin/Documents/CURSOR/SITE/denisyudin.com

# Локальный просмотр
python3 -m http.server 8080
# Открыть http://localhost:8080

# Деплой после изменений
git add -A && git commit -m "описание изменений" && git push origin main
# GitHub Pages подхватит автоматически через ~1 мин
```

## Ключевые URL

| Что | URL |
|-----|-----|
| Продакшн | https://inkhv.github.io/denisyudin.com/ |
| Репозиторий | https://github.com/inkhv/denisyudin.com |
| Оригинал (Webflow) | https://denisyudin.com |
| Страница Claude Code | https://inkhv.github.io/denisyudin.com/claude/ |

## Как устроены пути

- Корневые страницы (`index.html`, `about.html`) ссылаются на ассеты как `./assets/filename`
- Вложенные страницы (`cases/`, `blog/`, `categories/`, `claude/`) — `../assets/filename`
- Все ассеты лежат в одной плоской папке `assets/` (без подпапок)

## Как добавить новую страницу

1. Создать папку (например `new-page/`)
2. Создать `new-page/index.html`
3. Пути к ассетам: `../assets/filename`
4. Для самостоятельных страниц (не из Webflow) — см. `claude/index.html` как шаблон
5. `git add && git commit && git push`

## Как обновить сайт из Webflow

Если сайт обновился в Webflow и нужно перезалить:

```bash
cd /Users/denisyudin/Documents/CURSOR/SITE

# Бэкап текущей версии
cp -r denisyudin.com denisyudin.com.bak

# Перескачать
wget --mirror --convert-links --adjust-extension \
     --page-requisites --no-parent \
     --directory-prefix=./fresh-export \
     https://denisyudin.com

# Скачать ассеты с CDN — использовать скрипты из предыдущего экспорта
# или попросить AI-агента повторить процесс
```

**Важно:** после перескачки нужно заново заменить CDN-пути на локальные и сохранить кастомные страницы (`claude/`).

## Как подключить кастомный домен

1. В DNS-провайдере домена `denisyudin.com` добавить:
   - **CNAME** запись: `www` → `inkhv.github.io`
   - **A** записи (для apex домена):
     ```
     185.199.108.153
     185.199.109.153
     185.199.110.153
     185.199.111.153
     ```

2. В GitHub:
   ```bash
   # Создать CNAME файл
   echo "denisyudin.com" > CNAME
   git add CNAME && git commit -m "Add custom domain" && git push
   ```

3. В GitHub Settings → Pages → Custom domain: `denisyudin.com`
4. Включить "Enforce HTTPS"

**Внимание:** после привязки домена Webflow перестанет отдавать сайт на `denisyudin.com` — DNS будет указывать на GitHub.

## Что можно улучшить

- [ ] Оптимизировать тяжёлые картинки (есть файл 84 МБ)
- [ ] Добавить `sitemap.xml` для SEO
- [ ] Заполнить `robots.txt`
- [ ] Убрать Webflow badge из HTML (если есть)
- [ ] Настроить кастомную 404-страницу
- [ ] Подключить кастомный домен `denisyudin.com`
- [ ] Настроить Cloudflare перед GitHub Pages для CDN и кеширования

## Контекст для AI-агента

- Проект — статический сайт, никаких сборщиков и фреймворков
- Все изменения деплоятся через `git push origin main`
- Страница `/claude` — единственная не-Webflow страница, свёрстана вручную
- Ассеты хранятся в плоской структуре `assets/`, имена файлов содержат хеши Webflow
- При редактировании Webflow-страниц: HTML минифицирован в 1-2 строки, работать аккуратно
