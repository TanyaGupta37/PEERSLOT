import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

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

  const findPeerBtn = document.getElementById("find-peer-btn");
  if (findPeerBtn) {
    findPeerBtn.addEventListener("click", () => {
      window.location.href = "find-peer.html";
    });
  }
});
