import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ------------------ EXISTING CODE ------------------ */

function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

/* ------------------ 🔔 NEW: NOTIFICATION LISTENER ------------------ */

function listenToNotifications(userId) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("notifications");

    if (!container) return;

    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = "<p>No notifications yet</p>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const n = docSnap.data();

      const div = document.createElement("div");
      div.className = "notification-card";
      div.innerHTML = `
        <p><b>${n.fromUser}</b> needs help on <b>${n.topic}</b></p>
      `;

      container.appendChild(div);
    });
  });
}

/* ------------------ AUTH STATE ------------------ */

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

  // First name only
  const firstName = data.name.split(" ")[0];

  document.getElementById("welcome").innerText =
    `Welcome back, ${firstName} 👋`;

  const avatar = document.getElementById("avatar");
  const letter = firstName[0].toUpperCase();

  avatar.innerText = letter;
  avatar.style.background = getAvatarColor(letter);

  /* 🔔 START NOTIFICATION LISTENER */
  listenToNotifications(user.uid);
});

// 🔔 Toggle notification panel
const bell = document.querySelector(".bell");
const panel = document.getElementById("notification-panel");

if (bell && panel) {
  bell.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });
}