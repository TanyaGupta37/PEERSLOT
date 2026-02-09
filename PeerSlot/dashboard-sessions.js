/**
 * Dashboard Sessions - Display upcoming booked sessions from availability slots
 */

import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { fetchOwnSlotsSorted, SLOT_STATUS, formatTimeDisplay, DAYS } from "./availability.js";

/**
 * Get relative day label (Today, Tomorrow, or day name)
 */
function getRelativeDayLabel(slotDay) {
    const today = new Date();
    const todayDayName = DAYS[today.getDay() === 0 ? 6 : today.getDay() - 1]; // Convert Sunday=0 to Sunday=6

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDayName = DAYS[tomorrow.getDay() === 0 ? 6 : tomorrow.getDay() - 1];

    if (slotDay === todayDayName) return 'Today';
    if (slotDay === tomorrowDayName) return 'Tomorrow';
    return slotDay;
}

/**
 * Load and display upcoming booked sessions
 */
export async function loadUpcomingSessions() {
    const sessionsContainer = document.getElementById('sessions');
    if (!sessionsContainer) return;

    try {
        const slots = await fetchOwnSlotsSorted();

        // Filter only booked slots
        const bookedSlots = slots.filter(s => s.status === SLOT_STATUS.BOOKED);

        if (bookedSlots.length === 0) {
            sessionsContainer.innerHTML = `
        <h3>Upcoming Sessions</h3>
        <div style="color: #94a3b8; padding: 16px; text-align: center; font-size: 0.9rem;">
          <p style="margin-bottom: 8px;">No upcoming sessions booked yet</p>
          <p style="font-size: 0.85rem; color: #cbd5e1;">Your booked availability slots will appear here</p>
        </div>
      `;
            return;
        }

        let html = '<h3>Upcoming Sessions</h3>';

        // Show up to 5 upcoming sessions
        bookedSlots.slice(0, 5).forEach(slot => {
            const dayLabel = getRelativeDayLabel(slot.day);
            const timeStart = formatTimeDisplay(slot.startTime);
            const timeEnd = formatTimeDisplay(slot.endTime);

            html += `
        <div class="session">
          <strong>Session on ${slot.day}</strong><br>
          ${dayLabel} · ${timeStart} - ${timeEnd} · Confirmed
        </div>
      `;
        });

        sessionsContainer.innerHTML = html;

    } catch (err) {
        console.error("Error loading upcoming sessions:", err);
        sessionsContainer.innerHTML = `
      <h3>Upcoming Sessions</h3>
      <div style="color: #f87171; padding: 16px; text-align: center; font-size: 0.9rem;">
        Failed to load sessions
      </div>
    `;
    }
}

/**
 * Initialize sessions display
 */
export function initDashboardSessions() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        // Load initial sessions
        await loadUpcomingSessions();

        // Listen for availability slot changes and reload
        window.addEventListener('availabilitySlotsChanged', () => {
            loadUpcomingSessions();
        });
    });
}
