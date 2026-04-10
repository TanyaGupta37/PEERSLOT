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
});