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
  // Sidebar / header
  sidebarAvatar: document.getElementById("sidebarAvatar"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarEmail: document.getElementById("sidebarEmail"),

  avatar: document.getElementById("avatar"),
  avatarDropdown: document.getElementById("avatarDropdown"),

  // Profile form
  fullName: document.getElementById("fullName"),
  role: document.getElementById("role"),
  courseBranch: document.getElementById("courseBranch"),
  semester: document.getElementById("semester"),
  bio: document.getElementById("bioTextarea"),

  // Subjects / skills
  subjectsContainer: document.getElementById("subjectsContainer"),
  subjectSelect: document.getElementById("subjectSelect"),
  subjectEditor: document.getElementById("subjectEditor"),
  customSubject: document.getElementById("customSubject"),
  editSubjectsBtn: document.getElementById("editSubjects"),
  doneSubjectsBtn: document.getElementById("doneSubjects"),

  // Buttons
  saveBtn: document.getElementById("saveBtn"),
  cancelBtn: document.getElementById("cancelBtn"),

  // Messages
  successMsg: document.getElementById("successMessage"),
  errorMsg: document.getElementById("errorMessage")
};


let currentUser = null;
let selectedSubjects = [];
let isEditingSubjects = false;

/* ===== Subject Options (same as setup) ===== */

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

  // Top avatar
  els.avatar.innerText = letter;
  els.avatar.style.background = getAvatarColor(letter);

  // Sidebar card
  els.sidebarAvatar.innerText = letter;
  els.sidebarAvatar.style.background = getAvatarColor(letter);
  els.sidebarName.innerText = data.name;
  els.sidebarEmail.innerText = auth.currentUser.email;

  // Form fields
  els.fullName.value = data.name;
  els.role.value = "Student";
  els.courseBranch.value = data.course || "";
  els.semester.value = data.semester || "";
  els.bio.value = data.bio || "";

  // Subjects
  selectedSubjects = data.subjects || [];
  renderSubjects();
}

/* ===== Render Subjects ===== */

function renderSubjects() {
  els.subjectsContainer.innerHTML = "";

  selectedSubjects.forEach(subj => {
    const tag = document.createElement("div");
    tag.className = "subject-tag";
    tag.innerHTML = `
      ${subject}
      ${isEditingSubjects ? `
        <button data-index="${index}">✕</button>`: ""
      } 
    `;
    if (isEditingSubjects) {
      tag.querySelector("button").addEventListener("click", () => {
        selectedSubjects.splice(index, 1);
        renderSubjects();
      });
    }
    els.subjectsContainer.appendChild(tag);
  });

  lucide.createIcons();
}

/* ===== Subject Editing ===== */

els.editSubjectsBtn.addEventListener("click", () => {
  isEditingSubjects = true;
  els.subjectSelect.style.display = "block";
  renderSubjects();
});

els.subjectSelect.addEventListener("change", () => {
  const value = els.subjectSelect.value.trim();
  if (!value || selectedSubjects.includes(value)) return;

  selectedSubjects.push(value);
  renderSubjects();
  els.subjectSelect.value = "";
});

els.subjectsContainer.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-subject]");
  if (!btn || !isEditingSubjects) return;

  const subj = btn.dataset.subject;
  selectedSubjects = selectedSubjects.filter(s => s !== subj);
  renderSubjects();
});

/* ===== Subject Editing ===== */

// Open editor
els.editSubjectsBtn.addEventListener("click", () => {
  isEditingSubjects = true;
  els.subjectEditor.style.display = "block";
  renderSubjects();
});

// Add from dropdown
els.subjectSelect.addEventListener("change", () => {
  const value = els.subjectSelect.value.trim();
  if (!value || selectedSubjects.includes(value)) return;

  selectedSubjects.push(value);
  renderSubjects();
  els.subjectSelect.value = "";
});

// Add custom subject (Enter key)
els.customSubject.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  const value = els.customSubject.value.trim();
  if (!value || selectedSubjects.includes(value)) return;

  selectedSubjects.push(value);
  els.customSubject.value = "";
  renderSubjects();
});

// Done → save + close
els.doneSubjectsBtn.addEventListener("click", async () => {
  try {
    await updateDoc(doc(db, "users", currentUser.uid), {
      subjects: selectedSubjects,
      updatedAt: new Date()
    });

    isEditingSubjects = false;
    els.subjectEditor.style.display = "none";

    els.successMsg.innerText = "Subjects updated successfully!";
    els.successMsg.style.display = "block";

    renderSubjects();
  } catch (err) {
    console.error(err);
    els.errorMsg.innerText = "Failed to update subjects.";
    els.errorMsg.style.display = "block";
  }
});


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
