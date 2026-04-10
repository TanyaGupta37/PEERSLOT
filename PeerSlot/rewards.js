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
  orderBy,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Badge definitions with milestones
const BADGE_SYSTEM = {
  helping: [
    { tokens: 50, title: '🥉 Bronze Helper', description: 'Helped 1+ peer' },
    { tokens: 150, title: '🥈 Silver Mentor', description: 'Helped 3+ peers' },
    { tokens: 300, title: '🥇 Gold Expert', description: 'Helped 6+ peers' },
    { tokens: 600, title: '💎 Platinum Authority', description: 'Helped 12+ peers' },
    { tokens: 1000, title: '👑 Diamond Master', description: 'Helped 20+ peers' }
  ],
  receiving: [
    { tokens: 20, title: '📚 Novice Learner', description: 'Received 1+ session' },
    { tokens: 60, title: '🎓 Active Learner', description: 'Received 3+ sessions' },
    { tokens: 120, title: '⭐ Super Learner', description: 'Received 6+ sessions' },
    { tokens: 200, title: '🌟 Champion Learner', description: 'Received 10+ sessions' }
  ],
  total: [
    { tokens: 70, title: '🚀 Starter', description: 'Earned 70 total tokens' },
    { tokens: 210, title: '📈 Climber', description: 'Earned 210 total tokens' },
    { tokens: 420, title: '🌍 Global Contributor', description: 'Earned 420 total tokens' },
    { tokens: 800, title: '⚡ Legendary', description: 'Earned 800+ total tokens' }
  ]
};

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
    console.log('Rewards page auth ready for', user.uid);
    onSnapshot(userDocRef, async (snapshot) => {
      if (!snapshot.exists()) {
        window.location.href = 'setup.html';
        return;
      }

      try {
        // Calculate user rewards from sessions
        const rewardData = await calculateUserRewards(user.uid);
        
        // Update the user document with calculated rewards
        await updateUserRewards(user.uid, rewardData);
        
        // Merge with user data and render
        const userData = { ...snapshot.data(), ...rewardData };
        await renderRewardData(userData, user.uid);
      } catch (error) {
        console.error('Reward page error:', error);
        renderRewardError(error);
      }
    }, (error) => {
      console.error('Reward page snapshot error:', error);
      renderRewardError(error);
    });
  });
});

// Calculate user rewards from session history
async function calculateUserRewards(userId) {
  try {
    const sessions = await fetchUserSessions(userId);
    const completedSessions = sessions.filter(s => s.completed);
    
    let helpingTokens = 0;  // Amount user earned by helping others
    let receivingTokens = 0;  // Amount user earned by receiving help
    let helpingCount = 0;
    let receivingCount = 0;

    completedSessions.forEach(session => {
      if (session.isHelper) {
        // User was the helper (slot owner)
        helpingCount++;
        helpingTokens += 50;
      } else {
        // User was receiving help (requester)
        receivingCount++;
        receivingTokens += 20;
      }
    });

    const totalTokens = helpingTokens + receivingTokens;

    return {
      peerToken: totalTokens,
      helpingTokens,
      receivingTokens,
      helpingCount,
      receivingCount,
      completedSessionsCount: completedSessions.length
    };
  } catch (error) {
    console.error('Error calculating user rewards:', error);
    return {
      peerToken: 0,
      helpingTokens: 0,
      receivingTokens: 0,
      helpingCount: 0,
      receivingCount: 0,
      completedSessionsCount: 0
    };
  }
}

// Update user document with calculated rewards
async function updateUserRewards(userId, rewardData) {
  try {
    const userDocRef = doc(db, 'users', userId);
    await updateDoc(userDocRef, {
      peerToken: rewardData.peerToken,
      helpingTokens: rewardData.helpingTokens,
      receivingTokens: rewardData.receivingTokens,
      helpingCount: rewardData.helpingCount,
      receivingCount: rewardData.receivingCount,
      completedSessionsCount: rewardData.completedSessionsCount
    });
  } catch (error) {
    console.error('Error updating user rewards:', error);
  }
}

