# Cafe Matcher - Telegram Mini App

Простое приложение на Preact для интеграции в Telegram Mini App.

## Установка

```bash
npm install
```

## Разработка

```bash
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`

## Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в папке `dist/`

## Запуск через Docker

### Разработка (dev режим)

```bash
docker-compose --profile dev up --build
```

Приложение будет доступно по адресу `http://localhost:3000` с hot-reload.

### Продакшен

```bash
docker-compose --profile prod up --build -d
```

Приложение будет доступно по адресу `http://localhost:80` (или `http://localhost`).

### Остановка

```bash
docker-compose down
```

## Интеграция с Telegram

1. Запустите продакшен версию через Docker: `docker-compose --profile prod up -d`
2. Настройте ваш сервер/домен для доступа к приложению
3. В BotFather создайте Mini App и укажите URL вашего приложения
4. Приложение автоматически интегрируется с Telegram WebApp API

## Особенности

- ✅ Использует Preact для легковесного UI
- ✅ Интеграция с Telegram WebApp API
- ✅ Поддержка тем Telegram (светлая/темная)
- ✅ Haptic feedback при взаимодействии
- ✅ Адаптивный дизайн

## Структура проекта

```
├── src/
│   ├── App.jsx         # Основной компонент
│   ├── main.jsx        # Точка входа
│   └── style.css       # Стили
├── index.html          # HTML шаблон
├── vite.config.js      # Конфигурация Vite
├── package.json        # Зависимости
├── Dockerfile          # Dockerfile для продакшена
├── Dockerfile.dev      # Dockerfile для разработки
├── docker-compose.yml  # Docker Compose конфигурация
└── .dockerignore       # Исключения для Docker
```

