// public/js/chatbot.js
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const chatWindow = document.getElementById("chat-window");

function appendMessage(who, text) {
  const el = document.createElement("div");
  el.className = who === "You" ? "chatbot-message user" : "chatbot-message bot";
  
  // Créer le contenu du message
  const messageContent = document.createElement("div");
  messageContent.textContent = text;
  
  // Ajouter un timestamp
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  
  appendMessage("You", question);
  input.value = "";
  
  // Message de chargement temporaire
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