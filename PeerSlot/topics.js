import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= DOM ELEMENTS =================
const helpOfferedDiv = document.getElementById("helpOffered");
const helpNeededDiv = document.getElementById("helpNeeded");
const saveBtn = document.getElementById("saveTopics");

let currentUser = null;

// ================= FETCH ALL TOPICS =================
async function fetchTopics() {
  const snapshot = await getDocs(collection(db, "topics"));
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

// ================= FETCH USER PREFERENCES =================
async function fetchUserPreferences(uid) {
  const prefRef = doc(db, "userPreferences", uid);
  const snap = await getDoc(prefRef);

  if (!snap.exists()) {
    return { helpOffered: [], helpNeeded: [] };
  }

  const data = snap.data();
  return {
    helpOffered: data.helpOffered || [],
    helpNeeded: data.helpNeeded || []
  };
}

// ================= RENDER CHECKBOXES =================
function renderTopics(topics, userPrefs) {
  helpOfferedDiv.innerHTML = "";
  helpNeededDiv.innerHTML = "";

  topics.forEach(topic => {
    // Help Offered
    helpOfferedDiv.insertAdjacentHTML(
      "beforeend",
      `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userPrefs.helpOffered.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `
    );

    // Help Needed
    helpNeededDiv.insertAdjacentHTML(
      "beforeend",
      `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userPrefs.helpNeeded.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `
    );
  });
}

// ================= SAVE TO FIRESTORE =================
async function saveTopics() {
  const helpOffered = [...helpOfferedDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  const helpNeeded = [...helpNeededDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  if (!helpOffered.length && !helpNeeded.length) {
    alert("Please select at least one topic.");
    return;
  }

  await setDoc(
    doc(db, "userPreferences", currentUser.uid),
    {
      helpOffered,
      helpNeeded,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  alert("Topics saved successfully!");
}

// ================= INIT =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  const topics = await fetchTopics();
  const userPrefs = await fetchUserPreferences(user.uid);

  renderTopics(topics, userPrefs);
});

saveBtn.addEventListener("click", saveTopics);
