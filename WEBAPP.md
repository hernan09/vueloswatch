# VuelosWatch Webapp

Misma lógica de alertas, pero 100% web: se abre en Chrome del celular y **no** tiene el bloqueo de Network Security Policy de la APK.

## Cómo usarla

1. En la Mac, backend + UI:

```bash
cd backend
npm start
```

2. En el Xiaomi (misma WiFi), abrí Chrome:

```text
http://IP_DE_TU_MAC:3001
```

Ejemplo: `http://192.168.0.12:3001`

3. Aceptá notificaciones.
4. Creá alerta `BUE` → `FLN`, fechas, tope USD.
5. Opcional: Chrome → menú → **Instalar app** / **Agregar a pantalla de inicio**.

## Desarrollo (hot reload)

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
cd web && npm run dev
```

Abrí `http://IP:5173` (proxy al backend).

## Rebuild de la web

Si cambiás el frontend:

```bash
cd web && npm run build
# reiniciá el backend
```

## Notificaciones

- **Chrome Android**: Web Push puede avisar con la pestaña cerrada (si diste permiso e instalaste/usás el service worker).
- **Safari iPhone**: más limitado; conviene dejar la PWA instalada.
- El backend sigue checando cada 5 min con cron.
