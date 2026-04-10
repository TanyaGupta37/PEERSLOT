/**
 * Dashboard Calendar - Integrated with Availability Slots
 * Auto-syncs with availability changes in real-time
 */

let dashboardCalendar = null;

document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  // Initialize calendar using the Get Help calendar configuration
  dashboardCalendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    height: 500,

    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek"
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
    const { fetchOwnSlotsSorted, SLOT_STATUS, formatTimeDisplay, DAYS } = await import("./get-help.js");
    const { auth } = await import("./firebase.js");
    const { onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const slots = await fetchOwnSlotsSorted();

        // Clear existing events
        calendar.getEvents().forEach(event => event.remove());

        // Get current week dates
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

        // Add slots as events
        slots.forEach(slot => {
          let slotDate = null;

          if (slot.date) {
            const parsedDate = new Date(slot.date + "T00:00:00");
            if (!Number.isNaN(parsedDate.getTime())) {
              slotDate = parsedDate;
            }
          }

          if (!slotDate) {
            const dayIndex = DAYS.indexOf(slot.day);
            if (dayIndex === -1) return;

            slotDate = new Date(today);
            slotDate.setDate(today.getDate() + mondayOffset + dayIndex);
          }

          // Parse times
          const [startHour, startMin] = slot.startTime.split(":").map(Number);
          const [endHour, endMin] = slot.endTime.split(":").map(Number);

          const startDate = new Date(slotDate);
          startDate.setHours(startHour, startMin, 0);

          const endDate = new Date(slotDate);
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
 * Add fallback static events if dynamic loading fails
 */
function addFallbackEvents(calendar) {
  calendar.addEvent({
    title: "DSA with Rohan",
    start: new Date().setHours(18, 0),
    end: new Date().setHours(19, 0),
    backgroundColor: "#2563eb",
    borderColor: "#2563eb"
  });

  calendar.addEvent({
    title: "Slot Pending: Ananya",
    start: new Date(new Date().setDate(new Date().getDate() + 1)),
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b"
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

