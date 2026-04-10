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
  where,
  onSnapshot,
  orderBy,
  addDoc,
  updateDoc,
  writeBatch,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setupNotifications } from "./notifications.js";

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

/* ================= CHAT FEATURE ================= */
let currentChatUser = null;
let currentChatSession = null;
let pendingRatingSession = null;
let allPartners = new Map();
let currentUserId = null;
const highlightedChatPartners = new Set();

function markChatHighlighted(partnerId) {
  if (!partnerId || partnerId === currentUserId) return;
  highlightedChatPartners.add(partnerId);
  renderChatList(Array.from(allPartners.entries()), currentUserId);
}

function clearChatHighlight(partnerId) {
  if (!partnerId) return;
  highlightedChatPartners.delete(partnerId);
  renderChatList(Array.from(allPartners.entries()), currentUserId);
}

window.markChatHighlighted = markChatHighlighted;
window.clearChatHighlight = clearChatHighlight;

window.setCurrentChatUser = (partnerId) => {
  currentChatUser = partnerId;
};
window.getCurrentChatUser = () => currentChatUser;

function loadChatList(userId) {
  // Listen for all messages where current user is a participant
  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, async (snapshot) => {
    // Use a Map to keep track of unique chat partners and their latest message
    allPartners.clear();
    
    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const partnerId = msg.participants.find(p => p !== userId);
      
      // Add partner with their latest message (including "Say hi" preview)
      if (partnerId && !allPartners.has(partnerId)) {
        const userSnap = await getDoc(doc(db, "users", partnerId));
        const userData = userSnap.exists() ? userSnap.data() : { name: "Unknown" };
        allPartners.set(partnerId, {
          name: userData.name || "Unknown",
          lastText: msg.text
        });
      }
    }

    // Render the chat list
    renderChatList(Array.from(allPartners.entries()), userId);
  });
}
window.loadChatList = loadChatList;

