import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, sendPasswordResetEmail, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setupNotifications } from "./notifications.js";

// State
let currentUser = null;
let userData = null;

// DOM Elements
const elements = {
  // Avatar
  avatar: document.getElementById("avatar"),
  avatarDropdown: document.getElementById("avatarDropdown"),

  // Account Settings
  mujEmail: document.getElementById("mujEmail"),
  resetPasswordBtn: document.getElementById("resetPasswordBtn"),
  passwordResetMessage: document.getElementById("passwordResetMessage"),

  // Notification Preferences
  sessionReminders: document.getElementById("sessionReminders"),
  slotRequests: document.getElementById("slotRequests"),
  confirmationsCancellations: document.getElementById("confirmationsCancellations"),

  // App Preferences
  defaultSessionMode: document.getElementById("defaultSessionMode"),
  timeFormat: document.getElementById("timeFormat"),

  // Save Preferences Button
  savePreferencesBtn: document.getElementById("savePreferencesBtn"),
  preferencesMessage: document.getElementById("preferencesMessage"),

  // Danger Zone
  deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  deleteConfirmModal: document.getElementById("deleteConfirmModal"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteError: document.getElementById("deleteError")
};

// Get avatar color based on first letter
function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

// Initialize page
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  setupNotifications();

  const snap = await getDoc(doc(db, "users", user.uid));
  if (snap.exists()) {
    userData = snap.data();
  }

  populateForm();
  setupEventListeners();
});

// Populate form with user data
function populateForm() {
  const firstName = userData?.name ? userData.name.split(" ")[0] : "U";
  const firstLetter = firstName[0]?.toUpperCase() || "U";

  // Avatar
  if (elements.avatar) {
    elements.avatar.textContent = firstLetter;
    elements.avatar.style.background = getAvatarColor(firstLetter);
  }

  // Account Settings
  if (elements.mujEmail) {
    elements.mujEmail.value = currentUser.email || "";
  }

  // Load saved preferences from Firestore
  loadPreferences();
}

// Load preferences from Firestore
async function loadPreferences() {
  try {
    const prefsSnap = await getDoc(doc(db, "userPreferences", currentUser.uid));
    if (prefsSnap.exists()) {
      const prefs = prefsSnap.data();

      // Notification preferences
      if (elements.sessionReminders) {
        elements.sessionReminders.checked = prefs.sessionReminders !== false;
      }
      if (elements.slotRequests) {
        elements.slotRequests.checked = prefs.slotRequests !== false;
      }
      if (elements.confirmationsCancellations) {
        elements.confirmationsCancellations.checked = prefs.confirmationsCancellations !== false;
      }

      // App preferences
      if (elements.defaultSessionMode) {
        elements.defaultSessionMode.value = prefs.defaultSessionMode || "online";
      }
      if (elements.timeFormat) {
        elements.timeFormat.value = prefs.timeFormat || "12";
      }
    }
  } catch (err) {
    console.error("Error loading preferences:", err);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Avatar dropdown
  if (elements.avatar) {
    elements.avatar.addEventListener("click", toggleAvatarDropdown);
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (elements.avatarDropdown && !elements.avatar.contains(e.target) && !elements.avatarDropdown.contains(e.target)) {
      elements.avatarDropdown.classList.remove("show");
    }
  });

  // Reset Password
  if (elements.resetPasswordBtn) {
    elements.resetPasswordBtn.addEventListener("click", handlePasswordReset);
  }

  // Save Preferences
  if (elements.savePreferencesBtn) {
    elements.savePreferencesBtn.addEventListener("click", savePreferences);
  }

  // Delete Account
  if (elements.deleteAccountBtn) {
    elements.deleteAccountBtn.addEventListener("click", showDeleteModal);
  }

  if (elements.cancelDeleteBtn) {
    elements.cancelDeleteBtn.addEventListener("click", hideDeleteModal);
  }

  if (elements.confirmDeleteBtn) {
    elements.confirmDeleteBtn.addEventListener("click", handleDeleteAccount);
  }

  // Close modal on outside click
  if (elements.deleteConfirmModal) {
    elements.deleteConfirmModal.addEventListener("click", (e) => {
      if (e.target === elements.deleteConfirmModal) {
        hideDeleteModal();
      }
    });
  }
}

