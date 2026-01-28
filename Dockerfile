FROM node:20-alpine

WORKDIR /app

# Najpierw kopiujemy package*.json — dzięki temu Docker cachuje
# warstwę z node_modules (szybszy rebuild gdy zmienia się tylko kod)
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
