# WhatsApp Monitor API Documentation

API REST para monitorear la última conexión de números de WhatsApp.

## Base URL

```
http://localhost:3000/api
```

## Endpoints

### 1. Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-19T10:00:00.000Z",
  "uptime": 12345,
  "whatsapp": {
    "isReady": true,
    "isConnected": true,
    "platform": "selenium"
  }
}
```

---

### 2. Obtener Estado de WhatsApp

```http
GET /api/whatsapp/status
```

**Response:**
```json
{
  "isReady": true,
  "isConnected": true,
  "state": "READY",
  "platform": "selenium",
  "queueSize": 0,
  "isProcessing": false
}
```

---

### 3. Listar Todas las Cuentas

```http
GET /api/accounts
```

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "accountId": "acc_1763542783130_nrm3ew29v",
      "accountName": "Juan Pérez",
      "number": "+573001234567",
      "lastSeen": 1732014000000,
      "isOnline": false,
      "hasPrivacy": false,
      "checkInterval": 5,
      "createdAt": 1732014000000
    }
  ]
}
```

---

### 4. Obtener Cuenta por ID

```http
GET /api/accounts/:accountId
```

**Response:**
```json
{
  "success": true,
  "account": {
    "accountId": "acc_1763542783130_nrm3ew29v",
    "accountName": "Juan Pérez",
    "number": "+573001234567",
    "lastSeen": 1732014000000,
    "isOnline": false,
    "hasPrivacy": false,
    "checkInterval": 5,
    "createdAt": 1732014000000
  }
}
```

---

### 5. Crear Nueva Cuenta

```http
POST /api/accounts
Content-Type: application/json

{
  "accountName": "Juan Pérez",
  "number": "+573001234567",
  "checkInterval": 5
}
```

**Response:**
```json
{
  "success": true,
  "accountId": "acc_1763542783130_nrm3ew29v",
  "message": "Account created successfully"
}
```

---

### 6. Actualizar Cuenta

```http
PUT /api/accounts/:accountId
Content-Type: application/json

{
  "accountName": "Juan Pérez Actualizado",
  "checkInterval": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account updated successfully"
}
```

---

### 7. Eliminar Cuenta

```http
DELETE /api/accounts/:accountId
```

**Response:**
```json
{
  "success": true,
  "message": "Account deleted successfully"
}
```

---

### 8. Verificar Cuenta Ahora (Manual Check)

```http
POST /api/accounts/:number/check
```

**Ejemplo:** `POST /api/accounts/+573001234567/check`

**Response:**
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

**Posibles estados:**
- `isOnline: true` - Usuario en línea ahora
- `lastSeen: timestamp` - Última conexión (timestamp en ms)
- `hasPrivacy: true` - Usuario tiene privacidad activada (no se puede ver última conexión)

---

### 9. Obtener Historial de Actividad

```http
GET /api/accounts/:number/history?limit=50
```

**Query Parameters:**
- `limit` (opcional): Número de registros a retornar (default: 50)

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "logId": "log_1732014123000_abc123",
      "accountId": "acc_1763542783130_nrm3ew29v",
      "lastSeen": 1732014000000,
      "isOnline": false,
      "checkedAt": 1732014123000
    }
  ]
}
```

---

### 10. Obtener Estadísticas

```http
GET /api/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalAccounts": 5,
    "onlineNow": 1,
    "recentActivity": 3,
    "privateAccounts": 1,
    "lastChecked": 1732014123000,
    "isMonitoring": true
  }
}
```

**Definiciones:**
- `recentActivity`: Cuentas vistas en las últimas 24 horas
- `privateAccounts`: Cuentas con privacidad activada

---

## Códigos de Estado HTTP

- `200` - Éxito
- `201` - Recurso creado
- `400` - Error de validación
- `404` - Recurso no encontrado
- `500` - Error del servidor

---

## Ejemplo de Uso en iOS (Swift)

```swift
import Foundation

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

class WhatsAppMonitorAPI {
    let baseURL = "http://localhost:3000/api"
    
    func fetchAccounts(completion: @escaping (Result<[Account], Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/accounts") else { return }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else { return }
            
            do {
                let response = try JSONDecoder().decode(AccountsResponse.self, from: data)
                completion(.success(response.accounts))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    func checkAccount(number: String, completion: @escaping (Result<Bool, Error>) -> Void) {
        let urlString = "\(baseURL)/accounts/\(number)/check"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            completion(.success(true))
        }.resume()
    }
}
```

---

## Despliegue en Render

### Requisitos
1. Cuenta en [Render.com](https://render.com)
2. Repositorio Git con el código

### Pasos de Despliegue

1. **Crear Web Service en Render:**
   - Build Command: `npm install && pip3 install selenium`
   - Start Command: `npm start`
   - Environment: `Node`

2. **Variables de Entorno:**
   ```
   PORT=10000
   HEADLESS_MODE=true
   MONITOR_INTERVAL=5
   ```

3. **Instalar ChromeDriver:**
   Render incluye Chrome y ChromeDriver por defecto en el entorno.

4. **Base de Datos:**
   - SQLite funciona en Render pero los datos se pierden en cada deploy
   - Recomendado: Usar PostgreSQL de Render para persistencia

---

## Notas para Producción

1. **Autenticación QR:**
   - Primera vez requiere escanear QR
   - La sesión se guarda en `whatsapp-session-selenium/`
   - En Render, usar volumen persistente o re-autenticar periódicamente

2. **Rate Limiting:**
   - WhatsApp puede bloquear si se hacen demasiadas consultas
   - Recomendado: máximo 1 check cada 5 minutos por número

3. **Headless Mode:**
   - En producción usar `HEADLESS_MODE=true`
   - En desarrollo usar `false` para ver el navegador

4. **Monitoreo:**
   - Revisar logs regularmente
   - Endpoint `/health` para health checks

5. **Escalabilidad:**
   - La cola procesa 1 número a la vez
   - Para múltiples números, aumentar timeout
