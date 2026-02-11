import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

/**
 * Listen to notifications for logged-in user
 */
export function listenToNotifications(userId) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    const container = document.getElementById("notifications");
    container.innerHTML = "";

    snapshot.forEach(docSnap => {
      const n = docSnap.data();

      const div = document.createElement("div");
      div.className = "notification-card";
      div.innerHTML = `
        <p><b>${n.fromUser}</b> needs help on <b>${n.topic}</b></p>
      `;

      container.appendChild(div);
    });
  });
}