import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setupNotifications, sendMatchRequestNotification } from "./notifications.js";

// Utility functions copied locally to avoid get-help.js dependency issues if needed, 
// though we keep them here for now.
import { formatTimeDisplay, getShortDay, SLOT_STATUS } from "./get-help.js";

const avatarColors = [
  "#2563eb", "#16a34a", "#db2777",
  "#9333ea", "#ea580c", "#0d9488"
];

function getAvatarColor(letter) {
  return avatarColors[letter.charCodeAt(0) % avatarColors.length];
}

let allSlots = [];
let currentUid = null;

let selectedSlot = null;
let selectedPeer = null;

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

    // Use slot subject if available, otherwise fallback to user subjects
    const subjects = slot.subject ? [slot.subject] : (user.subjects || []);

    // Handle day from date if day field is missing
    let dayDisplay = slot.day || "";
    if (!dayDisplay && slot.date) {
      // Create date object (append time to avoid timezone issues with pure date string)
      const d = new Date(slot.date + "T00:00:00");
      dayDisplay = d.toLocaleDateString('en-US', { weekday: 'long' });
    }

    return {
      uid: slot.userId,
      name: user.name,
      subjects: subjects,
      day: dayDisplay || "",
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
      <div class="slot-card" role="button" tabindex="0" onclick="window.openMatchRequestModal('${slot.slotId}')" onkeydown="window.matchCardKeyDown(event, '${slot.slotId}')">
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

function ensureMatchRequestModal() {
  if (document.getElementById("match-request-modal")) return;

  const modalHTML = `
    <div id="match-request-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card modal-lg">
        <div class="modal-body">
          <div class="peer-summary-header">
            <div id="match-peer-avatar" class="peer-summary-avatar"></div>
            <div class="peer-summary-title">
              <h3 id="match-peer-name"></h3>
              <p id="match-slot-info"></p>
              <div id="match-peer-tags" class="peer-summary-tags"></div>
            </div>
          </div>
          <p class="peer-summary-note">Send a match request. The slot will be marked as matched only after the peer accepts.</p>
          <p id="match-modal-error" class="modal-error" style="display:none;"></p>
        </div>
        <div class="modal-actions">
          <button id="match-cancel-btn" class="btn-secondary">Cancel</button>
          <button id="match-request-btn" class="btn-primary">Request match</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHTML);

  const overlay = document.getElementById("match-request-modal");
  const cancelBtn = document.getElementById("match-cancel-btn");
  const requestBtn = document.getElementById("match-request-btn");

  cancelBtn.addEventListener("click", closeMatchRequestModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeMatchRequestModal();
  });

  requestBtn.addEventListener("click", handleMatchRequest);
}

function getAvatarInitial(name) {
  const firstName = (name || "Peer").split(" ")[0];
  return (firstName[0] || "P").toUpperCase();
}

function openMatchRequestModalForSlot(slotId) {
  const slot = allSlots.find((s) => s.slotId === slotId);
  if (!slot) return;

  selectedSlot = slot;
  selectedPeer = {
    uid: slot.uid,
    name: slot.name,
    subjects: slot.subjects || []
  };

  ensureMatchRequestModal();

  const overlay = document.getElementById("match-request-modal");
  const avatar = document.getElementById("match-peer-avatar");
  const nameEl = document.getElementById("match-peer-name");
  const infoEl = document.getElementById("match-slot-info");
  const tagsEl = document.getElementById("match-peer-tags");
  const errorEl = document.getElementById("match-modal-error");
  const requestBtn = document.getElementById("match-request-btn");

  const initial = getAvatarInitial(selectedPeer.name);
  avatar.textContent = initial;
  avatar.style.background = getAvatarColor(initial);

  nameEl.textContent = selectedPeer.name || "Peer";
  const timeText = (slot.startTime && slot.endTime)
    ? `${formatTimeDisplay(slot.startTime)} – ${formatTimeDisplay(slot.endTime)}`
    : "";
  infoEl.textContent = `Slot: ${slot.day}${timeText ? ` · ${timeText}` : ""}`;

  tagsEl.innerHTML = (selectedPeer.subjects || []).map((s) => `<span class="slot-tag">${s}</span>`).join("");

  errorEl.style.display = "none";
  errorEl.textContent = "";
  requestBtn.disabled = false;
  requestBtn.textContent = "Request match";

  overlay.style.display = "flex";
}

function closeMatchRequestModal() {
  const overlay = document.getElementById("match-request-modal");
  if (overlay) overlay.style.display = "none";
  selectedSlot = null;
  selectedPeer = null;
}

async function handleMatchRequest() {
  const errorEl = document.getElementById("match-modal-error");
  const requestBtn = document.getElementById("match-request-btn");

  if (!selectedSlot || !selectedPeer || !currentUid) return;

  try {
    requestBtn.disabled = true;
    requestBtn.textContent = "Sending...";
    errorEl.style.display = "none";
    errorEl.textContent = "";

    const docRef = await addDoc(collection(db, "matchRequests"), {
      slotId: selectedSlot.slotId,
      slotOwnerId: selectedPeer.uid,
      requesterId: currentUid,
      status: "pending",
      slotSnapshot: {
        day: selectedSlot.day,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        duration: selectedSlot.duration ?? null
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Send real-time notification to the slot owner
    try {
      const userSnap = await getDoc(doc(db, "users", currentUid));
      const senderName = userSnap.exists() ? (userSnap.data().name || "A peer") : "A peer";
      const subject = selectedSlot.subjects && selectedSlot.subjects.length > 0 ? selectedSlot.subjects[0] : "General Help";
      
      await sendMatchRequestNotification(
        selectedPeer.uid, 
        senderName, 
        subject, 
        docRef.id
      );
    } catch (notiErr) {
      console.error("Match notification failed:", notiErr);
    }

    closeMatchRequestModal();
    alert("Match request sent!");
  } catch (err) {
    console.error("Failed to create match request:", err);
    errorEl.textContent = err?.message || "Failed to send match request";
    errorEl.style.display = "block";
    requestBtn.disabled = false;
    requestBtn.textContent = "Request match";
  }
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
  
  // Setup notifications and other UI systems
  setupNotifications();
  setupAvatarDropdown();

  // Set avatar info
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();
      const firstName = (data.name || "Peer").split(" ")[0];
      const letter = firstName[0].toUpperCase();
      const avatarEl = document.getElementById("avatar");
      if (avatarEl) {
        avatarEl.innerText = letter;
        avatarEl.style.background = getAvatarColor(letter);
      }
    }
  } catch (err) {
    console.error("Error fetching user data:", err);
  }

  // Fetch and render slots
  try {
    allSlots = await fetchSlots();
    renderSlots(allSlots);
  } catch (err) {
    console.error("Error fetching slots:", err);
    const container = document.getElementById("slots-container");
    if (container) container.innerHTML = '<div class="error-state">Failed to load requests. Please try again later.</div>';
  }

  // Bind filter buttons
  const applyBtn = document.getElementById("apply-filters");
  const clearBtn = document.getElementById("clear-filters");
  if (applyBtn) applyBtn.addEventListener("click", applyFilters);
  if (clearBtn) clearBtn.addEventListener("click", clearFilters);
});

// Refactored Avatar Dropdown Logic
function setupAvatarDropdown() {
  const avatar = document.getElementById("avatar");
  const avatarDropdown = document.getElementById("avatarDropdown");

  if (!avatar || !avatarDropdown) return;

  // Toggle dropdown
  avatar.onclick = (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle("show");
  };

  // Close when clicking outside
  document.addEventListener("click", (e) => {
    if (!avatar.contains(e.target) && !avatarDropdown.contains(e.target)) {
      avatarDropdown.classList.remove("show");
    }
  });

  // Dropdown actions
  avatarDropdown.onclick = async (e) => {
    const item = e.target.closest(".avatar-dropdown-item");
    if (!item) return;

    avatarDropdown.classList.remove("show");
    const action = item.dataset.action;

    if (action === "profile") window.location.href = "profile.html";
    else if (action === "settings") window.location.href = "settings.html";
    else if (action === "logout") {
      await auth.signOut();
      window.location.href = "login.html";
    }
  };
}

window.openMatchRequestModal = function (slotId) {
  openMatchRequestModalForSlot(slotId);
};

window.matchCardKeyDown = function (e, slotId) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openMatchRequestModalForSlot(slotId);
  }
};
