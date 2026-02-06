import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const avatarColors = [
  "#2563eb", "#16a34a", "#db2777",
  "#9333ea", "#ea580c", "#0d9488"
];

function getAvatarColor(letter) {
  return avatarColors[letter.charCodeAt(0) % avatarColors.length];
}

let allSlots = [];
let currentUid = null;

// Fetch all users and flatten their availability into slot entries
async function fetchSlots() {
  const snapshot = await getDocs(collection(db, "users"));
  const slots = [];

  snapshot.forEach((docSnap) => {
    const uid = docSnap.id;
    if (uid === currentUid) return; // AC3: Exclude self

    const data = docSnap.data();
    const availability = data.availability || [];
    const subjects = data.subjects || [];
    const name = data.name || "Unknown";

    availability.forEach((slot) => {
      slots.push({
        uid,
        name,
        subjects,
        day: slot.day || "",
        time: slot.time || "",
      });
    });
  });

  return slots;
}

// Render slot cards into the container
function renderSlots(slots) {
  const container = document.getElementById("slots-container");
  const emptyState = document.getElementById("empty-state");

  if (slots.length === 0) {
    container.innerHTML = "";
    emptyState.style.display = "block";
    lucide.createIcons();
    return;
  }

  emptyState.style.display = "none";

  container.innerHTML = slots.map((slot) => {
    const letter = slot.name[0].toUpperCase();
    const color = getAvatarColor(letter);
    const tags = slot.subjects.map(
      (s) => `<span class="slot-tag">${s}</span>`
    ).join("");

    return `
      <div class="slot-card">
        <div class="slot-left">
          <div class="slot-avatar" style="background:${color}">${letter}</div>
          <div class="slot-details">
            <h4>${slot.name}</h4>
            <div class="slot-meta">
              <span>📅 ${slot.day}</span>
              <span>🕐 ${slot.time}</span>
            </div>
            <div class="slot-tags">${tags}</div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// Apply filters to allSlots and re-render
function applyFilters() {
  const subjectFilter = document.getElementById("filter-subject").value;
  const dayFilter = document.getElementById("filter-day").value;

  let filtered = [...allSlots];

  if (subjectFilter) {
    filtered = filtered.filter((slot) =>
      slot.subjects.includes(subjectFilter)
    );
  }

  if (dayFilter) {
    filtered = filtered.filter((slot) => slot.day === dayFilter);
  }

  renderSlots(filtered);
}

// Clear filters and show all
function clearFilters() {
  document.getElementById("filter-subject").value = "";
  document.getElementById("filter-day").value = "";
  renderSlots(allSlots);
}

// Init
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUid = user.uid;

  // Set avatar
  const avatarEl = document.getElementById("avatar");
  if (avatarEl) {
    const snap = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js")
      .then(({ doc, getDoc }) => getDoc(doc(db, "users", user.uid)));
    if (snap.exists()) {
      const firstName = snap.data().name.split(" ")[0];
      const letter = firstName[0].toUpperCase();
      avatarEl.innerText = letter;
      avatarEl.style.background = getAvatarColor(letter);
    }
  }

  // Fetch and render slots
  allSlots = await fetchSlots();
  renderSlots(allSlots);

  // Bind filter buttons
  document.getElementById("apply-filters").addEventListener("click", applyFilters);
  document.getElementById("clear-filters").addEventListener("click", clearFilters);
});
