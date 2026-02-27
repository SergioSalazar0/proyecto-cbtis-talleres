class ChatbotAssistant {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
        const baseUrl = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL)
            ? API_BASE_URL
            : (window.API_BASE_URL || 'https://proyecto-cbtis-talleres-production.up.railway.app/api');
        this.apiUrl = `${baseUrl}/chatbot/chat`;
        this.clearSessionUrl = `${baseUrl}/chatbot/clear-session`;
        this.sessionId = null;
        this.quickActionsInitialized = false;
        
        this.init();
    }

    getPageContext() {
        const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

        const sectionActiva = document.querySelector('.content-section[style*="display: block"], .content[style*="display: block"], .content-section.active');
        const section = sectionActiva?.id || null;

        const selectoresTaller = [
            '#select-taller-alumnos',
            '#evento-taller',
            '#filtroTallerEvento',
            '#select-taller',
            '#taller-select'
        ];

        let selectedTallerId = null;
        let selectedTallerNombre = null;

        for (const selector of selectoresTaller) {
            const select = document.querySelector(selector);
            if (select && select.value) {
                selectedTallerId = select.value;
                selectedTallerNombre = select.options?.[select.selectedIndex]?.text || null;
                break;
            }
        }

        const token = localStorage.getItem('token');
        let roleHint = 'visitante';
        if (page.includes('dashboard-admin')) roleHint = 'admin';
        else if (page.includes('dashboard-instructor')) roleHint = 'instructor';
        else if (page.includes('dashboard-user')) roleHint = 'alumno';
        else if (token) roleHint = 'autenticado';

        return {
            page,
            section,
            selectedTallerId,
            selectedTallerNombre,
            roleHint
        };
    }

    init() {
        this.createChatbotUI();
        this.attachEventListeners();
        this.loadWelcomeMessage();
    }

    createChatbotUI() {
        // Crear bubble
        const bubble = document.createElement('button');
        bubble.id = 'chatbot-bubble';
        bubble.className = 'chatbot-bubble';
        bubble.innerHTML = '💬';
        bubble.setAttribute('aria-label', 'Abrir chatbot de soporte');
        document.body.appendChild(bubble);

        // Crear ventana de chat
        const chatWindow = document.createElement('div');
        chatWindow.id = 'chatbot-window';
        chatWindow.className = 'chatbot-window';
        chatWindow.innerHTML = `
            <div class="chatbot-header">
                <div>
                    <h3>Soporte CBTis 258</h3>
                    <p>Asistente IA disponible</p>
                </div>
                <div class="chatbot-header-actions">
                    <button id="chatbot-reset" class="chatbot-reset" aria-label="Nueva conversación">↻</button>
                    <button id="chatbot-close" class="chatbot-close" aria-label="Cerrar chat">✕</button>
                </div>
            </div>
            <div id="chatbot-messages" class="chatbot-messages"></div>
            <div class="chatbot-input-container">
                <input 
                    type="text" 
                    id="chatbot-input" 
                    class="chatbot-input" 
                    placeholder="Escribe tu pregunta..."
                    aria-label="Mensaje para el chat"
                />
                <button id="chatbot-send" class="chatbot-send" aria-label="Enviar mensaje">➤</button>
            </div>
        `;
        document.body.appendChild(chatWindow);

        // Inyectar CSS si no está cargado
        this.injectCSSIfNeeded();
    }

    injectCSSIfNeeded() {
        if (!document.getElementById('chatbot-styles')) {
            const cssPath = new URL('css/chatbot.css', document.currentScript?.src || window.location.href).href;
            const link = document.createElement('link');
            link.id = 'chatbot-styles';
            link.rel = 'stylesheet';
            link.href = cssPath.replace(/\/js\/.*/, '/css/chatbot.css');
            document.head.appendChild(link);
        }
    }

    attachEventListeners() {
        const bubble = document.getElementById('chatbot-bubble');
        const closeBtn = document.getElementById('chatbot-close');
        const resetBtn = document.getElementById('chatbot-reset');
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');

        bubble.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.toggleChat());
        resetBtn.addEventListener('click', () => this.resetConversation());
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Prevenir que el input reciba eventos del bubbleclick
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        const chatWindow = document.getElementById('chatbot-window');
        const bubble = document.getElementById('chatbot-bubble');
        
        chatWindow.classList.toggle('active', this.isOpen);
        bubble.classList.toggle('active', this.isOpen);

        if (this.isOpen) {
            document.getElementById('chatbot-input').focus();
        }
    }

    loadWelcomeMessage() {
        const messagesContainer = document.getElementById('chatbot-messages');
        
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'chat-message bot';
        welcomeMessage.innerHTML = `
            <div class="message-bubble bot">
                ¡Hola! 👋 Soy tu asistente de soporte del Sistema de Gestión de Talleres CBTis 258. 
                Puedo ayudarte con:
                <br><br>
                • 📝 Inscripción a talleres<br>
                • 📅 Calendarios y horarios<br>
                • 📢 Avisos e información<br>
                • 👤 Gestión de perfiles<br>
                <br>
                ¿En qué puedo ayudarte?
            </div>
        `;
        
        messagesContainer.appendChild(welcomeMessage);
        this.renderQuickActions();
        this.scrollToBottom();
    }

    getQuickActions() {
        const context = this.getPageContext();
        const role = context.roleHint;

        if (role === 'admin') {
            return [
                'Dame un resumen de usuarios del sistema',
                'Muéstrame talleres activos e inactivos',
                '¿Cómo gestiono instructores y talleres?'
            ];
        }

        if (role === 'instructor') {
            return [
                '¿Cuáles son mis talleres asignados?',
                '¿Cómo registrar asistencia correctamente?',
                'Muéstrame próximos eventos de mis talleres'
            ];
        }

        if (role === 'alumno') {
            return [
                '¿En qué talleres estoy inscrito?',
                'Muéstrame mis próximos eventos',
                '¿Dónde veo avisos de mis talleres?'
            ];
        }

        if (context.page.includes('login')) {
            return [
                'No puedo iniciar sesión',
                '¿Cómo recupero mi contraseña?',
                '¿Qué tipo de usuario puedo usar?'
            ];
        }

        if (context.page.includes('register')) {
            return [
                '¿Cómo me registro correctamente?',
                '¿Qué datos me van a pedir?',
                '¿Qué hago después de registrarme?'
            ];
        }

        return [
            '¿Qué talleres hay disponibles?',
            '¿Qué carreras ofrece el CBTis 258?',
            '¿Cómo me inscribo a un taller?'
        ];
    }

    renderQuickActions() {
        if (this.quickActionsInitialized) return;

        const messagesContainer = document.getElementById('chatbot-messages');
        if (!messagesContainer) return;

        const acciones = this.getQuickActions();
        if (!acciones.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'chatbot-quick-actions';

        acciones.forEach((texto) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'chatbot-quick-action-btn';
            btn.textContent = texto;
            btn.addEventListener('click', () => this.sendPresetMessage(texto));
            wrap.appendChild(btn);
        });

        messagesContainer.appendChild(wrap);
        this.quickActionsInitialized = true;
    }

    async sendPresetMessage(text) {
        if (this.isLoading) return;
        await this.sendMessageText(text);
    }

    async resetConversation() {
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            await fetch(this.clearSessionUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sessionId: this.sessionId })
            });
        } catch (error) {
            console.warn('No se pudo limpiar sesión remota de chatbot:', error);
        } finally {
            this.sessionId = null;
            this.quickActionsInitialized = false;
            this.removeTypingIndicator();

            const messagesContainer = document.getElementById('chatbot-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }

            this.loadWelcomeMessage();
            this.addMessage('🔄 Conversación reiniciada. ¿En qué te ayudo ahora?', 'bot');
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message || this.isLoading) return;
        input.value = '';
        await this.sendMessageText(message);
    }

    async sendMessageText(message) {
        if (!message || this.isLoading) return;

        // Agregar mensaje del usuario
        this.addMessage(message, 'user');

        // Mostrar indicador de escritura
        this.showTypingIndicator();
        this.isLoading = true;

        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json'
            };

            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    message,
                    sessionId: this.sessionId,
                    pageContext: this.getPageContext()
                })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.statusText}`);
            }

            const data = await response.json();
            
            // Guardar sessionId si viene en la respuesta
            if (data.sessionId) {
                this.sessionId = data.sessionId;
            }
            
            // Remover indicador de escritura
            this.removeTypingIndicator();
            
            // Agregar respuesta del bot
            this.addMessage(data.response, 'bot');

        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            this.removeTypingIndicator();
            this.addMessage(
                '❌ Disculpa, no pude procesar tu pregunta. Intenta de nuevo o contacta al administrador.',
                'bot'
            );
        } finally {
            this.isLoading = false;
            const input = document.getElementById('chatbot-input');
            if (input) input.focus();
        }
    }

    addMessage(text, sender) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${sender}`;
        bubble.textContent = text;
        bubble.style.whiteSpace = 'pre-wrap';

        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);

        this.scrollToBottom();
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'chat-message bot';
        typingDiv.innerHTML = `
            <div class="message-bubble bot">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatbot-messages');
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 0);
    }
}

// Inicializar chatbot cuando el DOM está listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chatbotAssistant = new ChatbotAssistant();
    });
} else {
    window.chatbotAssistant = new ChatbotAssistant();
}
