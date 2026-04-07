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
  const q = query(collection(db, "messages"));
  onSnapshot(q, (snapshot) => {
    const chatList = document.getElementById("chat-list");
    if (!chatList) return;
    chatList.innerHTML = "";
    const users = new Set();
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      if (msg.participants) {
        msg.participants.forEach(p => {
          if (p !== userId) users.add(p);
        });
      }
    });

    users.forEach(user => {
      const div = document.createElement("div");
      div.innerText = user;
      div.style.padding = "10px";
      div.style.borderRadius = "10px";
      div.style.marginBottom = "6px";
      div.style.cursor = "pointer";
      div.style.background = "#f1f5f9";
      div.onclick = () => {
        currentChatUser = user;
        openChat(user);
      };
      chatList.appendChild(div);
    });

    if (users.size === 0) {
      const empty = document.createElement("div");
      empty.innerText = "No chats yet 😴";
      empty.style.textAlign = "center";
      empty.style.marginTop = "20px";
      empty.style.opacity = "0.6";
      chatList.appendChild(empty);
    }
  });
}

function openChat(userName) {
  const q = query(collection(db, "messages"), orderBy("createdAt"));
  onSnapshot(q, (snapshot) => {
    const messagesDiv = document.getElementById("messages");
    messagesDiv.innerHTML = "";
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      if (msg.participants.includes(userName)) {
        const p = document.createElement("p");
        p.innerText = msg.text;
        messagesDiv.appendChild(p);
      }
    });
  });
}

window.sendMessage = async () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text || !currentChatUser) return;
  await addDoc(collection(db, "messages"), {
    text,
    participants: [currentChatUser],
    createdAt: new Date()
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