import {
  collection,
  addDoc,
  getDocs,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

/**
 * Create help request and notify peers
 */
export async function createHelpRequest(topic, date, currentUser) {
  // 1️⃣ Save help request
  const helpRef = await addDoc(collection(db, "helpRequests"), {
    userId: currentUser.uid,
    topic,
    date,
    createdAt: Timestamp.now()
  });

  // 2️⃣ Get all users
  const usersSnapshot = await getDocs(collection(db, "users"));

  usersSnapshot.forEach(async (userDoc) => {
    const user = userDoc.data();

    if (
      user.uid !== currentUser.uid &&
      user.expertise?.some(skill =>
        topic.toLowerCase().includes(skill.toLowerCase())
      )
    ) {
      // 3️⃣ Create notification
      await addDoc(collection(db, "notifications"), {
        userId: user.uid,
        topic,
        helpRequestId: helpRef.id,
        fromUser: currentUser.name,
        read: false,
        createdAt: Timestamp.now()
      });
    }
  });
}