FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# Apply pending migrations (runtime có quyền truy cập DB), rồi khởi động server
CMD ["sh", "-c", "npm run db:migrate && npm start"]
