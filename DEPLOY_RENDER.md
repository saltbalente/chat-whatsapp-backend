# WhatsApp Monitor Server - Guía de Despliegue en Render

## 🚀 Despliegue Rápido en Render

### Paso 1: Preparar Repositorio Git

```bash
cd whatsapp-monitor-server
git init
git add .
git commit -m "Initial commit"
git remote add origin <tu-repo-url>
git push -u origin main
```

### Paso 2: Crear Web Service en Render

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click en **"New +"** → **"Web Service"**
3. Conecta tu repositorio Git
4. Configura:

**Basic Settings:**
- **Name:** `whatsapp-monitor-api`
- **Region:** Oregon (US West) o el más cercano
- **Branch:** `main`
- **Root Directory:** `whatsapp-monitor-server` (si está en subdirectorio)
- **Environment:** `Node`
- **Build Command:**
  ```bash
  chmod +x render-build.sh && ./render-build.sh
  ```
- **Start Command:**
  ```bash
  npm start
  ```

**Environment Variables:**
```
PORT=10000
HEADLESS_MODE=true
MONITOR_INTERVAL=5
CHECK_TIMEOUT=60
NODE_ENV=production
```

**Advanced:**
- **Auto-Deploy:** Yes
- **Health Check Path:** `/health`

### Paso 3: Configurar Chrome/ChromeDriver

Render incluye Chrome y ChromeDriver pre-instalados en el entorno Node.

Si necesitas versión específica, agrega a `render-build.sh`:

```bash
# Instalar Chrome y ChromeDriver (ya incluido en Render)
echo "Chrome ya está instalado en Render"
```

### Paso 4: Persistencia de Sesión WhatsApp

**Opción A: Volumen Persistente (Recomendado para Producción)**

1. En Render Dashboard, ve a tu servicio
2. **Settings** → **Disks**
3. **Add Disk:**
   - Name: `whatsapp-session`
   - Mount Path: `/opt/render/project/src/whatsapp-session-selenium`
   - Size: 1 GB

**Opción B: Re-autenticación Periódica (Gratis)**

- La sesión se pierde en cada deploy
- Necesitarás escanear QR después de cada deploy
- Para entornos de prueba

### Paso 5: Primera Autenticación

**Después del primer deploy:**

1. La app iniciará pero mostrará `isReady: false`
2. Necesitas ejecutar manualmente el script para escanear QR:

```bash
# SSH a tu instancia de Render (desde Render Shell)
cd /opt/render/project/src
python3 whatsapp_scraper.py +1234567890
# Escanea el QR que aparece
```

3. Una vez autenticado, la sesión se guarda en el disco persistente
4. Reinicia el servicio: la app usará la sesión guardada

### Paso 6: Configurar Auto-Deploy

En **Settings** → **Build & Deploy:**
- ✅ Auto-Deploy: Yes
- Branch: `main`

Cada push a `main` desplegará automáticamente.

---

## 📱 Uso desde App iOS

### Base URL de Producción

```swift
let baseURL = "https://whatsapp-monitor-api.onrender.com/api"
```

### Ejemplo en Swift

```swift
import Foundation

class WhatsAppAPI {
    let baseURL = "https://whatsapp-monitor-api.onrender.com/api"
    
    func fetchAccounts() async throws -> [Account] {
        let url = URL(string: "\(baseURL)/accounts")!
        let (data, _) = try await URLSession.shared.data(from: url)
        let response = try JSONDecoder().decode(AccountsResponse.self, from: data)
        return response.accounts
    }
    
    func checkAccount(number: String) async throws -> CheckResult {
        let url = URL(string: "\(baseURL)/accounts/\(number)/check")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(CheckResponse.self, from: data)
        return response.status
    }
}

struct Account: Codable {
    let accountId: String
    let accountName: String
    let number: String
    let lastSeen: Int64?
    let isOnline: Bool
    let hasPrivacy: Bool
}

struct AccountsResponse: Codable {
    let success: Bool
    let accounts: [Account]
}

struct CheckResult: Codable {
    let exists: Bool
    let number: String
    let isOnline: Bool
    let lastSeen: Int64?
    let hasPrivacy: Bool
    let name: String
    let statusText: String?
}

struct CheckResponse: Codable {
    let success: Bool
    let status: CheckResult
}
```

