window.addEventListener('DOMContentLoaded', () => {
  const userSessions = [
    { subject: 'DSA', collaborator: 'Rohan', date: '2026-04-05', type: 'helped', status: 'completed', rating: 4.9 },
    { subject: 'ML', collaborator: 'Ananya', date: '2026-04-05', type: 'received', status: 'completed', rating: 4.7 },
    { subject: 'OS', collaborator: 'Kiran', date: '2026-04-06', type: 'helped', status: 'completed', rating: 4.8 },
    { subject: 'DSA', collaborator: 'Neha', date: '2026-04-07', type: 'helped', status: 'completed', rating: 4.8 },
    { subject: 'ML', collaborator: 'Priya', date: '2026-04-07', type: 'received', status: 'completed', rating: 4.6 },
    { subject: 'OS', collaborator: 'Rohan', date: '2026-04-08', type: 'received', status: 'completed', rating: 4.9 },
    { subject: 'DSA', collaborator: 'Kiran', date: '2026-04-09', type: 'helped', status: 'completed', rating: 4.8 },
    { subject: 'ML', collaborator: 'Ananya', date: '2026-04-10', type: 'received', status: 'completed', rating: 4.7 },
    { subject: 'OS', collaborator: 'Neha', date: '2026-04-10', type: 'helped', status: 'completed', rating: 4.8 },
    { subject: 'DSA', collaborator: 'Priya', date: '2026-04-11', type: 'received', status: 'booked', rating: null },
    { subject: 'ML', collaborator: 'Rohan', date: '2026-04-12', type: 'helped', status: 'pending', rating: null },
    { subject: 'OS', collaborator: 'Kiran', date: '2026-04-13', type: 'received', status: 'booked', rating: null }
  ];

  const totalSessions = userSessions.length;
  const completedSessions = userSessions.filter(session => session.status === 'completed').length;
  const averageRating = (
    userSessions
      .filter(session => session.rating !== null)
      .reduce((sum, session) => sum + session.rating, 0) /
    userSessions.filter(session => session.rating !== null).length
  ).toFixed(1);

  document.getElementById('totalSessions').textContent = totalSessions;
  document.getElementById('completedSessions').textContent = completedSessions;
  document.getElementById('avgRating').textContent = averageRating;

  const upcomingList = document.getElementById('upcomingList');
  const upcomingSessions = userSessions
    .filter(session => session.status === 'booked' || session.status === 'pending')
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  upcomingSessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.innerHTML = `
      <strong>${session.subject} with ${session.collaborator}</strong>
      <span>${session.date} · ${session.status.charAt(0).toUpperCase() + session.status.slice(1)}</span>
    `;
    upcomingList.appendChild(item);
  });

  const collaboratorCounts = userSessions.reduce((acc, session) => {
    acc[session.collaborator] = (acc[session.collaborator] || 0) + 1;
    return acc;
  }, {});

  const topCollaborators = Object.entries(collaboratorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  const collaboratorsContainer = document.getElementById('topCollaborators');
  topCollaborators.forEach(([name, count]) => {
    const item = document.createElement('div');
    item.className = 'collaborator-item';
    item.innerHTML = `
      <strong>${name}</strong>
      <span>${count} session${count > 1 ? 's' : ''}</span>
    `;
    collaboratorsContainer.appendChild(item);
  });

  const subjectCounts = userSessions.reduce((acc, session) => {
    acc[session.subject] = (acc[session.subject] || 0) + 1;
    return acc;
  }, {});

  const helpStats = userSessions.reduce((acc, session) => {
    acc[session.type] = (acc[session.type] || 0) + 1;
    return acc;
  }, { helped: 0, received: 0 });

  const allDates = userSessions.map(session => session.date);
  const minDate = new Date(Math.min(...allDates.map(date => new Date(date))));
  const weekLabels = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(minDate);
    date.setDate(minDate.getDate() + i);
    weekLabels.push(date.toISOString().slice(0, 10));
  }

  const sessionsByDay = weekLabels.map(label =>
    userSessions.filter(session => session.date === label).length
  );

  new Chart(document.getElementById('sessionsWeekChart'), {
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

  new Chart(document.getElementById('subjectChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(subjectCounts),
      datasets: [{
        data: Object.values(subjectCounts),
        backgroundColor: ['#2563eb', '#10b981', '#f97316', '#8b5cf6']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  new Chart(document.getElementById('helpChart'), {
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
});