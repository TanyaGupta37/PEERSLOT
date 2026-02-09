/**
 * Dashboard Calendar - Integrated with Availability Slots
 * Auto-syncs with availability changes in real-time
 */

let dashboardCalendar = null;

document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // Initialize calendar with basic view first
  dashboardCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridWeek",
    height: 380,

    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: ""
    },

    events: [],

    eventClick: function (info) {
      // Show event details on click
      const event = info.event;
      alert(`${event.title}\n${event.extendedProps.time || ""}`);
    }
  });

  dashboardCalendar.render();

  // Load availability slots after calendar is rendered
  loadAvailabilityToCalendar(dashboardCalendar);

  // Listen for availability slot changes and refresh calendar
  window.addEventListener('availabilitySlotsChanged', (event) => {
    console.log('Availability slots changed, refreshing calendar...');
    loadAvailabilityToCalendar(dashboardCalendar);
  });
});

/**
 * Load user's availability slots and display on calendar
 */
async function loadAvailabilityToCalendar(calendar) {
  try {
    // Import availability functions dynamically
    const { fetchOwnSlotsSorted, SLOT_STATUS, formatTimeDisplay } = await import("./availability.js");
    const { auth } = await import("./firebase.js");
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const slots = await fetchOwnSlotsSorted();

        // Clear existing events
        calendar.getEvents().forEach(event => event.remove());

        // Add slots as events
        slots.forEach(slot => {
          // Parse times
          const [startHour, startMin] = slot.startTime.split(":").map(Number);
          const [endHour, endMin] = slot.endTime.split(":").map(Number);

          // Use the slot's date directly
          const startDate = new Date(slot.date + 'T00:00:00');
          startDate.setHours(startHour, startMin, 0);

          const endDate = new Date(slot.date + 'T00:00:00');
          endDate.setHours(endHour, endMin, 0);

          // Determine color based on status
          let backgroundColor, borderColor;
          if (slot.status === "booked") {
            backgroundColor = "#2563eb"; // Blue for booked
            borderColor = "#1d4ed8";
          } else {
            backgroundColor = "#16a34a"; // Green for available
            borderColor = "#15803d";
          }

          calendar.addEvent({
            title: slot.status === "booked" ? "Booked" : "Available",
            start: startDate,
            end: endDate,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            extendedProps: {
              slotId: slot.id,
              status: slot.status,
              time: `${formatTimeDisplay(slot.startTime)} - ${formatTimeDisplay(slot.endTime)}`
            }
          });
        });

      } catch (err) {
        console.error("Error loading slots to calendar:", err);
      }
    });

  } catch (err) {
    console.error("Error setting up calendar integration:", err);
    // Fallback to static events if modules fail to load
    addFallbackEvents(calendar);
  }
}

/**
 * Add fallback message if dynamic loading fails
 */
function addFallbackEvents(calendar) {
  // Show a subtle background event with helpful message
  const today = new Date();
  calendar.addEvent({
    title: "Add your availability slots →",
    start: today,
    allDay: true,
    display: 'background',
    backgroundColor: '#f0f9ff',
    borderColor: '#bfdbfe',
    classNames: ['availability-hint']
  });
}

/**
 * Export function to manually refresh calendar (if needed)
 */
window.refreshDashboardCalendar = function () {
  if (dashboardCalendar) {
    loadAvailabilityToCalendar(dashboardCalendar);
  }
};
