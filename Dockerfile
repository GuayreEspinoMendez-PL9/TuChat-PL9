FROM node:20-slim

WORKDIR /app

# Copiamos los package del server específicamente
COPY server/package*.json ./

RUN npm install --production

# Copiamos todo el contenido de la carpeta server
COPY server/ .

# Exponemos el puerto de Render
EXPOSE 10000

CMD ["node", "index.js"]