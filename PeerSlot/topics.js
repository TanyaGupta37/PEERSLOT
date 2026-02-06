// ================= MOCK TOPICS =================
const mockTopics = [
  { id: "dsa", name: "Data Structures & Algorithms" },
  { id: "python", name: "Python" },
  { id: "java", name: "Java" },
  { id: "dbms", name: "Database Management Systems" },
  { id: "os", name: "Operating Systems" },
  { id: "cn", name: "Computer Networks" },
  { id: "web", name: "Web Development" },
  { id: "ml", name: "Machine Learning" },
  { id: "ai", name: "Artificial Intelligence" }
];

// ================= DOM ELEMENTS =================
const helpOfferedDiv = document.getElementById("helpOffered");
const helpNeededDiv = document.getElementById("helpNeeded");
const saveBtn = document.getElementById("saveTopics");

// ================= USER DATA (MOCK STORAGE) =================
function getUserTopics() {
  return {
    helpOffered: JSON.parse(localStorage.getItem("helpOffered")) || [],
    helpNeeded: JSON.parse(localStorage.getItem("helpNeeded")) || []
  };
}

// ================= RENDER TOPICS =================
function renderTopics() {
  const userData = getUserTopics();

  mockTopics.forEach(topic => {
    // Help Offered
    helpOfferedDiv.innerHTML += `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userData.helpOffered.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `;

    // Help Needed
    helpNeededDiv.innerHTML += `
      <label>
        <input type="checkbox" value="${topic.id}"
          ${userData.helpNeeded.includes(topic.id) ? "checked" : ""}>
        ${topic.name}
      </label>
    `;
  });
}

// ================= SAVE SELECTION =================
function saveTopics() {
  const helpOffered = [...helpOfferedDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  const helpNeeded = [...helpNeededDiv.querySelectorAll("input:checked")]
    .map(cb => cb.value);

  localStorage.setItem("helpOffered", JSON.stringify(helpOffered));
  localStorage.setItem("helpNeeded", JSON.stringify(helpNeeded));

  alert("Topics saved successfully!");
}

// ================= INIT =================
renderTopics();
saveBtn.addEventListener("click", saveTopics);
