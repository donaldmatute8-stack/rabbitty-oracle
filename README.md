# 🐰 Rabbitty Oracle API

Backend Oracle para Rabbitty - Mini App de Telegram.

## 📋 Qué hace
- Verifica QR de consumos
- Interactúa con contrato Sepolia
- Rate limiting con Redis
- Webhooks para mintear bunz

## 🚀 Deploy en Railway

### Paso 1: Ve a Railway
https://railway.app/dashboard

### Paso 2: Crear proyecto
1. Click **"New"** → **"Deploy from GitHub repo"**
2. Selecciona: `donaldmatute8-stack/rabbitty-oracle`
3. Click **"Deploy"**

### Paso 3: Variables de entorno
En Settings → Variables, agrega:

```
SEPOLIA_PRIVATE_KEY=tu_clave_privada_de_sepolia
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
BUNZ_CONTRACT=0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB
PORT=3001
```

⚠️ **No subas SEPOLIA_PRIVATE_KEY a GitHub** — Railway la guarda segura.

### Paso 4: Añadir Redis (opcional pero recomendado)
1. Click **"New"** → **"Database"** → **"Redis"**
2. Railway crea automáticamente `REDIS_URL`

### Paso 5: Generar dominio
1. Settings → Networking
2. Click **"Generate Domain"**
3. Copia la URL (ej: `https://rabbitty-oracle.up.railway.app`)

## 🔗 Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `POST /process-consumption` | POST | Verifica QR y mintea bunz |
| `GET /health` | GET | Health check |
| `GET /business/:address` | GET | Datos del negocio |

## 📁 Estructura

```
├── server.js           # API principal
├── Dockerfile          # Config contenedor
├── railway.toml        # Config Railway
├── package.json        # Dependencias
└── .gitignore          # Excluye secrets
```

## 🛠️ Desarrollo local

```bash
npm install
npm run dev
```

## 📦 Docker

```bash
docker build -t rabbitty-oracle .
docker run -p 3001:3001 rabbitty-oracle
```

---

**URL del repositorio:** https://github.com/donaldmatute8-stack/rabbitty-oracle
