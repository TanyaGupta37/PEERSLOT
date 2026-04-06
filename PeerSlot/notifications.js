import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getNotificationHref } from "./notification-service.js";

const els = {
  list: document.getElementById("notifications-list"),
  empty: document.getElementById("notifications-empty"),
  avatar: document.getElementById("avatar"),
  avatarDropdown: document.getElementById("avatarDropdown")
};

function formatWhen(ts) {
  if (!ts || typeof ts.toDate !== "function") return "";
  return ts.toDate().toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function actionLabel(action) {
  if (action === "offer_help") return "Offer Help";
  if (action === "get_help") return "Get Help";
  if (action === "chat") return "Chat";
  return "Open";
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let unsubscribe = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, "users", user.uid, "notifications"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  unsubscribe = onSnapshot(
    q,
    (snap) => {
      if (!els.list || !els.empty) return;

      if (snap.empty) {
        els.list.innerHTML = "";
        els.empty.style.display = "block";
        return;
      }

      els.empty.style.display = "none";

      els.list.innerHTML = snap.docs
        .map((d) => {
          const n = d.data();
          const href = getNotificationHref(n.action, n.relatedUserId);
          const unread = !n.read;
          return `
            <article class="notif-card ${unread ? "notif-unread" : ""}" data-id="${d.id}">
              <div class="notif-card__top">
                <h3 class="notif-card__title">${escapeHtml(n.title || "Notification")}</h3>
                <time class="notif-card__time">${escapeHtml(formatWhen(n.createdAt))}</time>
              </div>
              <p class="notif-card__body">${escapeHtml(n.body || "")}</p>
              <div class="notif-card__actions">
                <a class="notif-card__link btn-notif-primary" href="${href}">${escapeHtml(actionLabel(n.action))}</a>
              </div>
            </article>
          `;
        })
        .join("");

      els.list.querySelectorAll(".notif-card__link").forEach((link) => {
        link.addEventListener("click", async (e) => {
          const card = e.target.closest(".notif-card");
          const id = card?.getAttribute("data-id");
          if (!id) return;
          try {
            await updateDoc(doc(db, "users", user.uid, "notifications", id), {
              read: true
            });
          } catch (err) {
            console.error(err);
          }
        });
      });
    },
    (err) => {
      console.error(err);
      if (els.list) {
        els.list.innerHTML =
          '<p class="notif-error">Could not load notifications. If this is the first time, deploy Firestore indexes and security rules.</p>';
      }
    }
  );
});

/* Avatar dropdown (same pattern as profile) */
if (els.avatar && els.avatarDropdown) {
  els.avatar.addEventListener("click", (e) => {
    e.stopPropagation();
    els.avatarDropdown.classList.toggle("show");
  });

  document.addEventListener("click", (e) => {
    if (!els.avatar.contains(e.target) && !els.avatarDropdown.contains(e.target)) {
      els.avatarDropdown.classList.remove("show");
    }
  });

  els.avatarDropdown.addEventListener("click", (e) => {
    const item = e.target.closest("[data-action]");
    if (!item) return;
    els.avatarDropdown.classList.remove("show");
    const action = item.dataset.action;
    if (action === "profile") window.location.href = "profile.html";
    if (action === "settings") window.location.href = "settings.html";
    if (action === "logout") {
      import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ signOut }) =>
        signOut(auth).then(() => {
          window.location.href = "login.html";
        })
      );
    }
  });
}
