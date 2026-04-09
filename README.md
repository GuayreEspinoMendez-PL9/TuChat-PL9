# TUCHAT

Plataforma de comunicacion academica para centros educativos, con cliente web y movil y backend en tiempo real.

Acceso web publicado: `https://tu-chat-pl-9.vercel.app`

## Stack

- Cliente: Expo + React Native + Expo Router
- Tiempo real: Socket.IO
- Backend: Express
- Notificaciones:
  - Móvil: `expo-notifications` + Expo Push
  - Web: `push.js`
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
- Menciones a personas y menciones rapidas de rol:
  - `@delegados`
  - `@profesor`
  - `@todos`
- Resaltado visual de mensajes que mencionan al usuario.

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

### Notificaciones

- Notificaciones push en movil con registro de token Expo por usuario.
- Notificaciones de navegador en web.
- Navegacion directa al chat al pulsar una notificacion.
- Soporte para abrir destinos concretos desde notificacion:
  - Chat
  - Mensaje concreto
  - Paneles auxiliares como eventos, encuestas, menciones o informacion
- Preferencias sincronizadas con backend:
  - Activar o desactivar notificaciones
  - Activar o desactivar sonidos
- Fallback de entrega:
  - Si el destinatario no esta conectado, el servidor intenta enviar push.

### Gestion del chat

- Informacion del chat con participantes.
- Separacion visual entre profesorado y alumnado.
- Indicadores de presencia dentro de participantes:
  - Conectado
  - En clase
  - Ocupado
  - Desconectado
- Configuracion de permisos de escritura:
  - Todos
  - Solo profesorado
  - Profesorado y delegados
- Seleccion de delegados.
- Moderacion basica desde la informacion del chat.

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

### Ajustes y privacidad

- Pantalla de configuracion para:
  - Notificaciones
  - Sonidos
  - Confirmaciones de lectura
  - Tema
  - Descarga automatica de medios
  - Sincronizacion con web
  - Limpieza de mensajes antiguos
- Politica de privacidad y seccion "Acerca de".
- Confirmaciones de lectura configurables por usuario y persistidas en backend.

### Sincronizacion movil-web

- Emparejamiento por codigo QR.
- Transferencia de mensajes locales a sesion web.
- Seguimiento de progreso.
- Sincronizacion de mensajes recientes por bloques para evitar sobrecargas.
- Los adjuntos grandes pueden sincronizarse sin el binario para reducir peso de transferencia.

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
- Preferencia local de notificaciones del navegador
- Destino pendiente al abrir una notificacion

## Permisos y capacidades del cliente

### Android

- Camara
- Microfono
- Ajustes de audio
- Bluetooth
- Estado de red

### iOS

- Camara para videollamadas
- Microfono para llamadas

### Web

- Permiso de notificaciones del navegador

## Infraestructura incluida en el repo

- `docker-compose.yml`: levanta Redis (`redis:7-alpine`) en `localhost:6379`
- `Dockerfile`: imagen del backend `server/` con Node 20 y puerto expuesto `10000`

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

Servicios auxiliares opcionales:

```bash
docker compose up -d
```

Actualmente se incluye Redis para funcionalidades de soporte del backend.

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

Notas practicas:

- En movil, las notificaciones push requieren dispositivo fisico para obtener token Expo.
- En web, el navegador debe conceder permiso para mostrar notificaciones.
- Para Android, el proyecto ya incluye `google-services.json`.

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
- Probar menciones directas y por rol (`@delegados`, `@profesor`, `@todos`).
- Buscar por texto, fecha, archivo, evento, encuesta y pin.
- Abrir "Solo importante" y navegar al chat correcto.
- Revisar `ChatInfoScreen > Archivos` en web y movil.
- Verificar notificaciones:
  - Web con permiso del navegador
  - Push movil en dispositivo fisico
  - Apertura del chat correcto al pulsarlas
- Cambiar preferencias de notificaciones, sonidos y confirmaciones de lectura desde Ajustes.
- Validar sincronizacion movil → web con QR.
- Verificar persistencia tras cerrar y reabrir la app.

## Estado actual

- almacenamiento local web y movil
- navegacion responsive
- mensajeria avanzada orientada a aula
- busqueda indexada
- centro de archivos
- bandeja de importantes
- soporte de eventos, encuestas y pines
- notificaciones web y push movil
- ajustes de privacidad y experiencia
- sincronizacion por QR entre movil y web

## Referencias

- Documentación oficial de [Expo](https://docs.expo.dev/).
- Documentación oficial de [React Native](https://reactnative.dev/docs/getting-started).
- Documentación oficial de [Express](https://expressjs.com/).
- Documentación oficial de [Socket.IO](https://socket.io/docs/v4/).
- Documentación oficial de [Supabase](https://supabase.com/docs).
- Documentación oficial de [PostgreSQL](https://www.postgresql.org/docs/).
- Documentación oficial de [Redis](https://redis.io/docs/latest/).
- Documentación oficial de [WebRTC](https://webrtc.org/).
- [WhatsApp](https://www.whatsapp.com/).
- [Microsoft Teams](https://www.microsoft.com/microsoft-teams/group-chat-software).
- [Campus - Gobierno de Canarias](https://www3.gobiernodecanarias.org/medusa/eforma/campus/my/).
- [OpenAI](https://openai.com/).
- [Anthropic / Claude](https://claude.com/product/overview).
- Tutoriales de YouTube de [Mouredev](https://www.youtube.com/@mouredev).
- Tutoriales de YouTube de [Midudev](https://www.youtube.com/@midudev).


## Estructura

```
PL9
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
