export class SessionWebSocket {
  constructor(sessionId, userId, callbacks) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.callbacks = callbacks;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    // Используем тот же хост, но для WebSocket нужно использовать правильный протокол
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // В dev режиме vite проксирует на порт 3333, в prod - тот же порт
    const isDev = window.location.port === '5173';
    const wsPort = isDev ? '3333' : window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const wsHost = isDev ? `${window.location.hostname}:${wsPort}` : window.location.host;
    const wsUrl = `${protocol}//${wsHost}`;

    console.log('[WebSocket] Connecting to:', wsUrl, 'sessionId:', this.sessionId, 'userId:', this.userId);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;
      
      // Регистрируемся
      const registerMessage = {
        type: 'register',
        userId: this.userId,
        sessionId: this.sessionId
      };
      console.log('[WebSocket] Sending register message:', registerMessage);
      this.ws.send(JSON.stringify(registerMessage));

      if (this.callbacks.onConnect) {
        this.callbacks.onConnect();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      console.error('[WebSocket] Error details:', {
        url: this.ws?.url,
        readyState: this.ws?.readyState,
        sessionId: this.sessionId,
        userId: this.userId
      });
      if (this.callbacks.onError) {
        this.callbacks.onError(error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      if (this.callbacks.onDisconnect) {
        this.callbacks.onDisconnect();
      }
      
      // Попытка переподключения
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => {
          console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
          this.connect();
        }, this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  handleMessage(data) {
    switch (data.type) {
      case 'session_state':
        if (this.callbacks.onSessionState) {
          this.callbacks.onSessionState(data.session);
        }
        break;

      case 'session_started':
        if (this.callbacks.onSessionStarted) {
          this.callbacks.onSessionStarted(data.cards, data.participants);
        }
        break;

      case 'selection_update':
        if (this.callbacks.onSelectionUpdate) {
          this.callbacks.onSelectionUpdate(data.selections);
        }
        break;

      case 'session_finished':
        if (this.callbacks.onSessionFinished) {
          this.callbacks.onSessionFinished(data.results, data.cards);
        }
        break;

      case 'participant_joined':
        if (this.callbacks.onParticipantJoined) {
          this.callbacks.onParticipantJoined(data.participants);
        }
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  }

  sendCardSelection(cardIndex) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'card_selected',
        cardIndex
      }));
    }
  }

  sendFinishedSwiping() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'finished_swiping'
      }));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

