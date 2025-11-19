// WhatsAppMonitorAPI.swift
// API Client para WhatsApp Monitor Server

import Foundation

// MARK: - Models

struct Account: Codable, Identifiable {
    let accountId: String
    let accountName: String
    let number: String
    let lastSeen: Int64?
    let isOnline: Bool
    let hasPrivacy: Bool
    let checkInterval: Int?
    let createdAt: Int64?
    
    var id: String { accountId }
    
    var lastSeenDate: Date? {
        guard let timestamp = lastSeen else { return nil }
        return Date(timeIntervalSince1970: TimeInterval(timestamp) / 1000)
    }
    
    var lastSeenText: String {
        if isOnline {
            return "En línea"
        }
        
        guard let date = lastSeenDate else {
            return hasPrivacy ? "Privacidad activada" : "Desconocido"
        }
        
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        formatter.locale = Locale(identifier: "es_ES")
        return "Visto " + formatter.localizedString(for: date, relativeTo: Date())
    }
    
    var statusColor: String {
        if isOnline { return "green" }
        if hasPrivacy { return "gray" }
        
        guard let date = lastSeenDate else { return "gray" }
        let hours = Date().timeIntervalSince(date) / 3600
        
        if hours < 1 { return "green" }
        if hours < 24 { return "yellow" }
        return "red"
    }
}

struct AccountsResponse: Codable {
    let success: Bool
    let accounts: [Account]
}

struct CheckStatus: Codable {
    let exists: Bool
    let number: String
    let isOnline: Bool
    let lastSeen: Int64?
    let hasPrivacy: Bool
    let name: String
    let statusText: String?
    let checkedAt: Int64
}

struct CheckResponse: Codable {
    let success: Bool
    let status: CheckStatus
}

struct ActivityLog: Codable, Identifiable {
    let logId: String
    let accountId: String
    let lastSeen: Int64?
    let isOnline: Bool
    let checkedAt: Int64
    
    var id: String { logId }
    
    var checkedDate: Date {
        Date(timeIntervalSince1970: TimeInterval(checkedAt) / 1000)
    }
}

struct HistoryResponse: Codable {
    let success: Bool
    let history: [ActivityLog]
}

struct Stats: Codable {
    let totalAccounts: Int
    let onlineNow: Int
    let recentActivity: Int
    let privateAccounts: Int
    let lastChecked: Int64?
    let isMonitoring: Bool
}

struct StatsResponse: Codable {
    let success: Bool
    let stats: Stats
}

struct CreateAccountRequest: Codable {
    let accountName: String
    let number: String
    let checkInterval: Int
}

struct CreateAccountResponse: Codable {
    let success: Bool
    let accountId: String
    let message: String
}

struct HealthResponse: Codable {
    let status: String
    let timestamp: String
    let uptime: Double
    let whatsapp: WhatsAppStatus
}

struct WhatsAppStatus: Codable {
    let isReady: Bool
    let isConnected: Bool
    let platform: String
    let queueSize: Int?
    let isProcessing: Bool?
}

struct ErrorResponse: Codable {
    let error: String
}

// MARK: - API Client

class WhatsAppMonitorAPI: ObservableObject {
    
    // MARK: - Configuration
    
    private let baseURL: String
    private let session: URLSession
    
    init(baseURL: String = "http://localhost:3000/api") {
        self.baseURL = baseURL
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 120
        self.session = URLSession(configuration: config)
    }
    
    // MARK: - Helper Methods
    
    private func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: Encodable? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw URLError(.badURL)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode >= 400 {
            if let errorResponse = try? JSONDecoder().decode(ErrorResponse.self, from: data) {
                throw NSError(
                    domain: "WhatsAppMonitorAPI",
                    code: httpResponse.statusCode,
                    userInfo: [NSLocalizedDescriptionKey: errorResponse.error]
                )
            }
            throw URLError(.badServerResponse)
        }
        
