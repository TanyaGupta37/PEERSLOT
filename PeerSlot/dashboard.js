import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== Helpers ===== */

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

    // Welcome text
    if (firstNameSpan) {
      firstNameSpan.innerText = firstName;
    }

    // Avatar
    const letter = firstName.charAt(0).toUpperCase();
    avatar.innerText = letter;
    avatar.style.background = getAvatarColor(letter);
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
