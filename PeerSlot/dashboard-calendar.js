document.addEventListener("DOMContentLoaded", () => {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridWeek",
    height: 380,

    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: ""
    },

    events: [
      {
        title: "DSA with Rohan",
        start: new Date().setHours(18, 0),
        end: new Date().setHours(19, 0),
        backgroundColor: "#2563eb",
        borderColor: "#2563eb"
      },
      {
        title: "Slot Pending: Ananya",
        start: new Date(new Date().setDate(new Date().getDate() + 1)),
        backgroundColor: "#f59e0b",
        borderColor: "#f59e0b"
      }
    ]
  });

  calendar.render();
});
