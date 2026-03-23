# TUCHAT

Plataforma de comunicacion academica para centros educativos, con cliente web y movil y backend en tiempo real.

Acceso web publicado: `https://tu-chat-pl-9.vercel.app`

## Stack

- Cliente: Expo + React Native + Expo Router
- Tiempo real: Socket.IO
- Backend: Express
- Persistencia local:
  - Movil: SQLite (`expo-sqlite`)
  - Web: `localStorage`

## Plataformas soportadas

- Web
- Android
- iOS

## Funcionalidades actuales

### Acceso y sesion

- Inicio de sesion con usuario institucional.
- Cierre de sesion desde la aplicacion.
- Carga de perfil y rol de usuario.

### Chats y navegacion

- Lista de conversaciones dividida en:
  - Grupos academicos
  - Chats privados
- Vista responsive:
  - Escritorio: listado + chat en paralelo
  - Movil: conversacion a pantalla completa
- Conteo de no leidos por chat y por seccion.
- Navegacion directa al mensaje cuando se abre un resultado de busqueda o un elemento importante.

### Mensajeria en tiempo real

- Envio y recepcion instantanea de mensajes.
- Estados de mensaje:
  - Enviado
  - Entregado
  - Leido
- Respuesta a mensajes.
- Reacciones con emojis.
- Copia rapida de mensajes.
- Indicador de escritura.
- Estado de presencia:
  - Disponible
  - En clase
  - Ocupado

### Mensajeria academica avanzada

- Hilos tematicos por `threadTopic` dentro del grupo.
- Tipos de mensaje docente:
  - Anuncio oficial
  - Obligatorio leer
  - Material evaluable
  - Cambio urgente
- Confirmacion de lectura fuerte con lista de lectores.
- Filtros por hilo dentro del chat.

### Busqueda avanzada

- Busqueda global por:
  - Texto del mensaje
  - Archivo
  - Persona
  - Tipo de mensaje
  - Hilo
  - Fecha
  - Eventos
  - Encuestas
  - Pines
- Filtros rapidos:
  - Importantes
  - Archivos
  - Lectura fuerte
- Apertura directa del chat y del punto relevante:
  - Mensaje concreto
  - Panel de eventos
  - Panel de encuestas
  - Info del chat

### Bandeja de importantes

- Vista "Solo importante" desde el inicio.
- Incluye:
  - Mensajes docentes marcados como importantes
  - Eventos
  - Encuestas
  - Pines activos

### Archivos y multimedia

- Envio de imagenes, videos y documentos.
- Vista previa de imagen y video.
- Centro de archivos dentro de `ChatInfoScreen`.
- Filtros por tipo:
  - Documentos
  - Imagenes
  - Videos
  - Enlaces
  - Importantes
  - Lectura fuerte
- Acciones desde archivos:
  - Abrir recurso
  - Ir al mensaje original

### Pines, eventos y encuestas

- Mensajes fijados con categoria, color y duracion.
- Eventos por sala con fecha y descripcion.
- Encuestas por sala con votacion y cierre.
- Persistencia local de:
  - Pines
  - Eventos
  - Encuestas

### Gestion del chat

- Informacion del chat con participantes.
- Separacion visual entre profesorado y alumnado.
- Configuracion de permisos de escritura:
  - Todos
  - Solo profesorado
  - Profesorado y delegados
- Seleccion de delegados.

### Llamadas

- Llamadas de audio.
- Llamadas de video.
- Flujo tipo sala en tiempo real con WebRTC.
- Controles de microfono y camara.
- Compartir pantalla en web.

### Temas y experiencia visual

- `ThemeContext` con modos:
  - Light
  - Dark
  - System
  - Green
  - Red
  - Yellow
- Uso de tema aplicado en cliente para colores base, superficies, overlays, inputs, badges y pantallas principales.

### Sincronizacion movil-web

- Emparejamiento por codigo QR.
- Transferencia de mensajes locales a sesion web.
- Seguimiento de progreso.

### Panel de administracion

El proyecto incluye panel administrativo para gestion academica y operativa:

- Centros
- Personas
- Cursos escolares
- Planes
- Asignaturas
- Ofertas
- Clases
- Matriculas
- Usuarios de app
- Salas de chat
- Auditoria

## Persistencia local

### Movil

Se usa SQLite para almacenar:

- Mensajes
- Borradores
- Pines
- Metadata indexable para busqueda
- Estados de lectura fuerte

### Web

Se usa `localStorage` para almacenar:

- Historial por chat
- Borradores
- Pines
- Eventos
- Encuestas

## Estructura del repositorio

- `tuchat/`: cliente Expo para web y movil
- `server/`: backend Express + Socket.IO

## Ejecucion local

### Backend

Desde `server/`:

```bash
npm install
npm run dev
```

Comandos disponibles:

- `npm run dev`
- `npm start`

### Cliente

Desde `tuchat/`:

```bash
npm install
npm run start
```

Comandos disponibles:

- `npm run start`
- `npm run web`
- `npm run android`
- `npm run ios`

## Validacion recomendada

### Validacion tecnica

- Cliente:

```bash
cd tuchat
npx tsc --noEmit
```

### Pruebas manuales recomendadas

