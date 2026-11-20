# Deploy: Railway (backend) + Vercel (frontend)

## Backend → Railway (trial / free)

El servicio API vive en Railway. Root directory: `backend`.

Cuando tengas la URL (ej. `https://xxx.up.railway.app`):

1. Probá: `https://TU_URL_RAILWAY/health`
2. Usala en Vercel como `VITE_API_URL`

## Frontend → Vercel (vos desde GitHub)

1. Importá el repo `hernan09/vueloswatch`
2. Framework: Vite (o deja que lea `vercel.json`)
3. Env var:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://TU_URL_RAILWAY` (sin `/` final) |

4. Deploy

## Notas Free / Trial Railway

- El servidor puede dormirse; al abrir la web / chequear, se despierta.
- Los datos en disco (`store.json`) pueden perderse si el contenedor se recrea. Para uso personal/prueba alcanza.
