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
      <div style="color: #94a3b8; font-size: 0.9rem; padding: 8px 0;">
        No slots added yet
      </div>
    `;
        return;
    }

    // Render slots in simple format matching original design
    let html = "";

    for (const slot of currentSlots) {
        const isBooked = slot.status === SLOT_STATUS.BOOKED;
        const dayShort = getShortDay(slot.day);
        const timeRange = `${formatTimeDisplay(slot.startTime)}–${formatTimeDisplay(slot.endTime)}`;

        html += `
      <div class="slot" data-slot-id="${slot.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: ${isBooked ? '#f1f5f9' : '#f8fafc'}; border-radius: 8px; margin-bottom: 8px; ${isBooked ? 'opacity: 0.7;' : ''}">
        <span style="font-size: 0.95rem; color: #334155;">
          <strong>${dayShort}</strong> · ${timeRange}
          ${isBooked ? '<span style="color: #2563eb; font-size: 0.75rem; margin-left: 8px;">● Booked</span>' : ''}
        </span>
        <span style="display: flex; gap: 8px; align-items: center;">
          ${!isBooked ? `
            <button onclick="window.openEditModal('${slot.id}')" style="background: none; border: none; cursor: pointer; padding: 4px; color: #64748b; font-size: 1.1rem;" title="Edit">✏️</button>
            <button onclick="window.openDeleteModal('${slot.id}')" style="background: none; border: none; cursor: pointer; padding: 4px; font-size: 1.1rem;" title="Delete">🗑️</button>
          ` : '<span style="color: #94a3b8; font-size: 0.9rem;">🔒</span>'}
        </span>
      </div>
    `;
    }

    elements.slotsList.innerHTML = html;
}

function updateSlotCount() {
    if (!elements.slotsCount) return;

    const available = currentSlots.filter(s => s.status === SLOT_STATUS.AVAILABLE).length;
    const booked = currentSlots.filter(s => s.status === SLOT_STATUS.BOOKED).length;
    const total = currentSlots.length;

    if (total === 0) {
        elements.slotsCount.innerHTML = "";
        return;
    }

    elements.slotsCount.innerHTML = `
    <span style="color: #16a34a;">${available} available</span>
    ${booked > 0 ? ` · <span style="color: #2563eb;">${booked} booked</span>` : ""}
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

    if (slot.status === SLOT_STATUS.BOOKED) {
        showToast("Cannot edit a booked slot", "error");
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

    if (slot.status === SLOT_STATUS.BOOKED) {
        showToast("Cannot delete a booked slot", "error");
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
