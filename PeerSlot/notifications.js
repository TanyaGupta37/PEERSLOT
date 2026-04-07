import { auth, db } from "./firebase.js";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Initialize notification system for the current user
 */
export function setupNotifications() {
    const user = auth.currentUser;
    if (!user) return;

    const bell = document.querySelector('.bell');
    if (!bell) return;

    // Wrap bell in a relative container for absolute positioning of dropdown
    const wrapper = document.createElement('div');
    wrapper.className = 'bell-wrapper';
    bell.parentNode.insertBefore(wrapper, bell);
    wrapper.appendChild(bell);

    const badge = document.createElement('div');
    badge.className = 'bell-badge';
    bell.appendChild(badge);

    const dropdown = document.createElement('div');
    dropdown.className = 'notification-dropdown';
    dropdown.innerHTML = `
        <div class="notification-header">
            <h3>Notifications</h3>
        </div>
        <div class="notification-list" id="notification-list">
            <div class="notification-empty">
                <p>No notifications yet</p>
            </div>
        </div>
    `;
    wrapper.appendChild(dropdown);

    // Toggle dropdown
    bell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        // Hide badge when opening
        if (dropdown.classList.contains('show')) {
            badge.classList.remove('show');
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Real-time listener
    const q = query(
        collection(db, "notifications"),
        where("recipientId", "==", user.uid),
        orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snapshot) => {
        renderNotifications(snapshot.docs);
        
        // Show badge if there are unread notifications
        const hasUnread = snapshot.docs.some(doc => !doc.data().read);
        if (hasUnread && !dropdown.classList.contains('show')) {
            badge.classList.add('show');
        } else if (!hasUnread) {
            badge.classList.remove('show');
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Render notification list
 */
function renderNotifications(docs) {
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (docs.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i data-lucide="bell-off" style="width: 32px; height: 32px; color: #cbd5e1; margin-bottom: 8px;"></i>
                <p>No notifications yet</p>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    list.innerHTML = docs.map(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const time = data.createdAt ? formatTimeAgo(data.createdAt.toDate()) : 'Recently';
        
        return `
            <div class="notification-item ${data.read ? '' : 'unread'}" data-id="${id}">
                <div class="notification-icon">
                    <i data-lucide="${getIconForType(data.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-message">${data.message}</div>
                    <div class="notification-time">${time}</div>
                </div>
            </div>
        `;
    }).join('');

    // Add click events to mark as read
    list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const notificationRef = doc(db, "notifications", id);
            await updateDoc(notificationRef, { read: true });
            
            // If it has a slotId, maybe navigate?
            // For now just mark as read
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Global function to send a notification to relevant users
 */
export async function sendHelpRequestNotification(senderName, subject, slotId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // 1. Find users who have this subject in their profile
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("subjects", "array-contains", subject));
        const snapshot = await getDocs(q);

        const notificationPromises = snapshot.docs
            .filter(doc => doc.id !== user.uid) // Don't notify self
            .map(doc => {
                return addDoc(collection(db, "notifications"), {
                    recipientId: doc.id,
                    senderId: user.uid,
                    type: "help_request",
                    message: `${senderName} is looking for help with ${subject}`,
                    data: {
                        slotId: slotId,
                        subject: subject
                    },
                    read: false,
                    createdAt: serverTimestamp()
                });
            });

        await Promise.all(notificationPromises);
        console.log(`Sent ${notificationPromises.length} notifications for ${subject}`);
    } catch (error) {
        console.error("Error sending notifications:", error);
    }
}

function getIconForType(type) {
    switch (type) {
        case 'help_request': return 'help-circle';
        case 'match_accept': return 'check-circle';
        default: return 'bell';
    }
}

function formatTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return "just now";
}