        let decoder = JSONDecoder()
        return try decoder.decode(T.self, from: data)
    }
    
    // MARK: - API Methods
    
    /// Obtener estado de salud del servidor
    func health() async throws -> HealthResponse {
        return try await request(path: "/health")
    }
    
    /// Listar todas las cuentas
    func fetchAccounts() async throws -> [Account] {
        let response: AccountsResponse = try await request(path: "/accounts")
        return response.accounts
    }
    
    /// Obtener cuenta por ID
    func fetchAccount(id: String) async throws -> Account {
        struct Response: Codable {
            let success: Bool
            let account: Account
        }
        let response: Response = try await request(path: "/accounts/\(id)")
        return response.account
    }
    
    /// Crear nueva cuenta
    func createAccount(name: String, number: String, checkInterval: Int = 5) async throws -> String {
        let body = CreateAccountRequest(
            accountName: name,
            number: number,
            checkInterval: checkInterval
        )
        let response: CreateAccountResponse = try await request(
            path: "/accounts",
            method: "POST",
            body: body
        )
        return response.accountId
    }
    
    /// Actualizar cuenta
    func updateAccount(id: String, name: String?, checkInterval: Int?) async throws {
        struct UpdateRequest: Codable {
            let accountName: String?
            let checkInterval: Int?
        }
        
        let body = UpdateRequest(accountName: name, checkInterval: checkInterval)
        let _: CreateAccountResponse = try await request(
            path: "/accounts/\(id)",
            method: "PUT",
            body: body
        )
    }
    
    /// Eliminar cuenta
    func deleteAccount(id: String) async throws {
        struct Response: Codable {
            let success: Bool
        }
        let _: Response = try await request(path: "/accounts/\(id)", method: "DELETE")
    }
    
    /// Verificar estado de una cuenta ahora (manual check)
    func checkAccount(number: String) async throws -> CheckStatus {
        let response: CheckResponse = try await request(
            path: "/accounts/\(number)/check",
            method: "POST"
        )
        return response.status
    }
    
    /// Obtener historial de actividad
    func fetchHistory(number: String, limit: Int = 50) async throws -> [ActivityLog] {
        let response: HistoryResponse = try await request(
            path: "/accounts/\(number)/history?limit=\(limit)"
        )
        return response.history
    }
    
    /// Obtener estadísticas generales
    func fetchStats() async throws -> Stats {
        let response: StatsResponse = try await request(path: "/stats")
        return response.stats
    }
}

// MARK: - Example Usage in SwiftUI

#if DEBUG
import SwiftUI

struct AccountsListView: View {
    @StateObject private var api = WhatsAppMonitorAPI(baseURL: "http://localhost:3000/api")
    @State private var accounts: [Account] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationView {
            List {
                ForEach(accounts) { account in
                    AccountRow(account: account, api: api)
                }
            }
            .navigationTitle("WhatsApp Monitor")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadAccounts) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }
            }
            .task {
                await loadAccounts()
            }
            .overlay {
                if isLoading {
                    ProgressView()
                }
            }
            .alert("Error", isPresented: .constant(errorMessage != nil)) {
                Button("OK") { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }
    
    func loadAccounts() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            accounts = try await api.fetchAccounts()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

struct AccountRow: View {
    let account: Account
    let api: WhatsAppMonitorAPI
    
    @State private var isChecking = false
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(account.accountName)
                    .font(.headline)
                
                Text(account.number)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Text(account.lastSeenText)
                    .font(.caption)
                    .foregroundColor(statusColor)
            }
            
            Spacer()
            
            if isChecking {
                ProgressView()
            } else {
                Button("Check") {
                    Task { await checkNow() }
                }
                .buttonStyle(.bordered)
                .disabled(isChecking)
            }
        }
        .padding(.vertical, 4)
    }
    
    var statusColor: Color {
        switch account.statusColor {
        case "green": return .green
        case "yellow": return .orange
        case "red": return .red
        default: return .gray
        }
    }
    
    func checkNow() async {
        isChecking = true
        defer { isChecking = false }
        
        do {
            _ = try await api.checkAccount(number: account.number)
        } catch {
            print("Error checking account: \(error)")
        }
    }
}

#Preview {
    AccountsListView()
}

#endif
