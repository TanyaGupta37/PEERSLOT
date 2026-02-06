/**
 * ============================================
 * PEERSLOT - PEER AVAILABILITY VIEWER
 * ============================================
 * Read-only view of peer's available slots
 */

import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    DAYS,
    SLOT_STATUS,
    formatTimeDisplay,
    getShortDay,
    fetchPeerAvailability
} from "./availability.js";

// ============================================
// STATE
// ============================================

let currentPeerId = null;
let peerSlots = [];
let peerInfo = null;

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    modal: null,
    peerName: null,
    peerAvatar: null,
    slotsList: null,
    closeBtn: null,
    loadingSpinner: null
};

// ============================================
// INITIALIZATION
// ============================================

export function initPeerAvailabilityViewer() {
    createPeerModal();
}

function createPeerModal() {
    const modalHTML = `
    <div id="peer-availability-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card modal-lg">
        <div class="modal-header">
          <div class="peer-header">
            <div id="peer-modal-avatar" class="peer-avatar"></div>
            <div class="peer-header-info">
              <h3 id="peer-modal-name">Peer Availability</h3>
              <p id="peer-modal-subjects" class="peer-subjects"></p>
            </div>
          </div>
          <button id="peer-modal-close" class="btn-close">×</button>
        </div>
        <div class="modal-body">
          <div id="peer-slots-loading" class="loading-state" style="display: none;">
            <div class="spinner"></div>
            <p>Loading availability...</p>
          </div>
          <div id="peer-slots-list" class="peer-slots-container"></div>
        </div>
        <div class="modal-footer">
          <p class="hint">Select a time slot to book a session</p>
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    // Cache elements
    elements.modal = document.getElementById("peer-availability-modal");
    elements.peerName = document.getElementById("peer-modal-name");
    elements.peerAvatar = document.getElementById("peer-modal-avatar");
    elements.peerSubjects = document.getElementById("peer-modal-subjects");
    elements.slotsList = document.getElementById("peer-slots-list");
    elements.closeBtn = document.getElementById("peer-modal-close");
    elements.loadingSpinner = document.getElementById("peer-slots-loading");

    // Event listeners
    elements.closeBtn.addEventListener("click", closePeerModal);
    elements.modal.addEventListener("click", (e) => {
        if (e.target === elements.modal) closePeerModal();
    });
}

// ============================================
// OPEN/CLOSE MODAL
// ============================================

export async function openPeerAvailability(peerId) {
    if (!peerId) return;

    currentPeerId = peerId;

    // Show modal with loading state
    elements.modal.style.display = "flex";
    elements.loadingSpinner.style.display = "flex";
    elements.slotsList.innerHTML = "";

    try {
        // Fetch peer info
        const peerDoc = await getDoc(doc(db, "users", peerId));
        if (peerDoc.exists()) {
            peerInfo = peerDoc.data();
            renderPeerHeader();
        }

        // Fetch peer's available slots
        peerSlots = await fetchPeerAvailability(peerId);
        renderPeerSlots();
    } catch (err) {
        console.error("Error loading peer availability:", err);
        elements.slotsList.innerHTML = `
      <div class="error-state">
        <p>Failed to load availability</p>
        <p class="hint">${err.message}</p>
      </div>
    `;
    } finally {
        elements.loadingSpinner.style.display = "none";
    }
}

function closePeerModal() {
    elements.modal.style.display = "none";
    currentPeerId = null;
    peerSlots = [];
    peerInfo = null;
}

// ============================================
// RENDER
// ============================================

function renderPeerHeader() {
    if (!peerInfo) return;

    const firstName = peerInfo.name?.split(" ")[0] || "Peer";
    const initial = firstName[0].toUpperCase();

    elements.peerName.textContent = `${peerInfo.name}'s Availability`;
    elements.peerAvatar.textContent = initial;
    elements.peerAvatar.style.background = getAvatarColor(initial);

    if (peerInfo.subjects && peerInfo.subjects.length > 0) {
        elements.peerSubjects.textContent = peerInfo.subjects.join(" · ");
    } else {
        elements.peerSubjects.textContent = "";
    }
}

function renderPeerSlots() {
    if (peerSlots.length === 0) {
        elements.slotsList.innerHTML = `
      <div class="empty-state">
        <p>No available slots</p>
        <p class="hint">This peer hasn't set any availability yet</p>
      </div>
    `;
        return;
    }

    // Group by day
    const slotsByDay = {};
    DAYS.forEach(day => {
        const daySlots = peerSlots.filter(s => s.day === day && s.status === SLOT_STATUS.AVAILABLE);
        if (daySlots.length > 0) {
            slotsByDay[day] = daySlots;
        }
    });

    let html = "";

    for (const [day, slots] of Object.entries(slotsByDay)) {
        html += `
      <div class="peer-day-group">
        <div class="peer-day-label">${day}</div>
        <div class="peer-day-slots">
    `;

        for (const slot of slots) {
            html += `
        <button class="peer-slot-btn" onclick="window.selectPeerSlot('${slot.id}', '${currentPeerId}')">
          <span class="slot-time">${formatTimeDisplay(slot.startTime)} – ${formatTimeDisplay(slot.endTime)}</span>
          <span class="slot-duration">${slot.duration} min</span>
        </button>
      `;
        }

        html += `</div></div>`;
    }

    elements.slotsList.innerHTML = html;
}

// ============================================
// SLOT SELECTION (for booking)
// ============================================

window.selectPeerSlot = function (slotId, peerId) {
    // This would integrate with a booking system
    // For now, show a confirmation message
    const slot = peerSlots.find(s => s.id === slotId);
    if (!slot) return;

    const message = `Book session on ${slot.day} at ${formatTimeDisplay(slot.startTime)} - ${formatTimeDisplay(slot.endTime)}?`;

    if (confirm(message)) {
        // TODO: Integrate with booking system
        alert("Booking feature coming soon! The slot has been noted.");
        closePeerModal();
    }
};

// ============================================
// UTILITY
// ============================================

function getAvatarColor(letter) {
    const colors = [
        "#2563eb", "#16a34a", "#db2777",
        "#9333ea", "#ea580c", "#0d9488"
    ];
    return colors[letter.charCodeAt(0) % colors.length];
}

// ============================================
// GLOBAL ACCESS
// ============================================

window.openPeerAvailability = openPeerAvailability;

export { closePeerModal, peerSlots };
