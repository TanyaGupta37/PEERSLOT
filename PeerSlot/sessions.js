import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let weekChart = null;
let subjectChart = null;
let helpChart = null;
let allSessions = [];

window.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.querySelector('.search-box input');
  const avatarToggle = document.getElementById('avatarToggle');
  const avatarDropdown = document.getElementById('avatarDropdown');
  const notificationToggle = document.getElementById('notificationToggle');
  const notificationPanel = document.getElementById('notificationPanel');

  setupInteractions({ avatarToggle, avatarDropdown, notificationToggle, notificationPanel });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (!userSnap.exists()) {
      window.location.href = 'setup.html';
      return;
    }

    const userData = userSnap.data();
    if (avatarToggle) {
      avatarToggle.textContent = (userData.name || 'U')[0].toUpperCase();
    }

    allSessions = await fetchUserSessions(user.uid);
    renderSessions(allSessions);

    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        renderSessions(allSessions, event.target.value.trim().toLowerCase());
      });
    }
  });
});

function setupInteractions(elements) {
  const { avatarToggle, avatarDropdown, notificationToggle, notificationPanel } = elements;

  if (notificationToggle && notificationPanel) {
    notificationToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      notificationPanel.classList.toggle('hidden');
      if (avatarDropdown) avatarDropdown.classList.remove('show');
    });
  }

  if (avatarToggle && avatarDropdown) {
    avatarToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      avatarDropdown.classList.toggle('show');
      if (notificationPanel) notificationPanel.classList.add('hidden');
    });
  }

  document.addEventListener('click', (event) => {
    if (notificationPanel && !notificationPanel.contains(event.target) && event.target !== notificationToggle) {
      notificationPanel.classList.add('hidden');
    }
    if (avatarDropdown && !avatarDropdown.contains(event.target) && event.target !== avatarToggle) {
      avatarDropdown.classList.remove('show');
    }
  });
}

async function fetchUserSessions(userId) {
  const requesterQuery = query(
    collection(db, 'matchRequests'),
    where('requesterId', '==', userId)
  );

  const ownerQuery = query(
    collection(db, 'matchRequests'),
    where('slotOwnerId', '==', userId)
  );

  const [requesterSnap, ownerSnap] = await Promise.all([getDocs(requesterQuery), getDocs(ownerQuery)]);

  const sessionDocs = [];
  const collaboratorIds = new Set();
  const slotIds = new Set();

  requesterSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data) return;
    sessionDocs.push({ id: docSnap.id, data, isRequester: true, collaboratorId: data.slotOwnerId });
    if (data.slotOwnerId) collaboratorIds.add(data.slotOwnerId);
    if (data.slotId) slotIds.add(data.slotId);
  });

  ownerSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data) return;
    sessionDocs.push({ id: docSnap.id, data, isRequester: false, collaboratorId: data.requesterId });
    if (data.requesterId) collaboratorIds.add(data.requesterId);
    if (data.slotId) slotIds.add(data.slotId);
  });

  const collaboratorNames = await fetchNames(Array.from(collaboratorIds));
  const slotMap = await fetchSlots(Array.from(slotIds));

  return sessionDocs.map((item) => buildSession(item, collaboratorNames, slotMap));
}

async function fetchNames(ids) {
  const nameMap = {};
  await Promise.all(ids.map(async (id) => {
    if (!id) return;
    const userSnap = await getDoc(doc(db, 'users', id));
    nameMap[id] = userSnap.exists() ? (userSnap.data().name || 'Peer') : 'Peer';
  }));
  return nameMap;
}

async function fetchSlots(ids) {
  const slots = {};
  await Promise.all(ids.map(async (slotId) => {
    if (!slotId) return;
    const slotSnap = await getDoc(doc(db, 'availabilitySlots', slotId));
    if (slotSnap.exists()) {
      slots[slotId] = slotSnap.data();
    }
  }));
  return slots;
}

function buildSession(item, collaborators, slotMap) {
  const { data, isRequester, collaboratorId } = item;
  const collaboratorName = collaborators[collaboratorId] || 'Peer';
  const slot = slotMap[data.slotId] || {};
  const status = normalizeStatus(data.status || slot.status || 'pending');
  const rawDate = getDateObject(data.completedAt) || getDateObject(data.updatedAt) || getDateObject(data.createdAt) || getDateObject(slot.date);
  const dateLabel = slot.date || data.slotSnapshot?.day || formatDate(rawDate) || 'Unknown';
  const timeText = slot.startTime || data.slotSnapshot?.startTime || '';

  return {
    id: item.id,
    collaboratorName,
    type: isRequester ? 'received' : 'helped',
    status,
    isRequester,
    rating: typeof data.rating === 'number' ? data.rating : null,
    ratingReceived: typeof data.rating === 'number' ? !isRequester : false,
    subject: slot.subject || data.slotSnapshot?.subject || 'General',
    dateLabel,
    rawDate,
    timeText,
    completed: status === 'completed',
    upcoming: ['pending', 'booked', 'accepted', 'in_progress'].includes(status)
  };
}

