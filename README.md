# 📱 WhatsApp Monitor API

API REST para monitorear la última conexión de contactos de WhatsApp usando Selenium Web Scraping.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Características

- ✅ **API REST completa** con 10+ endpoints
- ✅ **Scraping de WhatsApp Web** usando Selenium + Python
- ✅ **Extracción de "última vez"** de contactos
- ✅ **Base de datos SQLite** con historial completo
- ✅ **Monitoreo automático** programable cada N minutos
- ✅ **Dashboard web** incluido
- ✅ **Cliente Swift** para integración con iOS
- ✅ **Listo para producción** (Render.com)

## 🚀 Inicio Rápido

### Requisitos

- Node.js 18+
- Python 3.9+
- Google Chrome instalado
- ChromeDriver

### Instalación

```bash
# Clonar repositorio
git clone https://github.com/saltbalente/chat-whatsapp-backend.git
cd chat-whatsapp-backend

# Instalar dependencias Node.js
npm install

# Instalar dependencias Python
pip3 install -r requirements.txt

# Copiar variables de entorno
cp .env.example .env

# Iniciar servidor
npm start
```

### Primera Autenticación

1. Abre http://localhost:3000
2. Chrome abrirá WhatsApp Web automáticamente
3. **Escanea el código QR** con tu WhatsApp móvil
4. La sesión se guardará para futuros usos

## 📡 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Health check del servidor |
| GET | `/api/whatsapp/status` | Estado de WhatsApp |
| GET | `/api/accounts` | Listar todas las cuentas |
| GET | `/api/accounts/:id` | Obtener cuenta específica |
| POST | `/api/accounts` | Crear nueva cuenta |
| PUT | `/api/accounts/:id` | Actualizar cuenta |
| DELETE | `/api/accounts/:id` | Eliminar cuenta |
| POST | `/api/accounts/:number/check` | ⚡ **Verificar estado ahora** |
| GET | `/api/accounts/:number/history` | Historial de actividad |
| GET | `/api/stats` | Estadísticas generales |

### Ejemplo: Verificar Estado de un Contacto

```bash
curl -X POST http://localhost:3000/api/accounts/+573001234567/check
```

**Respuesta:**
```json
{
  "success": true,
  "status": {
    "exists": true,
    "number": "+573001234567",
    "isOnline": false,
    "lastSeen": 1732014000000,
    "hasPrivacy": false,
    "name": "Juan Pérez",
    "statusText": "últ. vez hoy a la(s) 4:02 a.m.",
    "checkedAt": 1732014123000
  }
}
```

## 💻 Integración con iOS

Copia el archivo **`WhatsAppMonitorAPI.swift`** a tu proyecto Xcode:

```swift
import SwiftUI

struct ContentView: View {
    @StateObject private var api = WhatsAppMonitorAPI(
        baseURL: "https://tu-api.onrender.com/api"
    )
    
    @State private var accounts: [Account] = []
    
    var body: some View {
        List(accounts) { account in
            VStack(alignment: .leading) {
                Text(account.accountName)
                    .font(.headline)
                
                Text(account.lastSeenText)
                    .font(.caption)
                    .foregroundColor(statusColor(for: account))
                
                Button("Verificar Ahora") {
                    Task {
                        _ = try? await api.checkAccount(number: account.number)
                        accounts = try! await api.fetchAccounts()
                    }
                }
            }
        }
        .task {
            accounts = try! await api.fetchAccounts()
        }
    }
    
    func statusColor(for account: Account) -> Color {
        if account.isOnline { return .green }
        if account.hasPrivacy { return .gray }
        
        guard let date = account.lastSeenDate else { return .gray }
        let hours = Date().timeIntervalSince(date) / 3600
        
        if hours < 1 { return .green }
        if hours < 24 { return .orange }
        return .red
    }
}
```

## 🌐 Despliegue en Render

### Configuración Rápida

