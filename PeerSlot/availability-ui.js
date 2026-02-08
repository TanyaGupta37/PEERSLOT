/**
 * ============================================
 * PEERSLOT - AVAILABILITY UI CONTROLLER
 * ============================================
 * Handles all UI interactions for availability slots
 */

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    DAYS,
    TIME_SLOTS,
    BUSINESS_RULES,
    SLOT_STATUS,
    formatTimeDisplay,
    getShortDay,
    createSlot,
    fetchOwnSlotsSorted,
    updateSlot,
    deleteSlot,
    getSlotCount
} from "./availability.js";

// ============================================
// STATE
// ============================================

let currentSlots = [];
let editingSlotId = null;
let isLoading = false;

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    daySelect: null,
    startTimeSelect: null,
    endTimeSelect: null,
    addSlotBtn: null,
    slotsList: null,
    slotsCount: null,
    errorMessage: null,
    editModal: null,
    editDaySelect: null,
    editStartTimeSelect: null,
    editEndTimeSelect: null,
    editSaveBtn: null,
    editCancelBtn: null,
    deleteModal: null,
    deleteConfirmBtn: null,
    deleteCancelBtn: null,
    toastContainer: null
};

// ============================================
// INITIALIZATION
// ============================================

export function initAvailabilityUI() {
    // Wait for auth state
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        // Cache DOM elements
        cacheElements();

        // Setup UI
        setupDaySelects();
        setupTimeSelects();
        setupEventListeners();
        createModals();
        createToastContainer();

        // Load initial data
        await loadSlots();
    });
}

function cacheElements() {
    elements.daySelect = document.getElementById("slot-day");
    elements.startTimeSelect = document.getElementById("slot-start-time");
    elements.endTimeSelect = document.getElementById("slot-end-time");
    elements.addSlotBtn = document.getElementById("add-slot-btn");
    elements.slotsList = document.getElementById("slots-list");
    elements.slotsCount = document.getElementById("slots-count");
    elements.errorMessage = document.getElementById("slot-error");
}

// ============================================
// POPULATE SELECTS
// ============================================

function setupDaySelects() {
    const dayOptions = `<option value="">Select Day</option>` +
        DAYS.map(day => `<option value="${day}">${day}</option>`).join("");

    if (elements.daySelect) {
        elements.daySelect.innerHTML = dayOptions;
    }
}

function setupTimeSelects() {
    const timeOptions = `<option value="">Select Time</option>` +
        TIME_SLOTS.map(time => `<option value="${time}">${formatTimeDisplay(time)}</option>`).join("");

    if (elements.startTimeSelect) {
        elements.startTimeSelect.innerHTML = timeOptions;
    }
    if (elements.endTimeSelect) {
        elements.endTimeSelect.innerHTML = timeOptions;
    }
}