// Get all badges earned by a user
function getUnlockedBadges(helpingTokens, receivingTokens, totalTokens) {
  const badges = [];

  // Helping badges
  BADGE_SYSTEM.helping.forEach(badge => {
    if (helpingTokens >= badge.tokens) {
      badges.push({
        ...badge,
        category: 'Helping',
        earned: true
      });
    }
  });

  // Receiving badges
  BADGE_SYSTEM.receiving.forEach(badge => {
    if (receivingTokens >= badge.tokens) {
      badges.push({
        ...badge,
        category: 'Learning',
        earned: true
      });
    }
  });

  // Total badges
  BADGE_SYSTEM.total.forEach(badge => {
    if (totalTokens >= badge.tokens) {
      badges.push({
        ...badge,
        category: 'Total',
        earned: true
      });
    }
  });

  return badges;
}

// Get next badge milestone info
function getNextBadgeMilestone(helpingTokens, receivingTokens, totalTokens) {
  const allBadges = [];
  
  BADGE_SYSTEM.helping.forEach(b => allBadges.push({ ...b, category: 'Helping', type: 'helping' }));
  BADGE_SYSTEM.receiving.forEach(b => allBadges.push({ ...b, category: 'Learning', type: 'receiving' }));
  BADGE_SYSTEM.total.forEach(b => allBadges.push({ ...b, category: 'Total', type: 'total' }));

  for (let badge of allBadges) {
    let current = 0;
    if (badge.type === 'helping') current = helpingTokens;
    else if (badge.type === 'receiving') current = receivingTokens;
    else current = totalTokens;

    if (current < badge.tokens) {
      return {
        ...badge,
        current,
        progress: Math.round((current / badge.tokens) * 100)
      };
    }
  }

  return {
    title: '👑 Master',
    description: 'All badges unlocked!',
    tokens: Infinity,
    current: totalTokens,
    progress: 100
  };
}

async function renderRewardData(userData, userId) {
  const peerTokenBalanceEl = document.getElementById('peerTokenBalance');
  const badgeCountEl = document.getElementById('badgeCount');
  const badgeGrid = document.getElementById('badgeGrid');
  const badgeProgressEl = document.getElementById('badgeProgress');
  const progressBarEl = document.getElementById('progressBar');
  const activityList = document.getElementById('activityList');

  const totalTokens = Number(userData.peerToken || 0);
  const helpingTokens = Number(userData.helpingTokens || 0);
  const receivingTokens = Number(userData.receivingTokens || 0);
  
  // Update UI with token information
  if (peerTokenBalanceEl) peerTokenBalanceEl.textContent = totalTokens.toLocaleString();
  
  // Get all unlocked badges
  const unlockedBadges = getUnlockedBadges(helpingTokens, receivingTokens, totalTokens);
  if (badgeCountEl) badgeCountEl.textContent = `${unlockedBadges.length} earned`;

  // Render badge grid
  if (badgeGrid) {
    badgeGrid.innerHTML = '';
    if (unlockedBadges.length === 0) {
      badgeGrid.innerHTML = `
        <div class="badge-card empty-badge">
          <strong>🎯 No badges yet</strong>
          <p>Complete sessions to earn PeerTokens and unlock badges!</p>
        </div>
      `;
    } else {
      unlockedBadges.forEach((badge) => {
        badgeGrid.innerHTML += `
          <div class="badge-card badge-earned">
            <strong>${badge.title}</strong>
            <p>${badge.description}</p>
            <small>${badge.category} • ${badge.tokens} tokens</small>
          </div>
        `;
      });
    }
  }

  // Get next milestone
  const nextMilestone = getNextBadgeMilestone(helpingTokens, receivingTokens, totalTokens);
  if (badgeProgressEl) {
    badgeProgressEl.innerHTML = `
      <span><strong>${nextMilestone.title}</strong></span>
      <strong>${nextMilestone.current} / ${nextMilestone.tokens === Infinity ? '∞' : nextMilestone.tokens} PeerTokens</strong>
    `;
  }
  if (progressBarEl) {
    progressBarEl.style.width = `${nextMilestone.progress}%`;
  }

  // Build activity list
  const sessions = await fetchUserSessions(userId);
  const completedSessions = sessions.filter(s => s.completed);
  
  if (activityList) {
    activityList.innerHTML = '';
    
    if (totalTokens > 0) {
      activityList.innerHTML += `<li style="font-weight: bold; color: #059669;">✅ Total PeerTokens Earned: <span style="font-size: 1.2em;">${totalTokens}</span></li>`;
    }
    
    if (helpingTokens > 0) {
      activityList.innerHTML += `<li>🤝 Tokens from Helping: <strong>${helpingTokens}</strong> (${userData.helpingCount || 0} sessions)</li>`;
    }
    
    if (receivingTokens > 0) {
      activityList.innerHTML += `<li>📚 Tokens from Learning: <strong>${receivingTokens}</strong> (${userData.receivingCount || 0} sessions)</li>`;
    }

    if (userData.completedSessionsCount > 0) {
      activityList.innerHTML += `<li>🧾 Completed sessions: <strong>${userData.completedSessionsCount}</strong></li>`;
    }

    if (completedSessions.length > 0) {
      const recentItems = buildRecentActivity(completedSessions.slice(0, 3), sessions);
      recentItems.forEach((activity) => {
        const li = document.createElement('li');
        li.textContent = activity;
        activityList.appendChild(li);
      });
    } else if (totalTokens === 0) {
      activityList.innerHTML = '<li style="color: #64748b;">No completed sessions yet. Start helping or get help to earn tokens!</li>';
    }
  }
}