---

## 🔧 Variables de Entorno en Render

Configura en **Environment** → **Environment Variables:**

```env
# Puerto (Render asigna automáticamente)
PORT=10000

# Modo headless (siempre true en producción)
HEADLESS_MODE=true

# Intervalo de monitoreo en minutos
MONITOR_INTERVAL=5

# Timeout para checks
CHECK_TIMEOUT=60

# Nivel de logs
LOG_LEVEL=info

# Node environment
NODE_ENV=production
```

---

## 🐛 Troubleshooting

### Error: "Chrome instance exited"

**Solución:**
- Verifica que `HEADLESS_MODE=true`
- Asegúrate que ChromeDriver está instalado
- Revisa logs: `render logs -f`

### Error: "Session not created"

**Solución:**
- La sesión de WhatsApp expiró
- Re-autentica escaneando QR
- Considera usar disco persistente

### Error: "No QR code available"

**Solución:**
- El cliente Selenium no muestra QR web
- Necesitas ejecutar script manualmente para autenticar
- Usa Render Shell o local para escanear

### Performance Lento

**Solución:**
- Aumenta el intervalo de monitoreo (`MONITOR_INTERVAL=10`)
- Reduce número de cuentas monitoreadas
- Usa plan Paid de Render para más recursos

---

## 📊 Monitoreo

### Health Check

```bash
curl https://whatsapp-monitor-api.onrender.com/health
```

### Ver Logs

```bash
# Desde Render Dashboard
render logs -f --service whatsapp-monitor-api

# O en la web
https://dashboard.render.com/web/<service-id>/logs
```

### Métricas

Render provee métricas automáticas:
- CPU Usage
- Memory Usage
- Response Time
- Request Count

---

## 💰 Costos

### Plan Free
- ✅ 750 horas/mes gratis
- ✅ Auto-sleep después de 15 min inactividad
- ✅ Perfecto para desarrollo/pruebas
- ❌ Sin disco persistente
- ❌ Cold starts lentos

### Plan Starter ($7/mes)
- ✅ Always-on (sin sleep)
- ✅ Disco persistente
- ✅ Sin cold starts
- ✅ Mejor para producción

---

## 🔐 Seguridad

### Agregar Autenticación (Opcional)

```javascript
// En server.js, agrega middleware de auth:
app.use('/api', (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

En Render, agrega variable de entorno:
```
API_KEY=tu-clave-secreta-aqui
```

En iOS:
```swift
var request = URLRequest(url: url)
request.setValue("tu-clave-secreta-aqui", forHTTPHeaderField: "X-API-Key")
```

---

## 📚 Recursos

- [Render Docs](https://render.com/docs)
- [API Documentation](./API_DOCUMENTATION.md)
- [Selenium Python Docs](https://selenium-python.readthedocs.io/)
- [WhatsApp Web Reverse Engineering](https://github.com/pedroslopez/whatsapp-web.js/)

---

## ✅ Checklist de Despliegue

- [ ] Código en repositorio Git
- [ ] Web Service creado en Render
- [ ] Variables de entorno configuradas
- [ ] Build command correcta
- [ ] Start command correcta
- [ ] Health check path configurado
- [ ] Disco persistente agregado (opcional)
- [ ] Primera autenticación QR completada
- [ ] API testeada desde Postman/curl
- [ ] Integración con app iOS funcionando

---

## 🎉 ¡Listo!

Tu API de WhatsApp Monitor está ahora en producción y lista para ser consumida por tu app iOS.

**URL de Producción:**
```
https://whatsapp-monitor-api.onrender.com/api
```

**Documentación Completa:**
Ver [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
