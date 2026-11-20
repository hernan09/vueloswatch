# VuelosWatch

**Webapp** (React) + backend (Node) que vigila precios de vuelos según un formulario simple (origen, destino, fechas, tope en USD) y te avisa con notificaciones / Web Push.

> La versión Expo/APK quedó en `mobile/` como legado. Lo recomendado ahora es la webapp en `web/` (sin bloqueos de Network Security Policy de Android).

## Uso rápido (Xiaomi / cualquier celu)

```bash
cd backend && npm start
```

En Chrome del celular (misma WiFi):

```text
http://IP_DE_TU_MAC:3001
```

Guía: [`WEBAPP.md`](./WEBAPP.md)

## ¿App nativa o webapp en Vercel?

| | Expo + backend (esta solución) | Webapp / PWA en Vercel |
|---|---|---|
| Push | Nativas vía Expo Push (iOS/Android) | Web Push limitado; en iPhone es frágil |
| Background | El **servidor** hace el chequeo con cron | Un browser en el celu no puede scrapear en background de forma fiable |
| Instalar / probar | Expo Go en minutos | Solo abrir URL, pero sin vigilancia real |
| Scraping en el teléfono | No hace falta (y iOS lo mata) | Peor: pestaña dormida = se corta |

**Conclusión:** la mejor solución es **app Expo liviana + backend siempre encendido**. La app solo configura alertas y recibe push. El scraping/búsqueda **no** corre en el celular.

> Scrapear Despegar/aerolíneas con HTML casero suele romperse (CAPTCHA, bloqueos, ToS). Este MVP usa modo `demo` (ofertas simuladas para probar push) y opcionalmente **Amadeus API**. Para producción: APIs oficiales/afiliados, no bots frágiles.

## Arquitectura

```
Celular (Expo)  --crea alerta-->  Backend Node (cron cada N min)
       ^                              |
       |                              v
       +----- Expo Push API <--- match bajo el tope
```

## Requisitos

- Node.js 18+
- Celular físico (Android o iPhone)
- App **Expo Go** desde Play Store / App Store
- Misma WiFi entre la PC y el celular (para desarrollo)

## 1) Backend

```bash
cd backend
npm install
npm start
```

Queda en `http://0.0.0.0:3001`.

Endpoints útiles:

- `GET /health`
- `POST /alerts`
- `POST /check-now` → fuerza un chequeo inmediato

Opcional (precios reales con Amadeus test):

```bash
export FLIGHT_PROVIDER=amadeus
export AMADEUS_CLIENT_ID=...
export AMADEUS_CLIENT_SECRET=...
npm start
```

## 2) App móvil

```bash
cd mobile
npm install
npx expo start
```

Escaneá el QR con Expo Go.

### Importante: IP del backend

En el celular, `localhost` es el teléfono, no tu PC.

1. En la Mac/PC: `ipconfig getifaddr en0` (o mirá la IP WiFi).
2. Arrancá Expo apuntando al backend:

```bash
EXPO_PUBLIC_API_URL=http://TU_IP_LAN:3001 npx expo start
```

Ejemplo: `EXPO_PUBLIC_API_URL=http://192.168.0.15:3001 npx expo start`

## 3) Probar el flujo completo

1. Abrí la app → aceptá notificaciones.
2. Completá origen/destino/fechas/tope → **Activar alerta**.
3. Tocá **Chequear ahora** (o esperá el cron, default 5 min).
4. Debería llegar una push con badge tipo `DESP:AR` / `KAY:LA`.

## Instalación “como app” en el celular (sin store)

### Opción A — Expo Go (pruebas rápidas)

Sirve para el formulario, pero en **Android no hay push con la app cerrada**.

### Opción B — APK propia con push (recomendada)

Seguí la guía completa: [`INSTALL-ANDROID.md`](./INSTALL-ANDROID.md)

Resumen:

```bash
cd mobile
npx eas-cli login
npx eas-cli init
# + Firebase google-services.json + FCM credentials
npx eas-cli build -p android --profile preview
```

Instalá el `.apk` en el celular. Al tocar la push se abre el link del vuelo.

## Notas

- Las push remotas **no funcionan bien en emulador/simulador**: usá celular real.
- El backend debe estar corriendo (en tu PC, un VPS o Railway/Render) para que las alertas sigan llegando con la app cerrada.
- Modo `demo` regenera precios cada ~5 minutos para que puedas ver notificaciones nuevas.

## Estructura

```
backend/     API + cron + push
mobile/      App Expo (formulario + inbox de notificaciones)
```
