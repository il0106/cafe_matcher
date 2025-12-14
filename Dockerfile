# Стадия сборки
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Стадия продакшена
FROM node:20-alpine

WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем только serve для статического сервера
RUN npm install -g serve

# Копируем собранные файлы
COPY --from=builder /app/dist ./dist

# Открываем порт
EXPOSE 3333

# Запускаем serve
CMD ["serve", "-s", "dist", "-l", "3333"]