function renderRewardError(error) {
  const peerTokenBalanceEl = document.getElementById('peerTokenBalance');
  const badgeCountEl = document.getElementById('badgeCount');
  const badgeGrid = document.getElementById('badgeGrid');
  const badgeProgressEl = document.getElementById('badgeProgress');
  const progressBarEl = document.getElementById('progressBar');
  const activityList = document.getElementById('activityList');

  if (peerTokenBalanceEl) peerTokenBalanceEl.textContent = '0';
  if (badgeCountEl) badgeCountEl.textContent = '0 earned';
  if (badgeGrid) badgeGrid.innerHTML = '<div class="badge-card empty-badge"><strong>Error loading badges</strong><p>Please refresh or try again later.</p></div>';
  if (badgeProgressEl) badgeProgressEl.innerHTML = '<span><strong>Error</strong></span><strong>0 / 0 PeerTokens</strong>';
  if (progressBarEl) progressBarEl.style.width = '0%';
  if (activityList) activityList.innerHTML = '<li style="color: #ef4444;">Unable to load activity data.</li>';
}

function buildRecentActivity(completedSessions, allSessions) {
  const activities = [];
  const sorted = completedSessions.sort((a, b) => {
    const aDate = a.rawDate || new Date(0);
    const bDate = b.rawDate || new Date(0);
    return bDate - aDate;
  });

  sorted.forEach((session) => {
    const role = session.isHelper ? '🤝 Helped' : '📚 Learned from';
    const tokens = session.isHelper ? 50 : 20;
    const ratingText = typeof session.rating === 'number' ? `, rated ${session.rating}/5` : '';
    activities.push(`${role} ${session.collaboratorName} (+${tokens} tokens${ratingText})`);
  });

  return activities;
}

async function fetchUserSessions(userId) {
  try {
    const requesterQuery = query(
      collection(db, 'matchRequests'),
      where('requesterId', '==', userId)
    );

    const ownerQuery = query(
      collection(db, 'matchRequests'),
      where('slotOwnerId', '==', userId)
    );

    const [requesterSnap, ownerSnap] = await Promise.all([getDocs(requesterQuery), getDocs(ownerQuery)]);
    const sessions = [];
    const collaboratorIds = new Set();

    // User was receiving help (requester)
    requesterSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      sessions.push(buildRewardSession(docSnap.id, data, false, data.slotOwnerId)); // isHelper = false
      if (data.slotOwnerId) collaboratorIds.add(data.slotOwnerId);
    });

    // User was helping (slot owner)
    ownerSnap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      sessions.push(buildRewardSession(docSnap.id, data, true, data.requesterId)); // isHelper = true
      if (data.requesterId) collaboratorIds.add(data.requesterId);
    });

    const collaboratorNames = await fetchNames(Array.from(collaboratorIds));
    sessions.forEach((session) => {
      session.collaboratorName = collaboratorNames[session.collaboratorId] || 'Peer';
    });

    return sessions;
  } catch (error) {
    console.error('Error fetching user sessions:', error);
    return [];
  }
}

function buildRewardSession(id, data, isHelper, collaboratorId) {
  const status = normalizeStatus(data.status);
  return {
    id,
    collaboratorId,
    collaboratorName: 'Peer',
    isHelper,  // true if user was the helper, false if user was receiving help
    status,
    completed: status === 'completed' || !!data.completedAt,
    rawDate: getDateObject(data.completedAt || data.updatedAt || data.createdAt),
    subject: data.slotSnapshot?.subject || 'General',
    rating: typeof data.rating === 'number' ? data.rating : null
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
  if (typeof value === 'number' || typeof value === 'string') return new Date(value);
  return null;
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
