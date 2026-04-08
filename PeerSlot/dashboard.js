import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  onSnapshot,
  orderBy,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setupNotifications } from "./notifications.js";

function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Failed to log out. Please try again.");
  }
}

function getAvatarInitial(name) {
  const firstName = (name || "Peer").split(" ")[0];
  return (firstName[0] || "P").toUpperCase();
}

/* ================= CHAT FEATURE ================= */
let currentChatUser = null;
let allPartners = new Map();

window.setCurrentChatUser = (partnerId) => {
  currentChatUser = partnerId;
};
window.getCurrentChatUser = () => currentChatUser;

function loadChatList(userId) {
  // Listen for all messages where current user is a participant
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, async (snapshot) => {
    // Use a Map to keep track of unique chat partners and their latest message
    allPartners.clear();
    
    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const partnerId = msg.participants.find(p => p !== userId);
      
      // Add partner with their latest message (including "Say hi" preview)
      if (partnerId && !allPartners.has(partnerId)) {
        const userSnap = await getDoc(doc(db, "users", partnerId));
        const userData = userSnap.exists() ? userSnap.data() : { name: "Unknown" };
        allPartners.set(partnerId, {
          name: userData.name || "Unknown",
          lastText: msg.text
        });
      }
    }

    // Render the chat list
    renderChatList(Array.from(allPartners.entries()), userId);
  });
}
window.loadChatList = loadChatList;
window.openChat = openChat;

function openChat(partnerId, userId) {
  const messagesDiv = document.getElementById("messages");
  const headerDiv = document.getElementById("chat-header");
  if (!messagesDiv || !headerDiv) return;

  // Update header with partner name
  if (allPartners.has(partnerId)) {
    headerDiv.textContent = allPartners.get(partnerId).name;
  }

  const q = query(
    collection(db, "messages"), 
    where("participants", "array-contains", userId),
    orderBy("createdAt", "asc")
  );

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    
    const relevantMsgs = snapshot.docs
      .map(d => d.data())
      .filter(m =>
        m.participants.includes(partnerId) &&
        m.participants.includes(userId) &&
        m.type !== "system_intro" // Filter out system intro messages
    );

    relevantMsgs.forEach(msg => {
      const div = document.createElement("div");
      div.className = `chat-message ${msg.senderId === userId ? 'own' : ''}`;
      
      // Format timestamp
      const timestamp = msg.createdAt ? new Date(msg.createdAt.seconds * 1000) : new Date();
      const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      div.innerHTML = `
        <div class="message-text">${msg.text}</div>
        <div class="message-time">${timeString}</div>
      `;
      messagesDiv.appendChild(div);
    });
    
    // Auto-scroll to bottom
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

window.sendMessage = async () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  const user = auth.currentUser;
  if (!text || !currentChatUser || !user) return;

  try {
    // Optimistically add message to UI immediately
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) {
      const div = document.createElement("div");
      div.className = "chat-message own";
      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      div.innerHTML = `
        <div class="message-text">${text}</div>
        <div class="message-time">${timeString}</div>
      `;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Send to Firestore
    await addDoc(collection(db, "messages"), {
      text,
      senderId: user.uid,
      participants: [user.uid, currentChatUser],
      createdAt: new Date()
    });
    input.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

function renderChatList(partners, userId) {
  const chatList = document.getElementById("chat-list");
  if (!chatList) return;
  
  chatList.innerHTML = "";
  
  if (partners.length === 0) {
    chatList.innerHTML = '<div style="text-align:center;margin-top:20px;opacity:0.6;">No chats yet 😴</div>';
    return;
  }
  
  partners.forEach(([partnerId, data]) => {
    const div = document.createElement("div");
    div.className = "chat-partner-item" + (currentChatUser === partnerId ? " active" : "");
    div.innerHTML = `
      <div class="partner-name">${data.name}</div>
      <div class="partner-preview">${data.lastText}</div>
    `;

    div.onclick = () => {
      currentChatUser = partnerId;
      renderChatList(Array.from(allPartners.entries()), userId);
      openChat(partnerId, userId);
    };
    chatList.appendChild(div);
  });
}

/* ===== DOM Ready ===== */

document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.getElementById("avatar");
  const avatarDropdown = document.getElementById("avatarDropdown");
  const firstNameSpan = document.getElementById("firstName");

  if (!avatar || !avatarDropdown) return;

  /* ===== Auth + User Data ===== */

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) {
      window.location.href = "setup.html";
      return;
    }

    const data = snap.data();
    const fullName = data.name || "User";
    const firstName = fullName.split(" ")[0] || "U";

    if (firstNameSpan) {
      firstNameSpan.innerText = firstName;
    }

    const letter = firstName.charAt(0).toUpperCase();
    avatar.innerText = letter;
    avatar.style.background = getAvatarColor(letter);

    setupNotifications();
    
    // Setup chat search listener
    const chatSearch = document.getElementById("chatSearch");
    if (chatSearch) {
      chatSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = Array.from(allPartners.entries()).filter(([partnerId, data]) => {
          return data.name.toLowerCase().includes(query);
        });
        renderChatList(filtered, user.uid);
      });
    }
    
    loadChatList(user.uid);
    // Setup enter key to send message
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          sendMessage();
        }
      });
    }
  });

  /* ===== Avatar Dropdown Toggle ===== */

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!avatar.contains(e.target) && !avatarDropdown.contains(e.target)) {
      avatarDropdown.classList.remove("show");
    }
  });

  /* ===== Dropdown Actions ===== */

  avatarDropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".avatar-dropdown-item");
    if (!item) return;

    const action = item.dataset.action;
    avatarDropdown.classList.remove("show");

    switch (action) {
      case "profile":
        window.location.href = "profile.html";
        break;

      case "settings":
        window.location.href = "settings.html";
        break;

      case "logout":
        handleLogout();
        break;
    }
  });
});