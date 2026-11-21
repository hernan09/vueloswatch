# Deploy: Render (backend) + Vercel (frontend)

## Backend → Render (free)

### Opción recomendada (dashboard)

1. Entrá a https://dashboard.render.com  
2. **New** → **Web Service**  
3. Conectá GitHub y elegí `hernan09/vueloswatch`  
4. Config:

| Campo | Valor |
|---|---|
| Name | `vueloswatch-api` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance type | **Free** |

5. Create Web Service  
6. Cuando termine, copiá la URL (`https://vueloswatch-api.onrender.com` o similar)  
7. Probá: `https://TU_URL/health`

### Blueprint (alternativa)

En Render: **New** → **Blueprint** → repo `vueloswatch` (usa `render.yaml` de la raíz).

## Frontend → Vercel (vos desde GitHub)

1. Importá el repo `hernan09/vueloswatch`
2. Dejá que use `vercel.json`
3. Env var:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://TU_URL_RENDER` (sin `/` final) |

4. Deploy

## Notas Free Render

- Se duerme ~15 min sin tráfico; la primera request puede tardar ~1 min en despertar.
- Disco efímero: las alertas en `store.json` pueden perderse si el servicio se recrea.
