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
        if (!data.read && data.senderId && window.markChatHighlighted) {
            window.markChatHighlighted(data.senderId);
        }
        const id = docSnap.id;
        const time = data.createdAt ? formatTimeAgo(data.createdAt.toDate()) : 'Recently';
        const isMatchRequest = data.type === 'match_request' && data.data?.matchRequestId;
        const isMatchAccepted = data.type === 'match_accepted';
        
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
                    ` : isMatchAccepted ? `
                        <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 8px; border-left: 3px solid #0084ff;">
                            <button class="btn-start-chat" data-peer-id="${data.senderId}" style="width: 100%; padding: 8px; border: none; background: #0084ff; color: white; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">Start chatting</button>
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

    list.querySelectorAll('.btn-start-chat').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            handleStartChat(btn.dataset.peerId);
        };
    });

    if (window.lucide) window.lucide.createIcons();
}

function handleStartChat(partnerId) {
    const user = auth.currentUser;
    if (!user) {
        window.location.href = 'dashboard.html';
        return;
    }

    const dropdown = document.querySelector('.notification-dropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
    }

    if (window.setCurrentChatUser) {
        window.setCurrentChatUser(partnerId);
    }

    if (window.loadChatList) {
        window.loadChatList(user.uid);
    }

    if (window.openChat) {
        window.openChat(partnerId, user.uid);
    } else {
        window.location.href = 'dashboard.html';
    }
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

        // 2. Update Match Request to a booked session state
        const slotRef = doc(db, "availabilitySlots", matchData.slotId);
        await updateDoc(slotRef, { 
            status: "booked",
            updatedAt: serverTimestamp()
        });

        await updateDoc(matchRef, {
            status: "booked",
            updatedAt: serverTimestamp()
        });

        // 5. Send "Say hi 👋" Message to start the chat
        // Structure: participants is an array of UIDs
        await addDoc(collection(db, "messages"), {
            text: "Say hi 👋",
            senderId: "system", // Mark as system to distinguish
            participants: [user.uid, matchData.requesterId],
            createdAt: new Date(),
            type: "system_intro"
        });

        // Tell dashboard which conversation should be active.
        if (window.setCurrentChatUser) {
            window.setCurrentChatUser(matchData.requesterId);
        }

        // Refresh chat list and open the new conversation if available.
        if (window.loadChatList) {
            window.loadChatList(user.uid);
        }
        if (window.openChat) {
            // Slight delay gives the chat list listener time to refresh.
            setTimeout(() => window.openChat(matchData.requesterId, user.uid), 100);
        }

        // 5. Update the notification in-place instead of marking as read
        const requesterSnap = await getDoc(doc(db, "users", matchData.requesterId));
        const requesterName = requesterSnap.exists() ? (requesterSnap.data().name || "A peer") : "A peer";
        
        await updateDoc(doc(db, "notifications", notifId), { 
            message: `You matched with ${requesterName}. Say hi!`,
            type: "match_accepted",
            updatedAt: serverTimestamp()
        });

        // 6. Notify the requester
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const senderName = userSnap.exists() ? (userSnap.data().name || "A peer") : "A peer";
        
        await addDoc(collection(db, "notifications"), {
            recipientId: matchData.requesterId,
            senderId: user.uid,
            type: "match_accepted",
            message: `${senderName} accepted your match request! You can now chat.`,
            read: false,
            createdAt: serverTimestamp()
        });
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
        case 'match_accepted': return 'check-circle';
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
