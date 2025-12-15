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

# Копируем package файлы и устанавливаем зависимости
COPY package*.json ./
RUN npm install --production

# Копируем собранные файлы
COPY --from=builder /app/dist ./dist

# Копируем backend сервер
COPY server ./server

# Открываем порт
EXPOSE 3333

# Запускаем backend сервер (он отдает статические файлы)
CMD ["node", "server/index.js"]

