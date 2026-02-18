class ChatbotAssistant {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
        this.apiUrl = 'http://localhost:5000/api/chatbot/chat';
        this.clearSessionUrl = 'http://localhost:5000/api/chatbot/clear-session';
        this.sessionId = null;
        
        this.init();
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
                <button id="chatbot-close" class="chatbot-close" aria-label="Cerrar chat">✕</button>
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
        const sendBtn = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');

        bubble.addEventListener('click', () => this.toggleChat());
        closeBtn.addEventListener('click', () => this.toggleChat());
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
        this.scrollToBottom();
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();

        if (!message || this.isLoading) return;

        // Agregar mensaje del usuario
        this.addMessage(message, 'user');
        input.value = '';

        // Mostrar indicador de escritura
        this.showTypingIndicator();
        this.isLoading = true;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    sessionId: this.sessionId
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
            document.getElementById('chatbot-input').focus();
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