window.sendMessage = async () => {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  const user = auth.currentUser;
  if (!text || !currentChatUser || !user) return;

  try {
    // Optimistically add message to UI immediately
    const messagesDiv = document.getElementById("messages");
    if (messagesDiv) {
      const div = document.createElement("div");
      div.className = "chat-message own";
      const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      div.innerHTML = `
        <div class="message-text">${text}</div>
        <div class="message-time">${timeString}</div>
      `;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    if (currentChatSession?.data?.status === "booked") {
      await startSession(currentChatSession);
    }

    // Send to Firestore
    await addDoc(collection(db, "messages"), {
      text,
      senderId: user.uid,
      participants: [user.uid, currentChatUser],
      createdAt: new Date()
    });
    input.value = "";
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

function renderChatList(partners, userId) {
  const chatList = document.getElementById("chat-list");
  if (!chatList) return;
  
  chatList.innerHTML = "";
  
  if (partners.length === 0) {
    chatList.innerHTML = '<div style="text-align:center;margin-top:20px;opacity:0.6;">No chats yet 😴</div>';
    return;
  }
  
  partners.forEach(([partnerId, data]) => {
    const div = document.createElement("div");
    const isHighlighted = highlightedChatPartners.has(partnerId);
    div.dataset.partnerId = partnerId;
    div.className = "chat-partner-item" + (currentChatUser === partnerId ? " active" : "") + (isHighlighted ? " highlighted" : "");
    div.innerHTML = `
      <div class="partner-name">${data.name}</div>
      <div class="partner-preview">${data.lastText}</div>
    `;

    div.onclick = () => {
      currentChatUser = partnerId;
      renderChatList(Array.from(allPartners.entries()), userId);
      openChat(partnerId, userId);
    };
    chatList.appendChild(div);
  });
}

async function getChatSession(partnerId, userId) {
  const sessions = [];
  const queries = [
    query(collection(db, "matchRequests"), where("requesterId", "==", userId)),
    query(collection(db, "matchRequests"), where("slotOwnerId", "==", userId))
  ];

  const snapshots = await Promise.all(queries.map(q => getDocs(q)));
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const isMatch = (data.requesterId === userId && data.slotOwnerId === partnerId) ||
                      (data.requesterId === partnerId && data.slotOwnerId === userId);
      if (isMatch) {
        sessions.push({ id: docSnap.id, data, ref: docSnap.ref });
      }
    });
  });

  if (sessions.length === 0) return null;

  sessions.sort((a, b) => {
    const aTime = a.data.updatedAt?.toMillis?.() || 0;
    const bTime = b.data.updatedAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return sessions[0];
}

function formatSessionStatusLabel(status) {
  switch (status) {
    case "pending": return "Pending";
    case "accepted": return "Accepted";
    case "booked": return "Booked";
    case "in_progress": return "In progress";
    case "completed": return "Completed";
    default: return status ? status.replace(/_/g, " ") : "Session";
  }
}

function isSessionExpired(sessionInfo) {
  if (!sessionInfo || !sessionInfo.data.expiresAt) return false;
  return sessionInfo.data.expiresAt.toMillis() <= Date.now();
}

function renderChatHeader(partnerId, sessionInfo) {
  const headerDiv = document.getElementById("chat-header");
  if (!headerDiv) return;

  const partner = allPartners.get(partnerId);
  const partnerName = partner?.name || "Peer";
  const status = sessionInfo?.data?.status;
  const expired = isSessionExpired(sessionInfo);

  const statusBadge = status ? `<span class="chat-status-badge ${status}">${formatSessionStatusLabel(status)}</span>` : "";
  const canStart = status === "booked" || status === "accepted";
  const actionButton = !expired && sessionInfo && canStart
    ? `<button id="chatSessionAction" class="session-action-btn">Start session</button>`
    : !expired && sessionInfo && status === "in_progress"
      ? `<button id="chatSessionAction" class="session-action-btn end-session">End session</button>`
      : "";

  headerDiv.innerHTML = `
    <div class="chat-header-content">
      <div>
        <div class="chat-partner-title">${partnerName}</div>
        ${statusBadge}
      </div>
      <div class="chat-header-actions">${actionButton}</div>
    </div>
  `;

  const actionBtn = document.getElementById("chatSessionAction");
  if (actionBtn) {
    actionBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!sessionInfo) return;
      if (sessionInfo.data.status === "booked" || sessionInfo.data.status === "accepted") {
        await startSession(sessionInfo);
      } else if (sessionInfo.data.status === "in_progress") {
        await endSession(sessionInfo);
      }
    };
  }

  updateChatInputState(sessionInfo);
}

function updateChatInputState(sessionInfo) {
  const input = document.getElementById("chatInput");
  const sendButton = document.querySelector(".chat-input button");
  if (!input || !sendButton) return;

  if (sessionInfo && sessionInfo.data.status === "completed") {
    input.disabled = true;
    sendButton.disabled = true;
    input.placeholder = "This session is completed. Chat will archive after 24 hours.";
  } else if (sessionInfo && isSessionExpired(sessionInfo)) {
    input.disabled = true;
    sendButton.disabled = true;
    input.placeholder = "This session was archived after 24 hours.";
  } else {
    input.disabled = false;
    sendButton.disabled = false;
    input.placeholder = "Type a message...";
  }
}

async function startSession(sessionInfo) {
  try {
    await updateDoc(sessionInfo.ref, {
      status: "in_progress",
      updatedAt: serverTimestamp(),
      startedAt: serverTimestamp()
    });
    currentChatSession = await getChatSession(currentChatUser, auth.currentUser.uid);
    renderChatHeader(currentChatUser, currentChatSession);
  } catch (error) {
    console.error("Error starting session:", error);
    alert("Unable to start the session right now.");
  }
}

