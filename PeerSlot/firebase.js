import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxIZwZ8I92yk5_sygEiUBkpc-he6xgojI",
  authDomain: "peerslot-agile.firebaseapp.com",
  projectId: "peerslot-agile",
  storageBucket: "peerslot-agile.appspot.com",
  messagingSenderId: "111557845864",
  appId: "1:111557845864:web:11d58bb6cf3ee7757c6cdd"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