function normalizeStatus(status) {
  if (!status) return 'pending';
  if (status === 'accepted') return 'booked';
  return status;
}

function getDateObject(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
}

function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function renderSessions(sessions, searchTerm = '') {
  const normalizedSearch = searchTerm.toLowerCase();
  const filtered = sessions.filter((session) => {
    if (!normalizedSearch) return true;
    return (
      session.collaboratorName.toLowerCase().includes(normalizedSearch) ||
      session.subject.toLowerCase().includes(normalizedSearch) ||
      session.status.toLowerCase().includes(normalizedSearch)
    );
  });

  renderSummary(filtered);
  renderTopCollaborators(filtered);
  renderCharts(filtered);
}

function renderSummary(sessions) {
  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((session) => session.completed).length;
  const receivedRatings = sessions.filter((session) => session.ratingReceived);
  const averageRating = receivedRatings.length > 0
    ? (receivedRatings.reduce((sum, session) => sum + session.rating, 0) / receivedRatings.length).toFixed(1)
    : '0.0';

  document.getElementById('totalSessions').textContent = totalSessions;
  document.getElementById('completedSessions').textContent = completedSessions;
  document.getElementById('avgRating').textContent = averageRating;
}

function renderTopCollaborators(sessions) {
  const collaboratorCounts = sessions
    .filter((session) => ['booked', 'in_progress', 'completed'].includes(session.status))
    .reduce((acc, session) => {
      acc[session.collaboratorName] = (acc[session.collaboratorName] || 0) + 1;
      return acc;
    }, {});

  const topCollaborators = Object.entries(collaboratorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const container = document.getElementById('topCollaborators');
  if (!container) return;
  container.innerHTML = '';

  if (topCollaborators.length === 0) {
    container.innerHTML = '<div class="collaborator-item empty">No collaborators yet.</div>';
    return;
  }

  topCollaborators.forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'collaborator-item';
    item.innerHTML = `
      <strong>${name}</strong>
      <span>${count} session${count > 1 ? 's' : ''}</span>
    `;
    container.appendChild(item);
  });
}

function renderCharts(sessions) {
  const completedSessions = sessions.filter((session) => session.completed);

  const subjectCounts = completedSessions.reduce((acc, session) => {
    acc[session.subject] = (acc[session.subject] || 0) + 1;
    return acc;
  }, {});

  const helpStats = completedSessions.reduce((acc, session) => {
    acc[session.type] = (acc[session.type] || 0) + 1;
    return acc;
  }, { helped: 0, received: 0 });

  const dates = completedSessions
    .map((session) => session.rawDate)
    .filter(Boolean)
    .map((date) => formatDate(date));

  const weekLabels = getLastSevenDays(dates);

  const sessionsByDay = weekLabels.map((label) =>
    completedSessions.filter((session) => formatDate(session.rawDate) === label).length
  );

  const sessionCanvas = document.getElementById('sessionsWeekChart');
  const subjectCanvas = document.getElementById('subjectChart');
  const helpCanvas = document.getElementById('helpChart');

  const statusValues = completedSessions.length > 0 ? completedSessions.length : 0;

  if (weekChart) weekChart.destroy();
  if (subjectChart) subjectChart.destroy();
  if (helpChart) helpChart.destroy();

  if (sessionCanvas) {
    weekChart = new Chart(sessionCanvas, {
      type: 'line',
      data: {
        labels: weekLabels,
        datasets: [{
          label: 'Sessions',
          data: sessionsByDay,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.16)',
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }

  if (subjectCanvas) {
    const subjectLabels = Object.keys(subjectCounts);
    const subjectValues = Object.values(subjectCounts);

    subjectChart = new Chart(subjectCanvas, {
      type: 'doughnut',
      data: {
        labels: subjectLabels.length > 0 ? subjectLabels : ['No subjects yet'],
        datasets: [{
          data: subjectValues.length > 0 ? subjectValues : [1],
          backgroundColor: subjectLabels.length > 0
            ? ['#2563eb', '#10b981', '#f97316', '#8b5cf6', '#ef4444', '#facc15', '#14b8a6']
            : ['#cbd5e1']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } }
      }
    });
  }

  if (helpCanvas) {
    helpChart = new Chart(helpCanvas, {
      type: 'bar',
      data: {
        labels: ['Help Given', 'Help Received'],
        datasets: [{
          label: 'Sessions',
          data: [helpStats.helped, helpStats.received],
          backgroundColor: ['#2563eb', '#10b981']
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }
}

function getLastSevenDays(existingDates = []) {
  const normalized = Array.from(new Set(existingDates))
    .filter(Boolean)
    .sort();

  if (normalized.length > 0) {
    const lastSeven = normalized.slice(-7);
    return lastSeven;
  }

  const today = new Date();
  const labels = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    labels.push(formatDate(date));
  }
  return labels;
}

function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}
