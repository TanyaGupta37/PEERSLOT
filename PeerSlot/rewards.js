import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
  const notificationToggle = document.getElementById('notificationToggle');
  const notificationPanel = document.getElementById('notificationPanel');
  const avatarToggle = document.getElementById('avatarToggle');
  const avatarDropdown = document.getElementById('avatarDropdown');

  notificationToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    notificationPanel.classList.toggle('hidden');
    avatarDropdown.classList.remove('show');
  });

  avatarToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    avatarDropdown.classList.toggle('show');
    notificationPanel.classList.add('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!notificationPanel.contains(event.target) && event.target !== notificationToggle) {
      notificationPanel.classList.add('hidden');
    }
    if (!avatarDropdown.contains(event.target) && event.target !== avatarToggle) {
      avatarDropdown.classList.remove('show');
    }
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    onSnapshot(userDocRef, async (snapshot) => {
      if (!snapshot.exists()) {
        window.location.href = 'setup.html';
        return;
      }

      await renderRewardData(snapshot.data(), user.uid);
    }, (error) => {
      console.error('Reward page snapshot error:', error);
    });
  });
});

async function renderRewardData(userData, userId) {
  const tokenAmountEl = document.getElementById('rewardTokenAmount');
  const badgesCountEl = document.getElementById('rewardBadgesCount');
  const badgeGrid = document.getElementById('badgeGrid');
  const progressLevelEl = document.getElementById('progressLevel');
  const progressPointsEl = document.getElementById('progressPoints');
  const progressBarFill = document.getElementById('progressBarFill');
  const activityList = document.getElementById('activityList');

  const tokenBalance = Number(userData.peerToken || userData.tokenBalance || userData.tokens || 0);
  const badgeList = Array.isArray(userData.badges) ? userData.badges : [];
  const badgeCount = badgeList.length || Number(userData.badgeCount || 0);
  const progressLevel = userData.rewardLevel || 'Silver level';
  const currentPoints = Number(userData.rewardPoints || userData.points || 0);
  const nextPoints = Number(userData.nextRewardPoints || 12);
  const progressPercent = nextPoints > 0 ? Math.min(100, Math.round((currentPoints / nextPoints) * 100)) : 0;

  if (tokenAmountEl) tokenAmountEl.textContent = tokenBalance.toLocaleString();
  if (badgesCountEl) badgesCountEl.textContent = `${badgeCount} earned`;
  if (progressLevelEl) progressLevelEl.textContent = progressLevel;
  if (progressPointsEl) progressPointsEl.textContent = `${currentPoints} / ${nextPoints} points`;
  if (progressBarFill) progressBarFill.style.width = `${progressPercent}%`;

  const sessions = await fetchUserSessions(userId);
  const completedSessions = sessions.filter((s) => s.completed);
  const thisWeekSessions = completedSessions.filter((s) => isDateInCurrentWeek(s.rawDate));

  const generatedBadges = [];
  if (completedSessions.length >= 20) {
    generatedBadges.push({ title: 'Top Helper', description: `Helped ${completedSessions.length} peers` });
  }
  if (thisWeekSessions.length >= 3) {
    generatedBadges.push({ title: 'Consistent Learner', description: `${thisWeekSessions.length} sessions this week` });
  }
  if (badgeList.length > 0) {
    badgeList.forEach((badge) => {
      generatedBadges.push({ title: badge.title || badge.name || 'Badge', description: badge.description || '' });
    });
  }

  if (badgeGrid) {
    badgeGrid.innerHTML = '';
    if (generatedBadges.length === 0) {
      badgeGrid.innerHTML = `<div class="badge-card empty-badge"><strong>No badges yet</strong><p>Complete sessions to unlock badges.</p></div>`;
    } else {
      generatedBadges.slice(0, 6).forEach((badge) => {
        badgeGrid.innerHTML += `
          <div class="badge-card">
            <strong>${badge.title}</strong>
            <p>${badge.description || 'Earned reward'}</p>
          </div>
        `;
      });
    }
  }

  if (activityList) {
    activityList.innerHTML = '';
    const recentItems = buildRecentActivity(sessions, tokenBalance);
    if (recentItems.length === 0) {
      activityList.innerHTML = '<li>No recent activity yet.</li>';
    } else {
      recentItems.forEach((activity) => {
        const li = document.createElement('li');
        li.textContent = activity;
        activityList.appendChild(li);
      });
    }
  }
}

async function fetchUserSessions(userId) {
  const requesterQuery = query(
    collection(db, 'matchRequests'),
    where('requesterId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const ownerQuery = query(
    collection(db, 'matchRequests'),
    where('slotOwnerId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  const [requesterSnap, ownerSnap] = await Promise.all([getDocs(requesterQuery), getDocs(ownerQuery)]);
  const sessions = [];
  const collaboratorIds = new Set();

  requesterSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data) return;
    sessions.push(buildRewardSession(docSnap.id, data, true, data.slotOwnerId));
    if (data.slotOwnerId) collaboratorIds.add(data.slotOwnerId);
  });

  ownerSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (!data) return;
    sessions.push(buildRewardSession(docSnap.id, data, false, data.requesterId));
    if (data.requesterId) collaboratorIds.add(data.requesterId);
  });

  const collaboratorNames = await fetchNames(Array.from(collaboratorIds));
  sessions.forEach((session) => {
    session.collaboratorName = collaboratorNames[session.collaboratorId] || 'Peer';
  });

  return sessions;
}

function buildRewardSession(id, data, isRequester, collaboratorId) {
  const status = normalizeStatus(data.status);
  return {
    id,
    collaboratorId,
    collaboratorName: 'Peer',
    isRequester,
    status,
    completed: status === 'completed',
    rawDate: getDateObject(data.completedAt || data.updatedAt || data.createdAt),
    subject: data.slotSnapshot?.subject || 'General',
    rating: typeof data.rating === 'number' ? data.rating : null
  };
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

function normalizeStatus(status) {
  if (!status) return 'pending';
  if (status === 'accepted') return 'booked';
  return status;
}

function getDateObject(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  return null;
}

function isDateInCurrentWeek(date) {
  if (!date) return false;
  const now = new Date();
  const firstDay = new Date(now);
  firstDay.setDate(now.getDate() - now.getDay());
  firstDay.setHours(0, 0, 0, 0);
  const lastDay = new Date(firstDay);
  lastDay.setDate(firstDay.getDate() + 6);
  return date >= firstDay && date <= lastDay;
}

function buildRecentActivity(sessions, tokenBalance) {
  const activities = [];
  const sorted = sessions
    .filter((session) => session.status)
    .sort((a, b) => {
      const aDate = a.rawDate || new Date(0);
      const bDate = b.rawDate || new Date(0);
      return bDate - aDate;
    })
    .slice(0, 3);

  sorted.forEach((session) => {
    if (session.completed) {
      activities.push(`Completed ${session.subject} session with ${session.collaboratorName}`);
    } else if (session.status === 'booked') {
      activities.push(`Booked ${session.subject} session with ${session.collaboratorName}`);
    } else if (session.status === 'pending') {
      activities.push(`Requested ${session.subject} session with ${session.collaboratorName}`);
    }
  });

  if (activities.length === 0 && tokenBalance > 0) {
    activities.push(`Earned ${tokenBalance} PeerToken`);
  }

  return activities;
}
