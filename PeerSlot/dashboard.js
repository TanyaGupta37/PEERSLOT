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

function loadChatList(userId) {
  // Listen for all messages where current user is a participant
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, async (snapshot) => {
    const chatList = document.getElementById("chat-list");
    if (!chatList) return;
    
    chatList.innerHTML = "";
    
    // Use a Map to keep track of unique chat partners and their latest message
    const partners = new Map();
    
    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const partnerId = msg.participants.find(p => p !== userId);
      if (partnerId && !partners.has(partnerId)) {
        partners.set(partnerId, msg);
      }
    }

    if (partners.size === 0) {
      chatList.innerHTML = '<div style="text-align:center;margin-top:20px;opacity:0.6;">No chats yet 😴</div>';
      return;
    }

    // Render each partner
    for (const [partnerId, lastMsg] of partners) {
      const userSnap = await getDoc(doc(db, "users", partnerId));
      const userData = userSnap.exists() ? userSnap.data() : { name: "Unknown" };
      const name = userData.name || "Unknown";
      
      const div = document.createElement("div");
      div.className = "chat-partner-item";
      div.innerHTML = `
        <div style="font-weight: 500; font-size: 14px;">${name}</div>
        <div style="font-size: 11px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${lastMsg.text}
        </div>
      `;
      div.style.padding = "12px";
      div.style.borderRadius = "12px";
      div.style.marginBottom = "8px";
      div.style.cursor = "pointer";
      div.style.background = currentChatUser === partnerId ? "#e2e8f0" : "#f1f5f9";
      div.style.transition = "background 0.2s";
      
      div.onclick = () => {
        currentChatUser = partnerId;
        // Re-render list to show active state
        loadChatList(userId); 
        openChat(partnerId, userId);
      };
      chatList.appendChild(div);
    }
  });
}

function openChat(partnerId, userId) {
  const messagesDiv = document.getElementById("messages");
  if (!messagesDiv) return;

  const q = query(
    collection(db, "messages"), 
    where("participants", "array-contains", userId),
    orderBy("createdAt", "asc")
  );

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    
    const relevantMsgs = snapshot.docs
      .map(d => d.data())
      .filter(m => m.participants.includes(partnerId));

    relevantMsgs.forEach(msg => {
      const div = document.createElement("div");
      
      if (msg.type === "system_intro") {
        div.className = "system-message";
        div.innerText = msg.text;
      } else {
        div.className = `chat-message ${msg.senderId === userId ? 'own' : ''}`;
        div.innerText = msg.text;
      }
      
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

  await addDoc(collection(db, "messages"), {
    text,
    senderId: user.uid,
    participants: [user.uid, currentChatUser],
    createdAt: serverTimestamp()
  });
  input.value = "";
};

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
    loadChatList(user.uid);
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