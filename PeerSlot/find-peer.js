import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { formatTimeDisplay, getShortDay, SLOT_STATUS } from "./availability.js";

const avatarColors = [
  "#2563eb", "#16a34a", "#db2777",
  "#9333ea", "#ea580c", "#0d9488"
];

function getAvatarColor(letter) {
  return avatarColors[letter.charCodeAt(0) % avatarColors.length];
}

let allSlots = [];
let currentUid = null;

// Fetch all available slots and join with user profile data
async function fetchSlots() {
  const q = query(
    collection(db, "availabilitySlots"),
    where("status", "==", SLOT_STATUS.AVAILABLE)
  );

  const snapshot = await getDocs(q);
  const slotDocs = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((s) => s.userId && s.userId !== currentUid);

  const uniqueUserIds = Array.from(new Set(slotDocs.map((s) => s.userId)));

  const userEntries = await Promise.all(
    uniqueUserIds.map(async (uid) => {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) {
        return [uid, { name: "Unknown", subjects: [] }];
      }
      const data = userSnap.data();
      return [uid, { name: data.name || "Unknown", subjects: data.subjects || [] }];
    })
  );

  const userById = Object.fromEntries(userEntries);

  return slotDocs.map((slot) => {
    const user = userById[slot.userId] || { name: "Unknown", subjects: [] };
    return {
      uid: slot.userId,
      name: user.name,
      subjects: user.subjects,
      day: slot.day || "",
      startTime: slot.startTime || "",
      endTime: slot.endTime || "",
      duration: slot.duration,
      slotId: slot.id
    };
  });
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

    const timeText = (slot.startTime && slot.endTime)
      ? `${formatTimeDisplay(slot.startTime)} – ${formatTimeDisplay(slot.endTime)}`
      : "";

    return `
      <div class="slot-card">
        <div class="slot-left">
          <div class="slot-avatar" style="background:${color}">${letter}</div>
          <div class="slot-details">
            <h4>${slot.name}</h4>
            <div class="slot-meta">
              <span>📅 ${slot.day}</span>
              <span>🕐 ${timeText}</span>
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
    filtered = filtered.filter((slot) => getShortDay(slot.day) === dayFilter);
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