function populateEditSelects() {
    const dayOptions = DAYS.map(day => `<option value="${day}">${day}</option>`).join("");
    const timeOptions = TIME_SLOTS.map(time => `<option value="${time}">${formatTimeDisplay(time)}</option>`).join("");

    if (elements.editDaySelect) {
        elements.editDaySelect.innerHTML = dayOptions;
    }
    if (elements.editStartTimeSelect) {
        elements.editStartTimeSelect.innerHTML = timeOptions;
    }
    if (elements.editEndTimeSelect) {
        elements.editEndTimeSelect.innerHTML = timeOptions;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Add slot button
    if (elements.addSlotBtn) {
        elements.addSlotBtn.addEventListener("click", handleAddSlot);
    }

    // Auto-set end time when start time is selected
    if (elements.startTimeSelect) {
        elements.startTimeSelect.addEventListener("change", () => {
            const startTime = elements.startTimeSelect.value;
            if (startTime && elements.endTimeSelect) {
                // Set default end time to 1 hour after start
                const startIndex = TIME_SLOTS.indexOf(startTime);
                const defaultEndIndex = Math.min(startIndex + 2, TIME_SLOTS.length - 1);
                elements.endTimeSelect.value = TIME_SLOTS[defaultEndIndex];
            }
        });
    }
}

// ============================================
// MODALS
// ============================================

function createModals() {
    // Edit Modal
    const editModalHTML = `
    <div id="edit-slot-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <h3>Edit Availability Slot</h3>
        <div class="modal-body">
          <div class="field">
            <label>Day</label>
            <select id="edit-day-select"></select>
          </div>
          <div class="field">
            <label>Start Time</label>
            <select id="edit-start-time"></select>
          </div>
          <div class="field">
            <label>End Time</label>
            <select id="edit-end-time"></select>
          </div>
          <p id="edit-error" class="error-text"></p>
        </div>
        <div class="modal-actions">
          <button id="edit-cancel-btn" class="btn-secondary">Cancel</button>
          <button id="edit-save-btn" class="btn-primary">Save Changes</button>
        </div>
      </div>
    </div>
  `;

    // Delete Confirmation Modal
    const deleteModalHTML = `
    <div id="delete-slot-modal" class="modal-overlay" style="display: none;">
      <div class="modal-card">
        <h3>Delete Slot</h3>
        <div class="modal-body">
          <p>Are you sure you want to delete this availability slot?</p>
          <p id="delete-slot-info" class="slot-info-text"></p>
        </div>
        <div class="modal-actions">
          <button id="delete-cancel-btn" class="btn-secondary">Cancel</button>
          <button id="delete-confirm-btn" class="btn-danger">Delete</button>
        </div>
      </div>
    </div>
  `;

    // Append modals to body
    document.body.insertAdjacentHTML("beforeend", editModalHTML);
    document.body.insertAdjacentHTML("beforeend", deleteModalHTML);

    // Cache modal elements
    elements.editModal = document.getElementById("edit-slot-modal");
    elements.editDaySelect = document.getElementById("edit-day-select");
    elements.editStartTimeSelect = document.getElementById("edit-start-time");
    elements.editEndTimeSelect = document.getElementById("edit-end-time");
    elements.editSaveBtn = document.getElementById("edit-save-btn");
    elements.editCancelBtn = document.getElementById("edit-cancel-btn");
    elements.editError = document.getElementById("edit-error");

    elements.deleteModal = document.getElementById("delete-slot-modal");
    elements.deleteSlotInfo = document.getElementById("delete-slot-info");
    elements.deleteConfirmBtn = document.getElementById("delete-confirm-btn");
    elements.deleteCancelBtn = document.getElementById("delete-cancel-btn");

    // Populate edit selects
    populateEditSelects();

    // Setup modal event listeners
    elements.editCancelBtn.addEventListener("click", closeEditModal);
    elements.editSaveBtn.addEventListener("click", handleSaveEdit);
    elements.deleteCancelBtn.addEventListener("click", closeDeleteModal);
    elements.deleteConfirmBtn.addEventListener("click", handleConfirmDelete);

    // Close modals on overlay click
    elements.editModal.addEventListener("click", (e) => {
        if (e.target === elements.editModal) closeEditModal();
    });
    elements.deleteModal.addEventListener("click", (e) => {
        if (e.target === elements.deleteModal) closeDeleteModal();
    });
}

function createToastContainer() {
    const toastHTML = `<div id="toast-container" class="toast-container"></div>`;
    document.body.insertAdjacentHTML("beforeend", toastHTML);
    elements.toastContainer = document.getElementById("toast-container");
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
    <span class="toast-message">${message}</span>
  `;

    elements.toastContainer.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add("show"), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorMessage.style.display = "block";
        setTimeout(() => {
            elements.errorMessage.style.display = "none";
        }, 5000);
    } else {
        showToast(message, "error");
    }
}

// ============================================
// LOAD & RENDER SLOTS
// ============================================

async function loadSlots(notifyCalendar = false) {
    if (isLoading) return;
    isLoading = true;

    try {
        setLoadingState(true);
        currentSlots = await fetchOwnSlotsSorted();
        renderSlots();
        updateSlotCount();

        // Notify calendar of slot changes
        if (notifyCalendar) {
            dispatchSlotsChangedEvent();
        }
    } catch (err) {
        console.error("Error loading slots:", err);
        showToast("Failed to load slots", "error");
    } finally {
        isLoading = false;
        setLoadingState(false);
    }
}

/**
 * Dispatch custom event to notify other components of slot changes
 */
function dispatchSlotsChangedEvent() {
    const event = new CustomEvent('availabilitySlotsChanged', {
        detail: { slots: currentSlots }
    });
    window.dispatchEvent(event);
}

function setLoadingState(loading) {
    if (elements.addSlotBtn) {
        elements.addSlotBtn.disabled = loading;
        elements.addSlotBtn.textContent = loading ? "Loading..." : "Add Slot";
    }
}

function renderSlots() {
    if (!elements.slotsList) return;

    if (currentSlots.length === 0) {
        elements.slotsList.innerHTML = `
      <div class="empty-state">
        <p>No availability slots added yet</p>
        <p class="hint">Add your available time slots so peers can book sessions with you</p>
      </div>
    `;
        return;
    }

    // Group slots by day
    const slotsByDay = {};
    DAYS.forEach(day => {
        const daySlots = currentSlots.filter(s => s.day === day);
        if (daySlots.length > 0) {
            slotsByDay[day] = daySlots;
        }
    });

    let html = "";

    for (const [day, slots] of Object.entries(slotsByDay)) {
        html += `<div class="day-group"><div class="day-label">${getShortDay(day)}</div><div class="day-slots">`;

        for (const slot of slots) {
            const isEditable = slot.status === SLOT_STATUS.AVAILABLE;
            const statusClass = isEditable ? "slot-available" : "slot-booked";
            const statusBadge = slot.status === SLOT_STATUS.BOOKED
                ? '<span class="status-badge booked">Booked</span>'
                : slot.status === SLOT_STATUS.MATCHED
                    ? '<span class="status-badge booked">Matched</span>'
                    : "";

            html += `
        <div class="slot ${statusClass}" data-slot-id="${slot.id}">
          <div class="slot-time">
            <span class="time-range">${formatTimeDisplay(slot.startTime)} – ${formatTimeDisplay(slot.endTime)}</span>
            ${statusBadge}
          </div>
          <div class="slot-actions">
            ${isEditable ? `
              <button class="btn-icon btn-edit" onclick="window.openEditModal('${slot.id}')" title="Edit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="btn-icon btn-delete" onclick="window.openDeleteModal('${slot.id}')" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            ` : `<span class="locked-icon" title="Cannot modify this slot">🔒</span>`}
          </div>
        </div>
      `;
        }

        html += `</div></div>`;
    }

    elements.slotsList.innerHTML = html;
}

function updateSlotCount() {
    if (!elements.slotsCount) return;

    const available = currentSlots.filter(s => s.status === SLOT_STATUS.AVAILABLE).length;
    const booked = currentSlots.filter(s => s.status === SLOT_STATUS.BOOKED).length;
    const total = currentSlots.length;

    elements.slotsCount.innerHTML = `
    <span class="count-item"><strong>${total}</strong> Total</span>
    <span class="count-divider">·</span>
    <span class="count-item available"><strong>${available}</strong> Available</span>
    ${booked > 0 ? `<span class="count-divider">·</span><span class="count-item booked"><strong>${booked}</strong> Booked</span>` : ""}
  `;
}

// ============================================
// ADD SLOT
// ============================================

async function handleAddSlot() {
    if (isLoading) return;

    const day = elements.daySelect?.value;
    const startTime = elements.startTimeSelect?.value;
    const endTime = elements.endTimeSelect?.value;

    // Clear previous error
    if (elements.errorMessage) {
        elements.errorMessage.style.display = "none";
    }

    if (!day || !startTime || !endTime) {
        showError("Please select day, start time, and end time");
        return;
    }

    isLoading = true;
    elements.addSlotBtn.disabled = true;
    elements.addSlotBtn.textContent = "Adding...";

    try {
        await createSlot({ day, startTime, endTime });

        // Clear form
        elements.daySelect.value = "";
        elements.startTimeSelect.value = "";
        elements.endTimeSelect.value = "";

        // Reload slots and notify calendar
        await loadSlots(true);

        showToast("Slot added successfully!", "success");
    } catch (err) {
        console.error("Error adding slot:", err);
        showError(err.message);
    } finally {
        isLoading = false;
        elements.addSlotBtn.disabled = false;
        elements.addSlotBtn.textContent = "Add Slot";
    }
}

// ============================================
// EDIT SLOT
// ============================================

window.openEditModal = function (slotId) {
    const slot = currentSlots.find(s => s.id === slotId);
    if (!slot) return;

    if (slot.status !== SLOT_STATUS.AVAILABLE) {
        showToast("Cannot edit this slot", "error");
        return;
    }

    editingSlotId = slotId;

    // Populate form with current values
    elements.editDaySelect.value = slot.day;
    elements.editStartTimeSelect.value = slot.startTime;
    elements.editEndTimeSelect.value = slot.endTime;
    elements.editError.textContent = "";

    // Show modal
    elements.editModal.style.display = "flex";
};

function closeEditModal() {
    elements.editModal.style.display = "none";
    editingSlotId = null;
}

async function handleSaveEdit() {
    if (!editingSlotId || isLoading) return;

    const day = elements.editDaySelect.value;
    const startTime = elements.editStartTimeSelect.value;
    const endTime = elements.editEndTimeSelect.value;

    isLoading = true;
    elements.editSaveBtn.disabled = true;
    elements.editSaveBtn.textContent = "Saving...";

    try {
        await updateSlot(editingSlotId, { day, startTime, endTime });

        closeEditModal();
        await loadSlots(true);

        showToast("Slot updated successfully!", "success");
    } catch (err) {
        console.error("Error updating slot:", err);
        elements.editError.textContent = err.message;
    } finally {
        isLoading = false;
        elements.editSaveBtn.disabled = false;
        elements.editSaveBtn.textContent = "Save Changes";
    }
}

// ============================================
// DELETE SLOT
// ============================================

let deletingSlotId = null;

window.openDeleteModal = function (slotId) {
    const slot = currentSlots.find(s => s.id === slotId);
    if (!slot) return;

    if (slot.status !== SLOT_STATUS.AVAILABLE) {
        showToast("Cannot delete this slot", "error");
        return;
    }

    deletingSlotId = slotId;

    // Show slot info
    elements.deleteSlotInfo.textContent =
        `${slot.day} · ${formatTimeDisplay(slot.startTime)} – ${formatTimeDisplay(slot.endTime)}`;

    // Show modal
    elements.deleteModal.style.display = "flex";
};

function closeDeleteModal() {
    elements.deleteModal.style.display = "none";
    deletingSlotId = null;
}

async function handleConfirmDelete() {
    if (!deletingSlotId || isLoading) return;

    isLoading = true;
    elements.deleteConfirmBtn.disabled = true;
    elements.deleteConfirmBtn.textContent = "Deleting...";

    try {
        await deleteSlot(deletingSlotId);

        closeDeleteModal();
        await loadSlots(true);

        showToast("Slot deleted successfully!", "success");
    } catch (err) {
        console.error("Error deleting slot:", err);
        showToast(err.message, "error");
    } finally {
        isLoading = false;
        elements.deleteConfirmBtn.disabled = false;
        elements.deleteConfirmBtn.textContent = "Delete";
    }
}

// ============================================
// EXPORT FOR EXTERNAL USE
// ============================================

export {
    loadSlots,
    currentSlots,
    showToast
};