// Toggle avatar dropdown
function toggleAvatarDropdown() {
  if (elements.avatarDropdown) {
    elements.avatarDropdown.classList.toggle("show");
  }
}

// Handle password reset
async function handlePasswordReset() {
  if (!currentUser?.email) return;

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    showPasswordResetMessage("Password reset email sent! Check your inbox.", "success");
  } catch (err) {
    console.error("Password reset error:", err);
    showPasswordResetMessage("Failed to send reset email. Please try again.", "error");
  }
}

// Show password reset message
function showPasswordResetMessage(message, type) {
  if (elements.passwordResetMessage) {
    elements.passwordResetMessage.textContent = message;
    elements.passwordResetMessage.className = `form-hint ${type}`;
    elements.passwordResetMessage.style.display = "block";

    setTimeout(() => {
      elements.passwordResetMessage.style.display = "none";
    }, 5000);
  }
}

// Save preferences
async function savePreferences() {
  if (!currentUser) return;

  try {
    const preferences = {
      // Notification preferences
      sessionReminders: elements.sessionReminders?.checked ?? true,
      slotRequests: elements.slotRequests?.checked ?? true,
      confirmationsCancellations: elements.confirmationsCancellations?.checked ?? true,

      // App preferences
      defaultSessionMode: elements.defaultSessionMode?.value || "online",
      timeFormat: elements.timeFormat?.value || "12",

      updatedAt: new Date()
    };

    await setDoc(doc(db, "userPreferences", currentUser.uid), preferences);

    showPreferencesMessage("Preferences saved successfully!", "success");
  } catch (err) {
    console.error("Error saving preferences:", err);
    showPreferencesMessage("Failed to save preferences. Please try again.", "error");
  }
}

// Show preferences message
function showPreferencesMessage(message, type) {
  if (elements.preferencesMessage) {
    elements.preferencesMessage.textContent = message;
    elements.preferencesMessage.className = `message ${type}`;
    elements.preferencesMessage.style.display = "block";

    setTimeout(() => {
      elements.preferencesMessage.style.display = "none";
    }, 3000);
  }
}

// Show delete confirmation modal
function showDeleteModal() {
  if (elements.deleteConfirmModal) {
    elements.deleteConfirmModal.classList.add("show");
  }
  if (elements.deleteError) {
    elements.deleteError.style.display = "none";
  }
}

// Hide delete confirmation modal
function hideDeleteModal() {
  if (elements.deleteConfirmModal) {
    elements.deleteConfirmModal.classList.remove("show");
  }
}

// Handle account deletion
async function handleDeleteAccount() {
  if (!currentUser) return;

  try {
    // Delete user data from Firestore
    await deleteDoc(doc(db, "users", currentUser.uid));

    // Delete user preferences
    try {
      await deleteDoc(doc(db, "userPreferences", currentUser.uid));
    } catch (e) {
      // Preferences might not exist, ignore error
    }

    // Delete Firebase Auth user
    await deleteUser(currentUser);

    // Redirect to landing page
    window.location.href = "index.html";

  } catch (err) {
    console.error("Delete account error:", err);

    // Handle specific error cases
    if (err.code === "auth/requires-recent-login") {
      showDeleteError("For security, please log out and log back in before deleting your account.");
    } else {
      showDeleteError("Failed to delete account. Please try again later.");
    }
  }
}

// Show delete error
function showDeleteError(message) {
  if (elements.deleteError) {
    elements.deleteError.textContent = message;
    elements.deleteError.style.display = "block";
  }
}

// Global functions for dropdown
window.navigateTo = (page) => {
  window.location.href = page;
};

window.logout = async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error("Logout error:", err);
    alert("Failed to log out. Please try again.");
  }
};