async function completeSession(sessionInfo, rating = null) {
  try {
    const payload = {
      status: "completed",
      updatedAt: serverTimestamp(),
      completedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
    };

    if (rating !== null) {
      payload.rating = rating;
      payload.ratingGivenBy = auth.currentUser?.uid || null;
      payload.ratingGivenAt = serverTimestamp();

      const helperId = sessionInfo.data.slotOwnerId;
      const helperRef = doc(db, "users", helperId);

      await runTransaction(db, async (tx) => {
        const helperSnap = await tx.get(helperRef);
        if (!helperSnap.exists()) {
          throw new Error("Helper profile not found");
        }

        const helperData = helperSnap.data();
        const currentSum = helperData.ratingSum || 0;
        const currentCount = helperData.ratingCount || 0;
        const currentHelped = helperData.helpedCount || 0;
        const nextCount = currentCount + 1;
        const nextSum = currentSum + rating;

        tx.update(helperRef, {
          ratingSum: nextSum,
          ratingCount: nextCount,
          averageRating: Number((nextSum / nextCount).toFixed(1)),
          helpedCount: currentHelped + 1
        });

        tx.update(sessionInfo.ref, payload);
      });
    } else {
      await updateDoc(sessionInfo.ref, payload);
    }

    if (rating !== null) {
      await deleteChatHistory(auth.currentUser.uid, currentChatUser);
      highlightedChatPartners.delete(currentChatUser);
      renderChatList(Array.from(allPartners.entries()), currentUserId);
    }

    currentChatSession = await getChatSession(currentChatUser, auth.currentUser.uid);
    renderChatHeader(currentChatUser, currentChatSession);

    if (rating !== null) {
      hideRatingModal();
      pendingRatingSession = null;
    }
  } catch (error) {
    console.error("Error completing session:", error);
    alert("Unable to complete the session right now.");
  }
}

async function deleteChatHistory(userId, partnerId) {
  if (!userId || !partnerId) return;

  const q = query(
    collection(db, "messages"),
    where("participants", "array-contains", userId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  let batch = writeBatch(db);
  let ops = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.participants?.includes(partnerId)) {
      batch.delete(doc(db, "messages", docSnap.id));
      ops += 1;
    }

    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }
}

async function endSession(sessionInfo) {
  const user = auth.currentUser;
  if (!user) return;

  const isRequester = sessionInfo.data.requesterId === user.uid;
  if (isRequester) {
    pendingRatingSession = sessionInfo;
    showRatingModal();
    return;
  }

  await completeSession(sessionInfo);
}

function showRatingModal() {
  const overlay = document.getElementById("rating-modal-overlay");
  const feedback = document.getElementById("rating-feedback");
  const partnerName = allPartners.get(currentChatUser)?.name || "your helper";
  const modalText = document.getElementById("rating-modal-text");

  if (modalText) {
    modalText.textContent = `Rate ${partnerName} out of 5 stars.`;
  }
  if (feedback) {
    feedback.textContent = "Click a star to set your rating.";
  }
  if (overlay) {
    overlay.style.display = "flex";
  }
}

function hideRatingModal() {
  const overlay = document.getElementById("rating-modal-overlay");
  const stars = document.querySelectorAll(".star-btn");
  if (overlay) {
    overlay.style.display = "none";
  }
  stars.forEach((star) => {
    star.classList.remove("selected", "hovered");
  });
  overlaySelectedRating = 0;
}

function formatAvgRating(ratingSum = 0, ratingCount = 0) {
  if (!ratingCount) return "0.0 / 5";
  return `${(ratingSum / ratingCount).toFixed(1)} / 5`;
}

function updateUserDashboardStats(userData, sessionsBooked = 0) {
  const ratingEl = document.getElementById("userRating");
  const helpedEl = document.getElementById("userHelped");
  const sessionsEl = document.getElementById("sessionsBooked");

  if (ratingEl) {
    ratingEl.textContent = formatAvgRating(userData.ratingSum || 0, userData.ratingCount || 0);
  }
  if (helpedEl) {
    helpedEl.textContent = `Peers helped: ${userData.helpedCount || 0}`;
  }
  if (sessionsEl) {
    sessionsEl.textContent = `Sessions booked: ${sessionsBooked}`;
  }
}

async function getSessionsBookedCount(userId) {
  const requesterDocs = await getDocs(query(collection(db, "matchRequests"), where("requesterId", "==", userId)));
  const ownerDocs = await getDocs(query(collection(db, "matchRequests"), where("slotOwnerId", "==", userId)));
  const unique = new Map();

  [...requesterDocs.docs, ...ownerDocs.docs].forEach((docSnap) => {
    const data = docSnap.data();
    if (["booked", "accepted", "in_progress", "completed"].includes(data.status)) {
      unique.set(docSnap.id, true);
    }
  });

  return unique.size;
}

