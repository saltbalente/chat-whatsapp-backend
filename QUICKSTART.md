# 🚀 Guía Rápida de Despliegue

## Contenido

1. [Setup Local](#setup-local)
2. [Primera Autenticación](#primera-autenticación)
3. [Subir a GitHub](#subir-a-github)
4. [Desplegar en Render](#desplegar-en-render)
5. [Integrar con iOS](#integrar-con-ios)

---

## Setup Local

```bash
# 1. Clonar repositorio
git clone https://github.com/saltbalente/chat-whatsapp-backend.git
cd chat-whatsapp-backend

# 2. Instalar dependencias
npm install
pip3 install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Iniciar servidor
npm start
```

**Dashboard:** http://localhost:3000

---

## Primera Autenticación

1. Al iniciar, Chrome abrirá WhatsApp Web
2. En tu iPhone: **WhatsApp → Configuración → Dispositivos Vinculados**
3. Escanea el código QR
4. ✅ Listo! La sesión se guarda automáticamente

**Nota:** Solo necesitas hacer esto una vez. La sesión dura 2-4 semanas.

---

## Subir a GitHub

```bash
# Agregar todos los archivos
git add .

# Hacer commit
git commit -m "Initial commit: WhatsApp Monitor API"

# Subir a GitHub
git push origin main
```

O usar el script incluido:

```bash
./push-to-github.sh "Initial commit"
```

---

## Desplegar en Render

### Método 1: Desde Dashboard

1. Ve a https://dashboard.render.com
2. **New+ → Web Service**
3. Conecta el repo: `saltbalente/chat-whatsapp-backend`
4. Configuración:
   - **Name:** `whatsapp-monitor-api`
   - **Environment:** Node
   - **Build Command:** `chmod +x render-build.sh && ./render-build.sh`
   - **Start Command:** `npm start`
   
5. **Environment Variables:**
   ```
   PORT=10000
   HEADLESS_MODE=true
   MONITOR_INTERVAL=5
   CHECK_TIMEOUT=60
   ```

6. Click **Create Web Service**

### Método 2: Con render.yaml

Crea `render.yaml` en la raíz:

```yaml
services:
  - type: web
    name: whatsapp-monitor-api
    env: node
    region: oregon
    buildCommand: chmod +x render-build.sh && ./render-build.sh
    startCommand: npm start
    envVars:
      - key: PORT
        value: 10000
      - key: HEADLESS_MODE
        value: true
      - key: MONITOR_INTERVAL
        value: 5
```

Push a GitHub y Render desplegará automáticamente.

### Agregar Disco Persistente (Recomendado)

Para mantener la sesión de WhatsApp entre deploys:

1. En Render Dashboard → tu servicio
2. **Settings → Disks**
3. **Add Disk:**
   - Name: `whatsapp-session`
   - Mount Path: `/opt/render/project/src/whatsapp-session-selenium`
   - Size: 1 GB

---

## Integrar con iOS

### 1. Copiar Cliente Swift

Copia `WhatsAppMonitorAPI.swift` a tu proyecto Xcode.

### 2. Configurar Base URL

```swift
let api = WhatsAppMonitorAPI(
    baseURL: "https://tu-app.onrender.com/api"  // URL de producción
)
```

### 3. Ejemplo Básico

```swift
import SwiftUI

struct AccountsView: View {
    @StateObject private var api = WhatsAppMonitorAPI(
        baseURL: "https://whatsapp-monitor-api.onrender.com/api"
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
            }
        }
        .task {
            do {
                accounts = try await api.fetchAccounts()
            } catch {
                print("Error: \(error)")
            }
        }
        .refreshable {
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

---

## Verificación Post-Deploy

### 1. Health Check

```bash
curl https://tu-app.onrender.com/health
```

**Debe retornar:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T10:00:00.000Z",
  "whatsapp": {
    "isReady": true,
    "platform": "selenium"
  }
}
```

### 2. Probar API

```bash
# Listar cuentas
curl https://tu-app.onrender.com/api/accounts

# Crear cuenta de prueba
curl -X POST https://tu-app.onrender.com/api/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountName": "Test",
    "number": "+573001234567",
    "checkInterval": 5
  }'

# Verificar estado
curl -X POST https://tu-app.onrender.com/api/accounts/+573001234567/check
```

---

## Troubleshooting

### Error: Chrome not found
**En Render, asegúrate de:**
- `HEADLESS_MODE=true`
- Chrome viene pre-instalado en Render

### Error: Session expired
**Solución:**
1. Agrega disco persistente en Render
2. O re-autentica escaneando QR desde Render Shell

### Error: Rate limited by WhatsApp
**Solución:**
- Aumenta `MONITOR_INTERVAL` a 10 minutos
- Reduce número de cuentas monitoreadas

---

## URLs Importantes

- **Repositorio:** https://github.com/saltbalente/chat-whatsapp-backend
- **Render Dashboard:** https://dashboard.render.com
- **API Docs:** Ver [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Deploy Completo:** Ver [DEPLOY_RENDER.md](./DEPLOY_RENDER.md)

---

## Comandos Útiles

```bash
# Ver logs en Render
render logs -f --service whatsapp-monitor-api

# Reiniciar servicio
render restart --service whatsapp-monitor-api

# Ver status de Git
git status

# Ver remote de GitHub
git remote -v

# Pull cambios
git pull origin main

# Push cambios
git push origin main
```

---

## Checklist de Producción

- [ ] Código en GitHub
- [ ] Servicio creado en Render
- [ ] Variables de entorno configuradas
- [ ] Build exitoso
- [ ] Health check funcionando
- [ ] Primera autenticación QR completada
- [ ] Disco persistente agregado
- [ ] API testeada con curl
- [ ] Cliente iOS integrado
- [ ] Monitoreo activo

---

## 🎉 ¡Listo!

Tu API de WhatsApp Monitor está en producción y lista para usar desde tu app iOS.

**Siguiente paso:** Integra el cliente Swift en tu app iOS y comienza a monitorear contactos.

Ver ejemplos completos en [WhatsAppMonitorAPI.swift](./WhatsAppMonitorAPI.swift)
