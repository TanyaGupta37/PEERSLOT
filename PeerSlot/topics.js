// ================= FIREBASE =================
import { db } from "./firebase.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ================= DOM ELEMENTS =================
const helpOfferedDiv = document.getElementById("helpOffered");
const helpNeededDiv = document.getElementById("helpNeeded");
const saveBtn = document.getElementById("saveTopics");

// ================= USER DATA (TEMP STORAGE) =================
function getUserTopics() {
  return {
    helpOffered: JSON.parse(localStorage.getItem("helpOffered")) || [],
    helpNeeded: JSON.parse(localStorage.getItem("helpNeeded")) || []
  };
}

// ================= FETCH TOPICS FROM FIRESTORE =================
async function fetchTopics() {
  const snapshot = await getDocs(collection(db, "topics"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name
  }));
}

// ================= RENDER TOPICS =================
async function renderTopics() {
  const userData = getUserTopics();
  const topics = await fetchTopics();

  helpOfferedDiv.innerHTML = "";
  helpNeededDiv.innerHTML = "";

  topics.forEach(topic => {
    // Help Offered
    helpOfferedDiv.innerHTML += `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userData.helpOffered.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `;

    // Help Needed
    helpNeededDiv.innerHTML += `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userData.helpNeeded.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `;
  });
}

// ================= SAVE SELECTION =================
function saveTopics() {
  const helpOffered = [...helpOfferedDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  const helpNeeded = [...helpNeededDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  localStorage.setItem("helpOffered", JSON.stringify(helpOffered));
  localStorage.setItem("helpNeeded", JSON.stringify(helpNeeded));

  alert("Topics saved successfully!");
}

// ================= INIT =================
renderTopics();
saveBtn.addEventListener("click", saveTopics);
