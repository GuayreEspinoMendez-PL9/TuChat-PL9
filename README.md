# TUCHAT (PL9)

Aplicacion de comunicacion academica tipo chat en formato monorepo.

## Estado actual de despliegue
- Backend API + Socket.IO: Render
- URL backend produccion: `https://tuchat-pl9.onrender.com`
- Frontend web: Vercel
- App movil: Expo (Android/iOS)

## Stack
- App: Expo + React Native + Expo Router
- Backend: Node.js + Express + Socket.IO
- Cache/buzon offline: Redis
- Base de datos principal: PostgreSQL (Supabase)
- Notificaciones push: Expo Push
- Hosting: Render (server) + Vercel (web)

## Estructura
- `tuchat/`: app movil/web
- `server/`: API REST + WebSocket
- `docker-compose.yml`: Redis local

## Funcionalidades destacadas
- Chat en tiempo real por salas y chats privados
- Cola de mensajes offline con Redis
- Reacciones en mensajes
- Notificaciones push
- Videollamada tipo meet (WebRTC)
- Panel admin academico
- Selector de temas (`light`, `dark`, `system`, `green`, `red`, `yellow`)
- Picker de reacciones con emojis dinamicos desde `https://www.emoji.family/api/emojis/` con fallback local

## Requisitos locales
- Node.js LTS
- npm
- Docker Desktop
- Proyecto en Supabase (Postgres)

## Variables de entorno (server/.env)
```bash
PORT=4000

# Postgres principal (Supabase)
DATABASE_URL=postgres://...

# Postgres externo academico (si aplica en tu entorno)
DATABASE_GOB_URL=postgres://...

# JWT
JWT_SECRET=tu_secreto_jwt

# Redis local
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# Opcional en cloud
# REDIS_URL=redis://...

# Opcional TURN dinamico para meet
# METERED_API_KEY=...
# METERED_APP_NAME=...
```

## Desarrollo local
1. Levantar Redis
```bash
docker compose up -d
```

2. Levantar backend
```bash
cd server
npm install
npm run dev
```

3. Levantar app
```bash
cd tuchat
npm install
npx expo start -c
```

## Endpoints de salud
- `GET http://localhost:4000/health`
- `GET http://localhost:4000/health/db`
- `GET http://localhost:4000/health/redis`

## Produccion
### Backend (Render)
- Runtime: Node.js
- Start command: `node index.js`
- Configurar variables de entorno de `server/.env` en el panel de Render
- Exponer puerto via variable `PORT` asignada por Render

### Frontend web (Vercel)
- Proyecto apuntando a `tuchat/`
- Build/serve segun configuracion de Expo web
- La app web consume el backend en `https://tuchat-pl9.onrender.com`

## Notas
- `docker-compose.yml` de este repo levanta Redis (no MySQL).
- El backend no tiene suite de tests automatizados completa todavia.