- Enviar mensajes normales y mensajes docentes con tipo.
- Confirmar lectura fuerte desde otro usuario.
- Crear evento, encuesta y pin.
- Buscar por texto, fecha, archivo, evento, encuesta y pin.
- Abrir "Solo importante" y navegar al chat correcto.
- Revisar `ChatInfoScreen > Archivos` en web y movil.
- Verificar persistencia tras cerrar y reabrir la app.

## Estado actual

El proyecto ya dispone de una base funcional de comunicacion academica en tiempo real con:

- almacenamiento local web y movil
- navegacion responsive
- mensajeria avanzada orientada a aula
- busqueda indexada
- centro de archivos
- bandeja de importantes
- soporte de eventos, encuestas y pines

```
copia
├─ docker-compose.yml
├─ Dockerfile
├─ README.md
├─ server
│  ├─ academico
│  │  ├─ academico.controller.js
│  │  └─ admin.controller.js
│  ├─ app.js
│  ├─ auth
│  │  ├─ admin.middleware.js
│  │  ├─ auth.controller.js
│  │  ├─ auth.middleware.js
│  │  └─ auth.service.js
│  ├─ db
│  │  └─ db.js
│  ├─ index.js
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ redis.js
│  ├─ routes
│  │  ├─ academico.routes.js
│  │  ├─ admin.routes.js
│  │  ├─ auth.routes.js
│  │  ├─ chat.routes.js
│  │  └─ mensajes.routes.js
│  └─ services
│     ├─ collab.persistence.js
│     ├─ collab.store.js
│     ├─ messageStatus.persistence.js
│     ├─ pendingMessages.service.js
│     └─ push.service.js
└─ tuchat
   ├─ app
   │  ├─ (tabs)
   │  │  ├─ index.tsx
   │  │  ├─ two.tsx
   │  │  └─ _layout.tsx
   │  ├─ +html.tsx
   │  ├─ +not-found.tsx
   │  ├─ admin.tsx
   │  ├─ chat-info.tsx
   │  ├─ chat.tsx
   │  ├─ faq.tsx
   │  ├─ index.tsx
   │  ├─ llamada.tsx
   │  ├─ login.tsx
   │  ├─ modal.tsx
   │  ├─ profile.tsx
   │  ├─ settings-info.tsx
   │  ├─ settings.tsx
   │  └─ _layout.tsx
   ├─ app.json
   ├─ assets
   │  ├─ fonts
   │  │  └─ SpaceMono-Regular.ttf
   │  └─ images
   │     ├─ adaptive-icon.png
   │     ├─ favicon.png
   │     ├─ icon.png
   │     ├─ logo.png
   │     └─ splash-icon.png
   ├─ components
   │  ├─ EditScreenInfo.tsx
   │  ├─ ExternalLink.tsx
   │  ├─ StyledText.tsx
   │  ├─ Themed.tsx
   │  ├─ useClientOnlyValue.ts
   │  ├─ useClientOnlyValue.web.ts
   │  ├─ useColorScheme.ts
   │  ├─ useColorScheme.web.ts
   │  └─ __tests__
   │     └─ StyledText-test.js
   ├─ constants
   │  └─ Colors.ts
   ├─ expo-env.d.ts
   ├─ package-lock.json
   ├─ package.json
   ├─ src
   │  ├─ components
   │  │  ├─ Chat
   │  │  │  ├─ chat.styles.ts
   │  │  │  ├─ ChatInfoScreen.tsx
   │  │  │  ├─ ChatScreen.tsx
   │  │  │  ├─ MentionDropdown.tsx
   │  │  │  ├─ PinComponents.tsx
   │  │  │  └─ ReactionPicker.tsx
   │  │  ├─ ChatItem.tsx
   │  │  └─ ThemeSelector.tsx
   │  ├─ context
   │  │  ├─ SocketContext.tsx
   │  │  └─ ThemeContext.tsx
   │  ├─ db
   │  │  ├─ database.ts
   │  │  ├─ database.web.ts
   │  │  └─ messageModel.ts
   │  ├─ pages
   │  │  ├─ Admin
   │  │  │  ├─ AdminScreen.tsx
   │  │  │  ├─ admin_styles.ts
   │  │  │  └─ WizardClase.tsx
   │  │  ├─ Call
   │  │  │  ├─ Call.icons.tsx
   │  │  │  ├─ Call.styles.ts
   │  │  │  ├─ Call.tsx
   │  │  │  ├─ Call.types.ts
   │  │  │  └─ index.ts
   │  │  ├─ home
   │  │  │  ├─ home.styles.ts
   │  │  │  └─ HomeScreen.tsx
   │  │  └─ Login
   │  │     ├─ Login.styles.ts
   │  │     └─ LoginScreen.tsx
   │  ├─ screens
   │  │  ├─ FAQScreen.tsx
   │  │  ├─ ProfileScreen.tsx
   │  │  ├─ QrSyncScreen.tsx
   │  │  ├─ SettingsInfoScreen.tsx
   │  │  └─ SettingsScreen.tsx
   │  ├─ services
   │  │  ├─ browserNotifications.service.ts
   │  │  ├─ chatExtras.service.ts
   │  │  ├─ notifications.service.ts
   │  │  └─ syncService.ts
   │  ├─ types
   │  │  └─ pushjs.d.ts
   │  └─ utils
   │     ├─ auth.ts
   │     └─ mentions.ts
   └─ tsconfig.json

```