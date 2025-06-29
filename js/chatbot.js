// js/chatbot.js
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const chatWindow = document.getElementById("chat-window");

// Theme toggle
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  body.classList.add('dark');
  themeToggle.textContent = '☀️';
}

themeToggle.addEventListener('click', () => {
  body.classList.toggle('dark');
  const isDark = body.classList.contains('dark');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Ajouter un message au chat
function appendMessage(who, text) {
  const el = document.createElement("div");
  el.className = who === "You" ? "chatbot-message user" : "chatbot-message bot";
  
  // Contenu du message
  const messageContent = document.createElement("div");
  
  if (who === "Bot") {
    // Convertir le markdown en HTML pour les réponses du bot
    const formattedText = text
      .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')  // ### Titre
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // **gras**
      .replace(/\*(.*?)\*/g, '<em>$1</em>')  // *italique*
      .replace(/`(.*?)`/g, '<code>$1</code>')  // `code`
      .replace(/\n\n/g, '<br><br>')  // Double saut de ligne
      .replace(/\n/g, '<br>');  // Simple saut de ligne
    
    messageContent.innerHTML = formattedText;
  } else {
    messageContent.textContent = text;
  }
  
  // Timestamp
  const timestamp = document.createElement("span");
  timestamp.className = "timestamp";
  timestamp.textContent = new Date().toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  el.appendChild(messageContent);
  el.appendChild(timestamp);
  
  chatWindow.appendChild(el);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Soumission du formulaire
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  
  // Afficher le message utilisateur
  appendMessage("You", question);
  input.value = "";
  
  // Message de chargement
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "chatbot-message bot";
  loadingDiv.textContent = "…thinking…";
  loadingDiv.id = "loading-message";
  chatWindow.appendChild(loadingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const json = await res.json();
    
    // Supprimer le message de chargement
    const loadingMessage = document.getElementById("loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    
    if (res.ok) {
      appendMessage("Bot", json.answer);
    } else {
      appendMessage("Bot", `Error: ${json.error || json.details}`);
    }
  } catch (err) {
    // Supprimer le message de chargement en cas d'erreur
    const loadingMessage = document.getElementById("loading-message");
    if (loadingMessage) {
      loadingMessage.remove();
    }
    appendMessage("Bot", `Fetch error: ${err.message}`);
  }
});