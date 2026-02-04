import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from
"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const errorBox = document.getElementById("error");

function validPrefix(prefix) {
  return /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(prefix);
}

window.login = async () => {
  errorBox.innerText = "";

  const prefix = emailPrefix.value.trim();
  const password = document.getElementById("password").value;

  if (!validPrefix(prefix)) {
    errorBox.innerText = "Invalid MUJ email format (name.reg)";
    return;
  }

  const email = prefix + "@muj.manipal.edu";

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (!cred.user.emailVerified) {
      errorBox.innerText = "Please verify your email first.";
      return;
    }

    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) {
      errorBox.innerText = "Account not found.";
      return;
    }

    if (!snap.data().profileCompleted) {
      window.location.href = "setup.html";
    } else {
      window.location.href = "dashboard.html";
    }

  } catch {
    errorBox.innerText = "Account not found or incorrect password.";
  }
};

