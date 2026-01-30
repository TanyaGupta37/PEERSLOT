import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Not logged in
    window.location.href = "login.html";
    return;
  }

  // Get profile data
  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    // Profile not setup yet
    window.location.href = "setup.html";
    return;
  }

  const data = snap.data();

  document.getElementById("welcome").innerText = 
    `Welcome, ${data.name}`;
});
