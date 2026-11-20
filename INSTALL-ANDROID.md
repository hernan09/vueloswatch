# Instalar VuelosWatch en Android (APK con push)

Con Expo Go **no** llegan push con la app cerrada. Necesitás un **APK propio** (EAS) + **Firebase (FCM)**.

## 0) Requisitos

- Cuenta gratis en [expo.dev](https://expo.dev)
- Cuenta gratis en [Firebase](https://console.firebase.google.com)
- Celular Android + cable USB o transferencia del APK
- Backend corriendo en la Mac (`cd backend && npm start`)

## 1) Login Expo + proyecto EAS

En la Mac:

```bash
cd /Users/hernangomez/Desktop/scrapingwebVuelos/mobile
npx eas-cli login
npx eas-cli init
```

`eas init` va a escribir el `projectId` real en `app.json` (reemplaza `REPLACE_AFTER_EAS_INIT`).

Si te pide owner, también actualiza el campo `owner`.

## 2) Firebase (obligatorio para push en Android)

1. Entrá a Firebase Console → crear proyecto (ej. `vueloswatch`).
2. Agregar app **Android** con package: `com.vueloswatch.app`
3. Descargá `google-services.json`
4. Ponelo acá:

```text
mobile/google-services.json
```

5. En Firebase → Project settings → Service accounts → Generate new private key (JSON de FCM V1).
6. Subí esa key a Expo:

```bash
cd mobile
npx eas-cli credentials
```

Elegí Android → production/preview → Google Service Account / FCM V1 → upload del JSON.

Guía oficial: https://docs.expo.dev/push-notifications/fcm-credentials/

## 3) Generar el APK

```bash
cd mobile
npx eas-cli build -p android --profile preview
```

Cuando termine, EAS te da un **link de descarga** del `.apk`.

## 4) Instalar en el celular

1. Abrí el link en el celular (Chrome) o pasá el APK por WhatsApp/AirDrop/cable.
2. En Android: permitir **instalar apps de orígenes desconocidos** para el navegador/archivos.
3. Instalá **VuelosWatch** (ya no uses Expo Go para esto).
4. Abrí la app → aceptá notificaciones.
5. Creá alerta `BUE` → `FLN`, fechas y tope USD.
6. Dejá el **backend de la Mac** corriendo (`npm start` + `caffeinate` si cerrás la tapa).

Si el celu y la Mac no están en la misma WiFi, el APK no va a llegar al backend (`192.168.0.12:3001`). Opciones:

- Misma WiFi, o
- Cambiá `EXPO_PUBLIC_API_URL` / `extra.apiUrl` a una URL pública (ngrok/Railway) y volvé a buildear.

## 5) Probar push con la app cerrada

1. Creá una alerta.
2. Cerrá VuelosWatch del todo (from recent apps).
3. En la Mac:

```bash
curl -X POST http://127.0.0.1:3001/check-now -H 'Content-Type: application/json' -d '{}'
```

4. Debería llegar la push. Al tocarla, abre el link del vuelo (Despegar / Kayak / Google Flights).

## Links en las notificaciones

Cada oferta trae `url` según plataforma:

- DESP → Despegar
- KAY → Kayak
- otros → Google Flights

Tocá la push o la fila en “Notificaciones recibidas” para abrir esa búsqueda.
