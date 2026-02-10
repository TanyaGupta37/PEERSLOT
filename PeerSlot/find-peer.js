import { auth, db } from "./firebase.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const topicFilter = document.getElementById("topicFilter");
const modeFilter = document.getElementById("modeFilter");
const resultsDiv = document.getElementById("peerResults");
const searchBtn = document.getElementById("searchBtn");

// Read URL params (from Dashboard → Find)
const params = new URLSearchParams(window.location.search);
const initialTopic = params.get("topic");
const initialMode = params.get("mode");

// Load Topics from Firestore
async function loadTopics() {
  const snap = await getDocs(collection(db, "topics"));

  snap.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.textContent = doc.data().name;
    topicFilter.appendChild(opt);
  });

  if (initialTopic) topicFilter.value = initialTopic;
  if (initialMode) modeFilter.value = initialMode;
}

loadTopics();

// Search peers
searchBtn.addEventListener("click", async () => {
  resultsDiv.innerHTML = "Loading...";

  const topic = topicFilter.value;

  if (!topic) {
    alert("Please select a topic");
    resultsDiv.innerHTML = "";
    return;
  }

  const q = query(
    collection(db, "userPreferences"),
    where("helpOffered", "array-contains", topic)
  );

  const snap = await getDocs(q);
  resultsDiv.innerHTML = "";

  if (snap.empty) {
    resultsDiv.innerHTML = "<p>No matching peers found.</p>";
    return;
  }

  snap.forEach(doc => {
    const data = doc.data();

    const card = document.createElement("div");
    card.className = "peer-card";
    card.innerHTML = `
      <strong>Peer Available</strong><br>
      Can help in: ${data.helpOffered.join(", ")}<br><br>
      <button>Request Session</button>
    `;

    resultsDiv.appendChild(card);
  });
});
