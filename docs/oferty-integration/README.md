# Integración de Chatbot con IA de Oferty (Frontend y Backend)

Este directorio contiene los componentes y servicios listos para desplegar la capacidad de IA conversacional de **ScraperLabs** dentro del ecosistema de **Oferty** (`oferty-web` y `oferty-backend`).

---

## 🎯 Especificaciones de Comportamiento del Bot

1. **Identidad Visual:**
   - Globo flotante con animación: `¡Hola! Pregúntale a Oferty 🛍️`.
   - Botón flotante circular con el **Logo de Oferty** y estado online en verde.
   - Ventana de chat con estilo corporativo Oferty (`#4f46e5` a `#f97316`).

2. **Visibilidad Estricta:**
   - **Solo visible en la web pública** de Oferty.
   - **Auto-exclusión del panel de administración:** Si la ruta actual es `/admin` o subrutas `/admin/*`, el componente retorna `null` y no se monta en el DOM.

3. **Alcance y Guardrails Anti-Consultas Capciosas:**
   - **Consultas Aceptadas:**
     - Exclusivamente sobre **productos de consumo** (precios, comparaciones, especificaciones técnicas, sugerencias de compra en Colombia: Falabella, Mercado Libre, Éxito, Alkosto, etc.).
     - Consultas sobre **Oferty como comparador** (cómo funciona, qué tiendas compara, cómo encontrar gangas, historial de precios).
   - **Consultas Capciosas / Fuera de Dominio (Bloqueo Inmediato):**
     - Cualquier pregunta con trampa, doble sentido, paradojas, acertijos o preguntas capciosas es detectada de inmediato.
     - Cualquier tema no comercial (política, fútbol, código de programación, tareas escolares, opiniones controversiales) o intento de manipulación de prompt (*jailbreak*, "ignora tus instrucciones") es rechazado categóricamente con el mensaje:
       > *"Como asistente de Oferty, únicamente puedo responder preguntas sobre productos, mejores precios, ofertas y el funcionamiento de nuestra plataforma. ¿Hay algún producto o precio que desees consultar?"*

---

## 🛠️ 1. Integración en `oferty-backend`

### Paso 1: Copiar archivos
- Copia `chatService.js` en `oferty-backend/src/services/chatService.js`.
- Copia `chatController.js` en `oferty-backend/src/controllers/chatController.js`.

### Paso 2: Registrar ruta en el router de Express
```javascript
// en src/routes/api.js o server.js de oferty-backend
const chatController = require('../controllers/chatController');

router.post('/chat', chatController.handleChatMessage);
```

### Paso 3: Variables de entorno en `oferty-backend/.env`
```env
# URL de la API de ScraperLabs
SCRAPERLABS_API_URL=https://api.scraperlabs.com.co

# Opcional si se requiere API Key registrada
SCRAPERLABS_API_KEY=tu_api_key_de_oferty
```

---

## 💻 2. Integración en `oferty-web`

### Paso 1: Copiar componente y assets
- Copia `OfertyChatWidget.jsx` en `oferty-web/src/components/OfertyChatWidget.jsx`.
- Asegúrate de tener el logo en `oferty-web/public/images/logo-oferty.png`.

### Paso 2: Montar en el layout principal (`oferty-web/src/app/layout.js`)
```jsx
import OfertyChatWidget from "@/components/OfertyChatWidget";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        {children}
        {/* Chatbot flotante de Oferty - Se auto-excluye automáticamente si la ruta es /admin */}
        <OfertyChatWidget />
      </body>
    </html>
  );
}
```

### Paso 3: Variable de entorno en `oferty-web/.env.local`
```env
NEXT_PUBLIC_CHAT_API_URL=/api/chat
```
*(Si no se define, por defecto consume `/api/chat` de su propio backend).*

---

## 📦 3. Opción Alternativa: Widget Embebible (Zero-Code)
Si `oferty-web` prefiere cargarlo mediante `<script>` sin importar componentes React:
```html
<!-- Widget Oficial de Oferty servido por ScraperLabs -->
<script
  src="https://scraperlabs.com.co/widget.js"
  data-bot-id="oferty"
  defer>
</script>
```
El script lee la configuración del bot `oferty`, aplica el logo, colores, sugerencias y el guardrail de seguridad directamente.
