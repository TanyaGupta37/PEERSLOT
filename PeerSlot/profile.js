import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===== Helpers ===== */

function getAvatarColor(letter) {
  const colors = [
    "#2563eb", "#16a34a", "#db2777",
    "#9333ea", "#ea580c", "#0d9488"
  ];
  return colors[letter.charCodeAt(0) % colors.length];
}

/* ===== DOM Elements ===== */

const els = {
  sidebarAvatar: document.getElementById("sidebarAvatar"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarEmail: document.getElementById("sidebarEmail"),

  avatar: document.getElementById("avatar"),
  avatarDropdown: document.getElementById("avatarDropdown"),

  fullName: document.getElementById("fullName"),
  role: document.getElementById("role"),
  courseBranch: document.getElementById("courseBranch"),
  semester: document.getElementById("semester"),
  bio: document.getElementById("bioTextarea"),

  subjectsContainer: document.getElementById("subjectsContainer"),
  subjectSelect: document.getElementById("subjectSelect"),
  subjectEditor: document.getElementById("subjectEditor"),
  customSubject: document.getElementById("customSubject"),
  editSubjectsBtn: document.getElementById("editSubjects"),
  doneSubjectsBtn: document.getElementById("doneSubjects"),

  saveBtn: document.getElementById("saveBtn"),
  cancelBtn: document.getElementById("cancelBtn"),

  successMsg: document.getElementById("successMessage"),
  errorMsg: document.getElementById("errorMessage")
};

let currentUser = null;
let selectedSubjects = [];
let isEditingSubjects = false;

/* ===== Subject Options ===== */

const SUBJECT_OPTIONS = [
  "DSA", "Python", "Java", "C / C++", "DBMS",
  "OS", "CN", "Web Development", "Machine Learning",
  "Data Science", "AI", "Cloud Computing",
  "Cyber Security", "Blockchain", "Aptitude"
];

SUBJECT_OPTIONS.forEach(s => {
  const opt = document.createElement("option");
  opt.value = s;
  opt.innerText = s;
  els.subjectSelect.appendChild(opt);
});

/* ===== Auth ===== */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    window.location.href = "setup.html";
    return;
  }

  populateProfile(snap.data());
});

/* ===== Populate Profile ===== */

function populateProfile(data) {
  const firstName = data.name.split(" ")[0];
  const letter = firstName[0].toUpperCase();

  els.avatar.innerText = letter;
  els.avatar.style.background = getAvatarColor(letter);

  els.sidebarAvatar.innerText = letter;
  els.sidebarAvatar.style.background = getAvatarColor(letter);
  els.sidebarName.innerText = data.name;
  els.sidebarEmail.innerText = auth.currentUser.email;

  els.fullName.value = data.name;
  els.role.value = "Student";
  els.courseBranch.value = data.course || "";
  els.semester.value = data.semester || "";
  els.bio.value = data.bio || "";

  selectedSubjects = data.subjects || [];
  renderSubjects();
}

/* ===== Render Subjects ===== */

function renderSubjects() {
  els.subjectsContainer.innerHTML = "";

  selectedSubjects.forEach((subj, i) => {
    const tag = document.createElement("div");
    tag.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background: #dcfce7;
      color: #166534;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      margin: 4px;
      position: relative;
    `;

    const label = document.createElement("span");
    label.innerText = subj;
    tag.appendChild(label);

    // Always show the ✕ button (so user can remove while in editing mode)
    // We only show it when isEditingSubjects is true
    if (isEditingSubjects) {
      const removeBtn = document.createElement("button");
      removeBtn.innerText = "✕";
      removeBtn.title = "Remove";
      removeBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        font-size: 11px;
        color: #166534;
        padding: 0 0 0 2px;
        line-height: 1;
        display: flex;
        align-items: center;
      `;
      removeBtn.addEventListener("mouseenter", () => removeBtn.style.color = "#dc2626");
      removeBtn.addEventListener("mouseleave", () => removeBtn.style.color = "#166534");
      removeBtn.addEventListener("click", () => {
        selectedSubjects.splice(i, 1);
        renderSubjects();
      });
      tag.appendChild(removeBtn);
    }

    els.subjectsContainer.appendChild(tag);
  });

  // DO NOT call lucide.createIcons() here — it destroys the pencil listener
}

/* ===== Subject Editing ===== */

// FIX: Only ONE registration of each listener

els.editSubjectsBtn.addEventListener("click", () => {
  isEditingSubjects = true;
  els.subjectEditor.style.display = "block";
  renderSubjects();
});

els.subjectSelect.addEventListener("change", () => {
  const value = els.subjectSelect.value.trim();
  if (!value || selectedSubjects.includes(value)) {
    els.subjectSelect.value = "";
    return;
  }
  selectedSubjects.push(value);
  renderSubjects();
  els.subjectSelect.value = "";
});

els.customSubject.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = els.customSubject.value.trim();
  if (!value || selectedSubjects.includes(value)) return;
  selectedSubjects.push(value);
  els.customSubject.value = "";
  renderSubjects();
});

// FIX: "Done" just closes the editor, does NOT save to Firestore
els.doneSubjectsBtn.addEventListener("click", () => {
  isEditingSubjects = false;
  els.subjectEditor.style.display = "none";
  renderSubjects();
});

/* ===== Save Changes (the blue button) ===== */

// FIX: This is what actually saves everything to Firestore
els.saveBtn.addEventListener("click", async () => {
  hideMessages();

  const course = els.courseBranch.value.trim();
  const semester = els.semester.value;
  const bio = els.bio.value.trim();

  if (!course) {
    showError("Please enter your Course / Branch.");
    return;
  }
  if (!semester) {
    showError("Please select your Year / Semester.");
    return;
  }
  if (selectedSubjects.length === 0) {
    showError("Please add at least one subject.");
    return;
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      course,
      semester,
      bio,
      subjects: selectedSubjects,
      updatedAt: new Date()
    });

    showSuccess("Profile saved successfully!");
  } catch (err) {
    console.error(err);
    showError("Failed to save profile. Please try again.");
  }
});

/* ===== Cancel ===== */

els.cancelBtn.addEventListener("click", () => {
  window.location.reload();
});

/* ===== Message Helpers ===== */

function showSuccess(msg) {
  els.successMsg.innerText = msg;
  els.successMsg.style.display = "block";
  els.errorMsg.style.display = "none";
  setTimeout(() => els.successMsg.style.display = "none", 4000);
}

function showError(msg) {
  els.errorMsg.innerText = msg;
  els.errorMsg.style.display = "block";
  els.successMsg.style.display = "none";
}

function hideMessages() {
  els.successMsg.style.display = "none";
  els.errorMsg.style.display = "none";
}

/* ===== Avatar Dropdown ===== */

els.avatar.addEventListener("click", (e) => {
  e.stopPropagation();
  els.avatarDropdown.classList.toggle("show");
});

document.addEventListener("click", (e) => {
  if (!els.avatar.contains(e.target) && !els.avatarDropdown.contains(e.target)) {
    els.avatarDropdown.classList.remove("show");
  }
});

els.avatarDropdown.addEventListener("click", (e) => {
  const item = e.target.closest("[data-action]");
  if (!item) return;

  const action = item.dataset.action;
  els.avatarDropdown.classList.remove("show");

  if (action === "profile") window.location.href = "profile.html";
  if (action === "settings") window.location.href = "settings.html";
  if (action === "logout") signOut(auth).then(() => window.location.href = "login.html");
});