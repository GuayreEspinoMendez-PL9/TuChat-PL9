# TUCHAT

Plataforma de comunicacion academica para centros educativos, con soporte web y movil.

Acceso web: https://tu-chat-pl-9.vercel.app

## Plataformas
- Web
- Android
- iOS

## Funcionalidades de la aplicacion

### Acceso y sesion
- Inicio de sesion con identificador institucional.
- Cierre de sesion desde el menu principal.
- Redireccion por perfil de usuario.

### Inicio y navegacion de chats
- Vista de conversaciones con dos pestañas:
- Grupos academicos.
- Chats privados.
- Indicadores de mensajes no leidos por chat y por seccion.
- Vista responsive:
- En escritorio se muestra lista + chat en paralelo.
- En movil se abre la conversacion en pantalla completa.

### Mensajeria en tiempo real
- Envio y recepcion instantanea de mensajes.
- Estados de mensaje (enviado, entregado, leido).
- Respuesta a mensajes (hilos ligeros dentro de la conversacion).
- Copiado rapido de contenido.
- Reacciones con emojis.
- Menus de acciones por mensaje.

### Archivos y multimedia
- Envio de imagenes, videos y documentos.
- Vista previa de imagen y video dentro del chat.
- Apertura/descarga de archivos adjuntos.
- Validacion de tamano maximo en adjuntos para evitar errores de envio.

### Mensajes fijados (pins)
- Fijar mensajes relevantes dentro del chat.
- Categorizacion visual de pines.
- Seleccion de color para cada pin.
- Duracion configurable:
- Presets (24 horas, 7 dias, 1 mes).
- Duracion personalizada (minutos, horas o dias).
- Banner de pines activos con vista expandida.
- Desfijado de mensajes con permisos.

### Gestion del chat de clase
- Vista de informacion del chat.
- Lista de participantes por rol (profesorado/alumnado).
- Configuracion de permisos de escritura en grupos:
- Todos pueden escribir.
- Solo profesorado.
- Profesorado + delegados.
- Seleccion de delegados en el propio chat.

### Llamadas
- Llamadas de audio.
- Llamadas de video.
- Controles durante llamada:
- Silenciar microfono.
- Activar/desactivar camara.
- Compartir pantalla en web.
- Conteo de participantes en tiempo real.

### Perfil
- Visualizacion de datos personales y academicos.
- Cambio de contraseña desde la app.

### Ajustes
- Activacion/desactivacion de notificaciones.
- Control de sonidos.
- Descarga automatica de medios.
- Selector de tema visual:
- Claro, oscuro, sistema.
- Variantes de color adicionales.
- Limpieza de mensajes antiguos.
- Acceso a sincronizacion con web.

### Sincronizacion entre movil y web
- Flujo de emparejamiento mediante codigo QR.
- Importacion de mensajes en sesion web.
- Indicadores de progreso y estado.
- Confirmacion final de sincronizacion.

### FAQ y ayuda
- Pantalla de preguntas frecuentes con buscador.
- Respuestas rapidas de uso comun.

## Panel de administracion

Incluye un panel completo para gestion academica y operativa:
- Resumen general con metricas.
- Gestion de centros.
- Gestion de personas (alumnos/profesores).
- Gestion de cursos escolares.
- Gestion de planes de estudio.
- Gestion de asignaturas.
- Gestion de ofertas.
- Gestion de clases.
- Matriculas.
- Asignaciones de profesorado.
- Gestion de usuarios de la app.
- Gestion de salas de chat.
- Auditoria de acciones administrativas.
- Asistente para alta guiada de clases.

## Ejecucion en local (resumen)
1. Iniciar backend.
2. Iniciar app desde `tuchat/` con Expo.
3. Abrir en web o dispositivo movil.

## Estructura del repositorio
- `tuchat/`: aplicacion cliente (web + movil).
- `server/`: servicios del backend.
