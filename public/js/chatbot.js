/* public/js/chatbot.js */
// Sleek Self-contained Chatbot Module for SecondWare

(function () {
  // 1. Inject the stylesheet into document head
  const linkId = 'chatbot-style-link';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    // Path relative to pages loading the script (which are in public root)
    link.href = 'css/chatbot.css';
    document.head.appendChild(link);
  }

  // 2. Setup Conversation History
  let conversation = [];
  try {
    const saved = sessionStorage.getItem('secondware_chat_conversation');
    if (saved) {
      conversation = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to parse chat history:', e);
  }

  // 3. Inject Chatbot DOM structure
  const chatbotContainer = document.createElement('div');
  chatbotContainer.id = 'secondware-chatbot';
  chatbotContainer.className = 'chatbot-widget closed';
  
  // Decide whether to show pulsating badge (session-only first arrival)
  const isFirstLoad = !sessionStorage.getItem('secondware_chat_badge_dismissed');
  const badgeHtml = isFirstLoad ? '<span class="chatbot-badge" id="chatbot-badge"></span>' : '';

  chatbotContainer.innerHTML = `
    <button id="chatbot-toggle-btn" class="chatbot-toggle" aria-label="Open support chat">
      ${badgeHtml}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
        <path d="M8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6-.097 1.016-.417 2.13-.771 2.966-.079.186.074.394.273.362 2.256-.37 3.597-.938 4.18-1.234A9.06 9.06 0 0 0 8 15z"/>
      </svg>
    </button>
    <div class="chatbot-window">
      <div class="chat-header">
        <div class="chat-header-info">
          <div class="chat-header-avatar">W</div>
          <div class="chat-header-title">
            <span class="chat-header-name">Warey</span>
            <span class="chat-header-status">Online Assistant</span>
          </div>
        </div>
        <button id="chatbot-close-btn" class="chat-close-btn" aria-label="Close support chat">✕</button>
      </div>
      <div id="chatbot-messages-container" class="chat-content">
        <!-- Messages dynamically loaded -->
      </div>
      <div class="chat-input-area">
        <div class="chat-input-wrapper">
          <input type="text" id="chatbot-text-input" placeholder="Ask Warey..." autocomplete="off" />
        </div>
        <button id="chatbot-send-btn" class="chat-send-btn" aria-label="Send message">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.03a.5.5 0 0 1 .54.116L15.854.146zm-6 10.423 3.823-3.823-3.823 3.823z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(chatbotContainer);

  // 4. Cache DOM references
  const widget = document.getElementById('secondware-chatbot');
  const toggleBtn = document.getElementById('chatbot-toggle-btn');
  const closeBtn = document.getElementById('chatbot-close-btn');
  const msgsContainer = document.getElementById('chatbot-messages-container');
  const inputField = document.getElementById('chatbot-text-input');
  const sendBtn = document.getElementById('chatbot-send-btn');

  // 5. Setup Text Formatting Helper
  function formatMessageText(text) {
    // Escape HTML first to prevent injection
    let escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    
    // Bold: **text** -> <strong>text</strong>
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet lists
    const lines = escaped.split('\n');
    let inList = false;
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const content = trimmed.substring(2);
        if (!inList) {
          inList = true;
          return `<ul><li>${content}</li>`;
        }
        return `<li>${content}</li>`;
      } else {
        if (inList) {
          inList = false;
          return `</ul><p>${line}</p>`;
        }
        return line ? `<p>${line}</p>` : '';
      }
    });
    
    let result = processedLines.join('\n');
    if (inList) {
      result += '</ul>';
    }
    
    return result;
  }

  // 6. Message Rendering Functions
  function appendMessageBubble(text, sender = 'bot') {
    const bubble = document.createElement('div');
    bubble.className = `chat-message ${sender}`;
    bubble.innerHTML = formatMessageText(text);
    msgsContainer.appendChild(bubble);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    return bubble;
  }

  function appendTypingIndicator() {
    const bubble = document.createElement('div');
    bubble.className = 'chat-message typing';
    bubble.innerHTML = `
      <div class="chat-dot"></div>
      <div class="chat-dot"></div>
      <div class="chat-dot"></div>
    `;
    msgsContainer.appendChild(bubble);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
    return bubble;
  }

  // 7. Load and render current history
  function renderHistory() {
    msgsContainer.innerHTML = '';
    
    // If conversation is empty, populate welcoming bot message
    if (conversation.length === 0) {
      const welcomeMsg = "Hi! I'm **Warey**, your SecondWare Support Assistant. Ask me anything about our surplus home appliances, Nagpur area shipping fees, or our warranty policies!";
      appendMessageBubble(welcomeMsg, 'bot');
      conversation.push({ role: 'model', parts: [{ text: welcomeMsg }] });
      sessionStorage.setItem('secondware_chat_conversation', JSON.stringify(conversation));
    } else {
      conversation.forEach(msg => {
        const role = msg.role === 'model' || msg.role === 'assistant' ? 'bot' : 'user';
        const text = msg.parts?.[0]?.text || '';
        appendMessageBubble(text, role);
      });
    }
  }

  // Initialize history load
  renderHistory();

  // 8. Handle Send Action
  async function handleSend() {
    const text = inputField.value.trim();
    if (!text) return;

    // Clear input
    inputField.value = '';

    // Append user message to UI & history
    appendMessageBubble(text, 'user');
    conversation.push({ role: 'user', parts: [{ text: text }] });
    sessionStorage.setItem('secondware_chat_conversation', JSON.stringify(conversation));

    // Append typing indicator
    const typingIndicator = appendTypingIndicator();

    try {
      // Send history to backend Netlify function
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: conversation })
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status}`);
      }

      const result = await response.json();
      const reply = result.reply || "I'm sorry, I couldn't get a proper response.";

      // Remove typing bubble
      typingIndicator.remove();

      // Append bot response to UI & history
      appendMessageBubble(reply, 'bot');
      conversation.push({ role: 'model', parts: [{ text: reply }] });
      sessionStorage.setItem('secondware_chat_conversation', JSON.stringify(conversation));

    } catch (error) {
      console.error('Failed to get response from Warey:', error);
      typingIndicator.remove();
      appendMessageBubble("Sorry, I encountered a temporary connection issue. Please check your network and try again.", 'bot');
    }
  }

  // 9. Event Listeners
  toggleBtn.addEventListener('click', () => {
    const isClosed = widget.classList.toggle('closed');
    
    // Dismiss pulsating badge upon first expansion
    if (!isClosed && isFirstLoad) {
      const badge = document.getElementById('chatbot-badge');
      if (badge) {
        badge.remove();
      }
      sessionStorage.setItem('secondware_chat_badge_dismissed', 'true');
    }

    // Scroll to bottom when opening
    if (!isClosed) {
      setTimeout(() => {
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
        inputField.focus();
      }, 50);
    }
  });

  closeBtn.addEventListener('click', () => {
    widget.classList.add('closed');
  });

  sendBtn.addEventListener('click', handleSend);
  inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  });

})();
