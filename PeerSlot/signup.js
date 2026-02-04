import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  fetchSignInMethodsForEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const errorBox = document.getElementById("error");

function validPrefix(prefix) {
  return /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(prefix);
}

window.signup = async () => {
  errorBox.innerText = "";

  const prefix = emailPrefix.value.trim();
  const password = document.getElementById("password").value;

  if (!validPrefix(prefix)) {
    errorBox.innerText = "Invalid MUJ email format (name.reg)";
    return;
  }

  if (!password) {
    errorBox.innerText = "Password required";
    return;
  }

  const email = prefix + "@muj.manipal.edu";

  try {
    const methods = await fetchSignInMethodsForEmail(auth, email);
    if (methods.length > 0) {
      errorBox.innerText = "Account already registered. Please log in.";
      return;
    }

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(cred.user);

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      profileCompleted: false,
      createdAt: new Date()
    });

    alert("Verification link sent to your MUJ email.");
    window.location.href = "login.html";

  } catch (err) {
    errorBox.innerText = err.message;
  }
};