1. Conecta este repositorio a [Render](https://render.com)
2. Crea un **Web Service**
3. Configuración:
   - **Build Command:** `chmod +x render-build.sh && ./render-build.sh`
   - **Start Command:** `npm start`
   - **Environment:**
     ```
     PORT=10000
     HEADLESS_MODE=true
     MONITOR_INTERVAL=5
     ```

4. ¡Deploy!

### Disco Persistente (Recomendado)

Para mantener la sesión de WhatsApp entre deploys:

- **Name:** `whatsapp-session`
- **Mount Path:** `/opt/render/project/src/whatsapp-session-selenium`
- **Size:** 1 GB

**Ver guía completa:** [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)

## 🔧 Configuración

Variables de entorno (`.env`):

```env
# Puerto del servidor
PORT=3000

# Modo headless (true en producción)
HEADLESS_MODE=false

# Intervalo de monitoreo en minutos
MONITOR_INTERVAL=5

# Timeout para checks en segundos
CHECK_TIMEOUT=60

# Base de datos
DATABASE_PATH=./whatsapp-monitor.db

# Sesión de WhatsApp
WHATSAPP_SESSION_DIR=./whatsapp-session-selenium
```

## 📊 Dashboard Web

Accede a http://localhost:3000 para:

- Ver todas las cuentas monitoreadas
- Verificar estado en tiempo real
- Hacer check manual
- Ver historial de actividad
- Ver estadísticas

![Dashboard](https://via.placeholder.com/800x400.png?text=Dashboard+Screenshot)

## 🧪 Pruebas

### Health Check
```bash
curl http://localhost:3000/health
```

### Listar Cuentas
```bash
curl http://localhost:3000/api/accounts | jq
```

### Crear Cuenta
```bash
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "Juan Pérez",
    "number": "+573001234567",
    "checkInterval": 5
  }' | jq
```

### Verificar Estado
```bash
curl -X POST http://localhost:3000/api/accounts/+573001234567/check | jq
```

## 📁 Estructura del Proyecto

```
.
├── server.js                    # Servidor Express principal
├── database.js                  # Gestión de base de datos SQLite
├── monitor.js                   # Servicio de monitoreo automático
├── whatsapp_scraper.py          # Scraper Python con Selenium
├── whatsapp-selenium-client.js  # Cliente Node.js para Python
├── migrate.js                   # Migraciones de base de datos
├── render-build.sh              # Script de build para Render
├── requirements.txt             # Dependencias Python
├── package.json                 # Dependencias Node.js
├── WhatsAppMonitorAPI.swift     # Cliente iOS
├── API_DOCUMENTATION.md         # Documentación completa de API
├── DEPLOY_RENDER.md             # Guía de despliegue
└── public/                      # Dashboard web (HTML/CSS/JS)
```

## ⚠️ Notas Importantes

### Rate Limiting
- WhatsApp puede bloquear si se hacen demasiadas consultas
- **Recomendado:** 1 check cada 5 minutos mínimo
- No monitorear más de 10-15 números simultáneamente

### Privacidad de Usuarios
- Si un usuario tiene privacidad activada, verás `hasPrivacy: true`
- No se puede obtener "última vez" de esos usuarios
- Es una limitación de WhatsApp, no de la API

### Sesión de WhatsApp
- La sesión se guarda localmente
- Dura aproximadamente 2-4 semanas
- En producción, usar disco persistente en Render

### Headless Mode
- **Desarrollo:** `HEADLESS_MODE=false` (ver navegador)
- **Producción:** `HEADLESS_MODE=true` (sin UI)

## 🐛 Troubleshooting

### Error: "Chrome instance exited"
**Solución:**
- Verifica que Chrome esté instalado
- En producción, asegura `HEADLESS_MODE=true`
- En macOS: `/Applications/Google Chrome.app`

### Error: "WhatsApp client is not ready"
**Solución:**
- Escanea el QR code primero
- Verifica que la sesión no haya expirado
- Reinicia el servidor

### Dashboard muestra "Privacidad activada"
**Solución:**
- El usuario tiene privacidad en WhatsApp
- Verifica que el número esté en tus contactos
- Algunos números empresariales no muestran "última vez"

## 📚 Documentación

- [API Documentation](./API_DOCUMENTATION.md) - Documentación completa de todos los endpoints
- [Deploy Guide](./DEPLOY_RENDER.md) - Guía paso a paso para Render.com
- [iOS Client](./WhatsAppMonitorAPI.swift) - Cliente Swift completo

## 🛠️ Tecnologías

- **Backend:** Node.js + Express
- **Scraping:** Python + Selenium + ChromeDriver
- **Base de datos:** SQLite (better-sqlite3)
- **Monitoreo:** node-cron
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla
- **iOS:** Swift + SwiftUI

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE)

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📞 Soporte

Para reportar bugs o solicitar features, abre un [Issue](https://github.com/saltbalente/chat-whatsapp-backend/issues).

---

**Desarrollado con ❤️ usando Node.js, Python, Selenium y SQLite**

**⭐ Si te resultó útil, dale una estrella al repo!**