let overlaySelectedRating = 0;

function setRating(value) {
  const stars = document.querySelectorAll(".star-btn");
  const feedback = document.getElementById("rating-feedback");

  stars.forEach((star) => {
    const score = Number(star.dataset.value);
    star.classList.toggle("selected", score <= value);
  });

  if (feedback) {
    feedback.textContent = value > 0
      ? `You selected ${value} star${value > 1 ? "s" : ""}.`
      : "Click a star to set your rating.";
  }
  overlaySelectedRating = value;
}

async function submitRating() {
  if (!pendingRatingSession) return;
  if (!overlaySelectedRating) {
    alert("Please select a star rating before submitting.");
    return;
  }
  await completeSession(pendingRatingSession, overlaySelectedRating);
}

async function openChat(partnerId, userId) {
  const messagesDiv = document.getElementById("messages");
  const headerDiv = document.getElementById("chat-header");
  if (!messagesDiv || !headerDiv) return;

  currentChatUser = partnerId;
  clearChatHighlight(partnerId);
  currentChatSession = await getChatSession(partnerId, userId);
  renderChatHeader(partnerId, currentChatSession);

  const q = query(
    collection(db, "messages"), 
    where("participants", "array-contains", userId),
    orderBy("createdAt", "asc")
  );

  onSnapshot(q, (snapshot) => {
    messagesDiv.innerHTML = "";
    
    const relevantMsgs = snapshot.docs
      .map(d => d.data())
      .filter(m =>
        m.participants.includes(partnerId) &&
        m.participants.includes(userId) &&
        m.type !== "system_intro"
    );

    relevantMsgs.forEach(msg => {
      const div = document.createElement("div");
      div.className = `chat-message ${msg.senderId === userId ? 'own' : ''}`;
      
      const timestamp = msg.createdAt ? new Date(msg.createdAt.seconds * 1000) : new Date();
      const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      div.innerHTML = `
        <div class="message-text">${msg.text}</div>
        <div class="message-time">${timeString}</div>
      `;
      messagesDiv.appendChild(div);
    });
    
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

window.openChat = openChat;

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

    if (firstNameSpan) {
      firstNameSpan.innerText = firstName;
    }

    const letter = firstName.charAt(0).toUpperCase();
    avatar.innerText = letter;
    avatar.style.background = getAvatarColor(letter);

    setupNotifications();
    const sessionsBookedCount = await getSessionsBookedCount(user.uid);
    updateUserDashboardStats(data, sessionsBookedCount);
    
    // Setup chat search listener
    const chatSearch = document.getElementById("chatSearch");
    if (chatSearch) {
      chatSearch.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = Array.from(allPartners.entries()).filter(([partnerId, data]) => {
          return data.name.toLowerCase().includes(query);
        });
        renderChatList(filtered, user.uid);
      });
    }
    
    currentUserId = user.uid;
    loadChatList(user.uid);
    // Setup enter key to send message
    const chatInput = document.getElementById("chatInput");
    if (chatInput) {
      chatInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          sendMessage();
        }
      });
    }
  });

  const starButtons = document.querySelectorAll(".star-btn");
  starButtons.forEach((button) => {
    const value = Number(button.dataset.value);
    button.addEventListener("mouseenter", () => {
      button.classList.add("hovered");
      setRating(value);
    });
    button.addEventListener("mouseleave", () => {
      setRating(overlaySelectedRating);
    });
    button.addEventListener("click", () => {
      setRating(value);
    });
  });

  const ratingSubmit = document.getElementById("rating-submit");
  const ratingCancel = document.getElementById("rating-cancel");
  const ratingClose = document.getElementById("rating-modal-close");

  if (ratingSubmit) {
    ratingSubmit.addEventListener("click", submitRating);
  }
  if (ratingCancel) {
    ratingCancel.addEventListener("click", () => {
      pendingRatingSession = null;
      overlaySelectedRating = 0;
      hideRatingModal();
    });
  }
  if (ratingClose) {
    ratingClose.addEventListener("click", () => {
      pendingRatingSession = null;
      overlaySelectedRating = 0;
      hideRatingModal();
    });
  }

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