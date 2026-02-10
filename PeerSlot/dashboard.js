import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { SLOT_STATUS, formatTimeDisplay } from "./availability.js";

function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Failed to log out. Please try again.");
  }
}

function getAvatarInitial(name) {
  const firstName = (name || "Peer").split(" ")[0];
  return (firstName[0] || "P").toUpperCase();
}

async function loadIncomingMatchRequests(userId) {
  const listEl = document.getElementById("match-requests-list");
  if (!listEl) return;

  try {
    const q = query(
      collection(db, "matchRequests"),
      where("slotOwnerId", "==", userId),
      where("status", "==", "pending")
    );

    const snap = await getDocs(q);
    const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (requests.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>No incoming requests</p>
          <p class="hint">When someone requests one of your slots, it will show up here.</p>
        </div>
      `;
      return;
    }

    const requesterIds = Array.from(new Set(requests.map((r) => r.requesterId).filter(Boolean)));
    const requesterEntries = await Promise.all(
      requesterIds.map(async (uid) => {
        const u = await getDoc(doc(db, "users", uid));
        const data = u.exists() ? u.data() : {};
        return [uid, { name: data.name || "Unknown" }];
      })
    );
    const requesterById = Object.fromEntries(requesterEntries);

    listEl.innerHTML = requests.map((r) => {
      const requester = requesterById[r.requesterId] || { name: "Unknown" };
      const initial = getAvatarInitial(requester.name);
      const timeText = (r.slotSnapshot?.startTime && r.slotSnapshot?.endTime)
        ? `${formatTimeDisplay(r.slotSnapshot.startTime)} – ${formatTimeDisplay(r.slotSnapshot.endTime)}`
        : "";

      return `
        <div class="slot slot-available" data-request-id="${r.id}">
          <div class="slot-time">
            <span class="time-range">${requester.name}</span>
            <span class="status-badge available">Request</span>
          </div>
          <div class="slot-actions">
            <button class="btn-primary" onclick="window.acceptMatchRequest('${r.id}')">Accept</button>
          </div>
        </div>
        <div style="margin: 8px 0 14px; color:#64748b; font-size:13px;">
          Slot: ${r.slotSnapshot?.day || ""}${timeText ? ` · ${timeText}` : ""}
        </div>
      `;
    }).join("");

    lucide.createIcons();
  } catch (err) {
    console.error("Failed to load incoming match requests:", err);
    listEl.innerHTML = `
      <div class="empty-state">
        <p>Failed to load requests</p>
        <p class="hint">${err?.message || "Unknown error"}</p>
      </div>
    `;
  }
}

async function acceptMatchRequestById(requestId) {
  if (!requestId) return;

  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, "matchRequests", requestId);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error("Request not found");
    }

    const req = reqSnap.data();
    if (req.status !== "pending") {
      throw new Error("Request is no longer pending");
    }

    if (!req.slotId) {
      throw new Error("Request missing slot");
    }

    const slotRef = doc(db, "availabilitySlots", req.slotId);
    const slotSnap = await tx.get(slotRef);
    if (!slotSnap.exists()) {
      throw new Error("Slot not found");
    }

    const slot = slotSnap.data();
    if (slot.status !== SLOT_STATUS.AVAILABLE) {
      throw new Error("Slot is no longer available");
    }

    tx.update(slotRef, {
      status: SLOT_STATUS.MATCHED,
      updatedAt: serverTimestamp()
    });

    tx.update(reqRef, {
      status: "accepted",
      updatedAt: serverTimestamp()
    });
  });
}


/* ===== DOM Ready ===== */

document.addEventListener("DOMContentLoaded", () => {
  const avatar = document.getElementById("avatar");
  const avatarDropdown = document.getElementById("avatarDropdown");
  const firstNameSpan = document.getElementById("firstName");


  if (!avatar || !avatarDropdown) return;

  /* ===== Auth + User Data ===== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    window.location.href = "setup.html";
    return;
  }

  const data = snap.data();
  const fullName = data.name || "User";
  const firstName = fullName.split(" ")[0] || "U";

  // Welcome text
  if (firstNameSpan) {
    firstNameSpan.innerText = firstName;
  }

  // Avatar
  const letter = firstName.charAt(0).toUpperCase();
  avatar.innerText = letter;
  avatar.style.background = getAvatarColor(letter);

  // Load incoming match requests
  await loadIncomingMatchRequests(user.uid);

  // Find Peer button navigation
  const findPeerBtn = document.getElementById("find-peer-btn");
  if (findPeerBtn) {
    findPeerBtn.addEventListener("click", () => {
      window.location.href = "find-peer.html";
    });
  }
});


  /* ===== Avatar Dropdown Toggle ===== */

  avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    avatarDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!avatar.contains(e.target) && !avatarDropdown.contains(e.target)) {
      avatarDropdown.classList.remove("show");
    }
  });

  /* ===== Dropdown Actions ===== */

  avatarDropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".avatar-dropdown-item");
    if (!item) return;

    const action = item.dataset.action;
    avatarDropdown.classList.remove("show");

    switch (action) {
      case "profile":
        window.location.href = "profile.html";
        break;

      case "settings":
        window.location.href = "settings.html";
        break;

      case "logout":
        handleLogout();
        break;
    }
  });
});

window.acceptMatchRequest = async function (requestId) {
  try {
    await acceptMatchRequestById(requestId);
    alert("Match request accepted");
    const user = auth.currentUser;
    if (user) {
      await loadIncomingMatchRequests(user.uid);
    }
  } catch (err) {
    console.error("Failed to accept match request:", err);
    alert(err?.message || "Failed to accept match request");
  }
};
