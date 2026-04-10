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

  const ctx = document.getElementById('sessionChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Booked',
            data: [1, 2, 1, 3, 2, 1, 2],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.18)',
            tension: 0.35,
            fill: true
          },
          {
            label: 'Completed',
            data: [0, 1, 1, 2, 2, 1, 1],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.18)',
            tension: 0.35,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }
});