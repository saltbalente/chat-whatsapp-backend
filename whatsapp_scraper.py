#!/usr/bin/env python3
"""
WhatsApp Web Scraper usando Selenium
Abre WhatsApp Web en Chrome y extrae la información de "última vez" directamente del DOM
"""

import time
import json
import sys
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import re
from datetime import datetime

class WhatsAppScraper:
    def __init__(self, session_dir="./whatsapp-session-selenium", headless=False):
        """Inicializar el scraper con sesión persistente"""
        self.session_dir = session_dir
        self.driver = None
        self.headless = headless
        self.headless = headless
        
    def init_driver(self):
        """Inicializar Chrome con opciones para WhatsApp Web"""
        chrome_options = Options()
        
        # Especificar ruta de Chrome en macOS
        chrome_options.binary_location = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        
        # Usar perfil de usuario para mantener sesión
        chrome_options.add_argument(f"--user-data-dir={self.session_dir}")
        chrome_options.add_argument("--profile-directory=Default")
        
        # Otras opciones necesarias
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        # Headless mode si está habilitado
        if self.headless:
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--window-size=1200,900")
        
        # User agent real
        chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.set_window_size(1200, 900)
        except Exception as e:
            print(f"❌ Error initializing Chrome: {str(e)}", file=sys.stderr)
            raise
        
    def login(self):
        """Abrir WhatsApp Web y esperar a que se escanee el QR"""
        print("🌐 Abriendo WhatsApp Web...", file=sys.stderr)
        self.driver.get("https://web.whatsapp.com")
        
        try:
            # Esperar a que aparezca el QR o que ya esté logueado
            print("⏳ Esperando QR o sesión activa...", file=sys.stderr)
            WebDriverWait(self.driver, 5).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas"))
            )
            print("📱 Escanea el código QR en WhatsApp (tienes 60 segundos)...", file=sys.stderr)
            
            # Esperar a que desaparezca el QR (significa que ya está logueado)
            WebDriverWait(self.driver, 60).until_not(
                EC.presence_of_element_located((By.CSS_SELECTOR, "canvas"))
            )
            print("✅ Sesión iniciada correctamente!", file=sys.stderr)
            
        except TimeoutException:
            # Puede que ya esté logueado de una sesión anterior
            print("✅ Ya había sesión activa o se escaneó el QR", file=sys.stderr)
        
        # Esperar a que cargue completamente WhatsApp Web
        print("⏳ Esperando a que cargue WhatsApp Web...", file=sys.stderr)
        
        # Intentar múltiples selectores con tiempos de espera más cortos
        loaded = False
        selectors_to_try = [
            ('#side', 8),
            ('[data-testid="chat-list"]', 8),
            ('[data-testid="default-user"]', 5),
            ('header', 5)
        ]
        
        for selector, wait_time in selectors_to_try:
            try:
                print(f"   Probando selector: {selector}...", file=sys.stderr)
                WebDriverWait(self.driver, wait_time).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                print(f"✅ WhatsApp Web cargado (encontrado: {selector})!", file=sys.stderr)
                loaded = True
                break
            except TimeoutException:
                print(f"   ⏳ No se encontró {selector}, probando siguiente...", file=sys.stderr)
                continue
        
        if not loaded:
            print("⚠️  WhatsApp Web puede no estar completamente cargado, continuando...", file=sys.stderr)
        
        time.sleep(2)
    
    def open_chat(self, phone_number):
        """Abrir un chat específico por número de teléfono"""
        # Limpiar el número (eliminar espacios, guiones, etc.)
        clean_number = re.sub(r'[^\d+]', '', phone_number)
        
        print(f"💬 Abriendo chat con {clean_number}...")
        
        # Navegar directamente al chat usando la URL
        chat_url = f"https://web.whatsapp.com/send?phone={clean_number}"
        self.driver.get(chat_url)
        
        # Esperar a que cargue el chat
        time.sleep(4)
        
        # Verificar si el chat se abrió correctamente
        try:
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'header'))
            )
            print(f"✅ Chat abierto con {clean_number}")
            return True
        except TimeoutException:
            print(f"❌ No se pudo abrir el chat con {clean_number}")
            return False
    
    def get_presence_info(self, phone_number):
        """Obtener información de presencia de un contacto"""
        if not self.open_chat(phone_number):
            return {
                "success": False,
                "error": "Could not open chat",
                "number": phone_number
            }
        
        # Esperar un momento para que se actualice la info de presencia
        time.sleep(3)
        
        try:
            # Buscar el elemento del header que contiene el estado
            # Selectores múltiples para diferentes versiones de WhatsApp Web
            selectors = [
                'header span[title]',
                'header ._amid span[title]',
                '[data-testid="conversation-info-header-subtitle"]',
                'header ._amid ._ao3e',
                'header span[dir="auto"][title]'
            ]
            
            status_text = None
            status_element = None
            
            for selector in selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for elem in elements:
                        text = elem.get_attribute('title') or elem.text
                        if text and ('en línea' in text.lower() or 
                                    'online' in text.lower() or 
                                    'últ.' in text.lower() or
                                    'last seen' in text.lower() or
                                    'hace' in text):
                            status_text = text
                            status_element = elem
                            break
                    if status_text:
                        break
                except NoSuchElementException:
                    continue
            
            if not status_text:
                print("⚠️  No se pudo encontrar el texto de estado en el header")
                # Intentar extraer el nombre al menos
                try:
                    name_elem = self.driver.find_element(By.CSS_SELECTOR, 'header span[title]')
                    contact_name = name_elem.get_attribute('title')
                except:
                    contact_name = phone_number
                
                return {
                    "success": False,
                    "error": "Status text not found in header",
                    "number": phone_number,
                    "name": contact_name,
                    "raw_html": self.driver.find_element(By.TAG_NAME, 'header').get_attribute('innerHTML')[:500]
                }
            
            # Obtener el nombre del contacto
            try:
                name_elem = self.driver.find_element(By.CSS_SELECTOR, 'header span[dir="auto"]')
                contact_name = name_elem.text
            except:
                contact_name = phone_number
            
            # Parsear el texto de estado
            is_online = False
            last_seen = None
            minutes_ago = None
            
            status_lower = status_text.lower()
            
            if 'en línea' in status_lower or 'online' in status_lower:
                is_online = True
                last_seen = datetime.now().isoformat()
                minutes_ago = 0
            else:
                # Intentar extraer tiempo relativo
                # Ejemplos: "últ. vez hoy a las 15:30", "last seen today at 3:30 PM"
                # "últ. vez ayer a las 22:15", "hace 5 minutos"
                
                # Patrón para "hace X minutos/horas"
                match_hace = re.search(r'hace\s+(\d+)\s+(minuto|hora|día)', status_text)
                if match_hace:
                    value = int(match_hace.group(1))
                    unit = match_hace.group(2)
                    if 'minuto' in unit:
                        minutes_ago = value
                    elif 'hora' in unit:
                        minutes_ago = value * 60
                    elif 'día' in unit:
                        minutes_ago = value * 1440
            
            result = {
                "success": True,
                "number": phone_number,
                "name": contact_name,
                "is_online": is_online,
                "status_text": status_text,
                "minutes_ago": minutes_ago,
                "last_seen": last_seen,
                "checked_at": datetime.now().isoformat()
            }
            
            # Print JSON on stdout for Node.js to parse
            print(json.dumps(result, ensure_ascii=False))
            
            # Also print human readable to stderr
            import sys
            print(f"📊 Resultado: {json.dumps(result, indent=2, ensure_ascii=False)}", file=sys.stderr)
            return result
            
        except Exception as e:
            print(f"❌ Error obteniendo presencia: {str(e)}", file=sys.stderr)
            error_result = {
                "success": False,
                "error": str(e),
                "number": phone_number
            }
            print(json.dumps(error_result, ensure_ascii=False))
            return error_result
    
    def close(self):
        """Cerrar el navegador"""
        if self.driver:
            print("🛑 Cerrando navegador...")
            self.driver.quit()

def main():
    """Función principal para testing"""
    import sys
    
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No phone number provided"}))
        sys.exit(1)
    
    phone_number = sys.argv[1]
    
    # Check for headless flag
    headless = '--headless' in sys.argv
    
    scraper = WhatsAppScraper(headless=headless)
    
    try:
        scraper.init_driver()
        scraper.login()
        result = scraper.get_presence_info(phone_number)
        
        # Result already printed as JSON in get_presence_info
        
    except KeyboardInterrupt:
        print(json.dumps({"success": False, "error": "Interrupted by user"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        import traceback
        traceback.print_exc(file=sys.stderr)
    finally:
        scraper.close()

if __name__ == "__main__":
    main()
