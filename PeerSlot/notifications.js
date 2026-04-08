import { auth, db } from "./firebase.js";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    getDoc,
    updateDoc,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Initialize notification system for the current user
 */
export function setupNotifications() {
    const user = auth.currentUser;
    if (!user) {
        console.warn("🔔 setupNotifications: No user logged in. Skipping.");
        return;
    }

    // Prevent double initialization
    if (document.querySelector('.bell-wrapper')) {
        console.log("🔔 setupNotifications: Already initialized.");
        return;
    }

    const bell = document.querySelector('.bell');
    if (!bell) {
        console.warn("🔔 setupNotifications: Bell icon not found in DOM.");
        return;
    }

    console.log(`🔔 setupNotifications: Starting listener for ${user.uid}`);

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
        console.log(`🔔 Notifications update: ${snapshot.docs.length} found`);
        renderNotifications(snapshot.docs);
        
        // Show badge if there are unread notifications
        const hasUnread = snapshot.docs.some(doc => !doc.data().read);
        if (hasUnread && !dropdown.classList.contains('show')) {
            badge.classList.add('show');
        } else if (!hasUnread) {
            badge.classList.remove('show');
        }
    }, (error) => {
        console.error("❌ Notification listener error:", error);
        if (error.code === 'failed-precondition') {
            console.error("👉 This usually means a Firestore Index is missing. Check the console for a link to fix it.");
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
        // Safety check for server timestamps that are null in local cache
        let time = 'Recently';
        try {
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                time = formatTimeAgo(data.createdAt.toDate());
            }
        } catch (e) {
            console.warn("Error formatting time for notification:", e);
        }

        const isMatchRequest = data.type === 'match_request' && !data.read && data.data?.matchRequestId;
        
        return `
            <div class="notification-item ${data.read ? '' : 'unread'}" data-id="${id}">
                <div class="notification-icon">
                    <i data-lucide="${getIconForType(data.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-message">${data.message}</div>
                    <div class="notification-time">${time}</div>
                    ${isMatchRequest ? `
                        <div class="notification-actions">
                            <button class="btn-accept" data-notif-id="${id}" data-match-id="${data.data.matchRequestId}">Accept</button>
                            <button class="btn-decline" data-notif-id="${id}" data-match-id="${data.data.matchRequestId}">Decline</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    // Add click events for marking as read (on the whole item)
    list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            if (e.target.tagName === 'BUTTON') return; // Don't mark as read if clicking buttons
            
            const id = item.dataset.id;
            const notificationRef = doc(db, "notifications", id);
            await updateDoc(notificationRef, { read: true });
        });
    });

    // Add action buttons logic
    list.querySelectorAll('.btn-accept').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            handleMatchAccept(btn.dataset.notifId, btn.dataset.matchId);
        };
    });

    list.querySelectorAll('.btn-decline').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            handleMatchDecline(btn.dataset.notifId, btn.dataset.matchId);
        };
    });

    if (window.lucide) window.lucide.createIcons();
}

/**
 * Handle Match Acceptance
 */
async function handleMatchAccept(notifId, matchId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // 1. Get Match Request Details
        const matchRef = doc(db, "matchRequests", matchId);
        const matchSnap = await getDoc(matchRef);
        if (!matchSnap.exists()) throw new Error("Match request not found");
        const matchData = matchSnap.data();

        // 2. Update Match Request
        await updateDoc(matchRef, { 
            status: "accepted",
            updatedAt: serverTimestamp()
        });

        // 3. Update Slot Status
        const slotRef = doc(db, "availabilitySlots", matchData.slotId);
        await updateDoc(slotRef, { 
            status: "booked", // Or "matched" based on project logic
            updatedAt: serverTimestamp()
        });

        // 4. Send "Say hi 👋" Message to start the chat
        // Structure: participants is an array of UIDs
        await addDoc(collection(db, "messages"), {
            text: "Say hi 👋",
            senderId: "system", // Mark as system to distinguish
            participants: [user.uid, matchData.requesterId],
            createdAt: serverTimestamp(),
            type: "system_intro"
        });

        // 5. Mark notification as read
        await updateDoc(doc(db, "notifications", notifId), { read: true });

        // 6. Notify the requester
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const senderName = userSnap.exists() ? (userSnap.data().name || "A peer") : "A peer";
        
        await addDoc(collection(db, "notifications"), {
            recipientId: matchData.requesterId,
            senderId: user.uid,
            type: "match_accept",
            message: `${senderName} accepted your match request! You can now chat.`,
            read: false,
            createdAt: serverTimestamp()
        });

        alert("Match accepted! Start chatting in the Dashboard.");
    } catch (error) {
        console.error("Error accepting match:", error);
        alert("Failed to accept match. It might have been deleted.");
    }
}

/**
 * Handle Match Decline
 */
async function handleMatchDecline(notifId, matchId) {
    try {
        await updateDoc(doc(db, "matchRequests", matchId), { 
            status: "rejected", 
            updatedAt: serverTimestamp() 
        });
        await updateDoc(doc(db, "notifications", notifId), { read: true });
        alert("Match request declined.");
    } catch (error) {
        console.error("Error declining match:", error);
    }
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

/**
 * Send a notification to the slot owner when someone requests a match
 */
export async function sendMatchRequestNotification(recipientId, senderName, subject, matchRequestId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        await addDoc(collection(db, "notifications"), {
            recipientId: recipientId,
            senderId: user.uid,
            type: "match_request",
            message: `${senderName} wants to match with you for ${subject}`,
            data: {
                matchRequestId: matchRequestId,
                subject: subject
            },
            read: false,
            createdAt: serverTimestamp()
        });
        console.log(`Sent match request notification to ${recipientId}`);
    } catch (error) {
        console.error("Error sending match request notification:", error);
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
