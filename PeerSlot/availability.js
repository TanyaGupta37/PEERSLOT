/**
 * ============================================
 * PEERSLOT - AVAILABILITY SLOT MODULE
 * ============================================
 * 
 * AVAILABILITY SLOT STRUCTURE:
 * {
 *   id: string (auto-generated),
 *   userId: string (owner's UID),
 *   day: string ('Monday' | 'Tuesday' | ... | 'Sunday'),
 *   startTime: string ('HH:MM' 24-hour format),
 *   endTime: string ('HH:MM' 24-hour format),
 *   duration: number (minutes),
 *   isRecurring: boolean (weekly repeat),
 *   status: string ('available' | 'booked' | 'blocked'),
 *   createdAt: Timestamp,
 *   updatedAt: Timestamp
 * }
 * 
 * BUSINESS RULES:
 * 1. Minimum slot duration: 30 minutes
 * 2. Maximum slot duration: 3 hours (180 minutes)
 * 3. Maximum slots per day: 5
 * 4. Maximum total slots per user: 20
 * 5. No overlapping slots allowed for same user
 * 6. Slots must be within 6:00 AM - 11:00 PM
 * 7. Cannot delete/edit booked slots
 * 8. End time must be after start time
 */

import { auth, db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ============================================
// CONSTANTS & BUSINESS RULES
// ============================================

export const DAYS = [
  "Monday", "Tuesday", "Wednesday", "Thursday",
  "Friday", "Saturday", "Sunday"
];

export const TIME_SLOTS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00", "22:30", "23:00"
];

export const BUSINESS_RULES = {
  MIN_DURATION_MINUTES: 30,
  MAX_DURATION_MINUTES: 180,
  MAX_SLOTS_PER_DAY: 5,
  MAX_TOTAL_SLOTS: 20,
  EARLIEST_TIME: "06:00",
  LATEST_TIME: "23:00"
};

export const SLOT_STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  BLOCKED: "blocked"
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert time string to minutes from midnight
 */
export function timeToMinutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

/**
 * Convert minutes from midnight to time string
 */
export function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Format time for display (12-hour format)
 */
export function formatTimeDisplay(time) {
  const [hours, mins] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

/**
 * Get short day name
 */
export function getShortDay(day) {
  return day.substring(0, 3);
}

/**
 * Calculate duration between two times in minutes
 */
export function calculateDuration(startTime, endTime) {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

/**
 * Check if two time ranges overlap
 */
export function timesOverlap(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate slot data against business rules
 * Returns { valid: boolean, error: string | null }
 */
export function validateSlot(slotData, existingSlots = []) {
  const { day, startTime, endTime } = slotData;

  // Check required fields
  if (!day || !startTime || !endTime) {
    return { valid: false, error: "Please fill all fields" };
  }

  // Validate day
  if (!DAYS.includes(day)) {
    return { valid: false, error: "Invalid day selected" };
  }

  // Validate time format
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    return { valid: false, error: "Invalid time format" };
  }

  // Check time bounds
  if (startTime < BUSINESS_RULES.EARLIEST_TIME) {
    return { valid: false, error: `Slots cannot start before ${formatTimeDisplay(BUSINESS_RULES.EARLIEST_TIME)}` };
  }

  if (endTime > BUSINESS_RULES.LATEST_TIME) {
    return { valid: false, error: `Slots cannot end after ${formatTimeDisplay(BUSINESS_RULES.LATEST_TIME)}` };
  }

  // Check end time is after start time
  const duration = calculateDuration(startTime, endTime);
  if (duration <= 0) {
    return { valid: false, error: "End time must be after start time" };
  }

  // Check minimum duration
  if (duration < BUSINESS_RULES.MIN_DURATION_MINUTES) {
    return { valid: false, error: `Minimum slot duration is ${BUSINESS_RULES.MIN_DURATION_MINUTES} minutes` };
  }

  // Check maximum duration
  if (duration > BUSINESS_RULES.MAX_DURATION_MINUTES) {
    return { valid: false, error: `Maximum slot duration is ${BUSINESS_RULES.MAX_DURATION_MINUTES / 60} hours` };
  }

  // Check total slots limit
  if (existingSlots.length >= BUSINESS_RULES.MAX_TOTAL_SLOTS) {
    return { valid: false, error: `Maximum ${BUSINESS_RULES.MAX_TOTAL_SLOTS} slots allowed` };
  }

  // Check slots per day limit
  const slotsOnDay = existingSlots.filter(s => s.day === day);
  if (slotsOnDay.length >= BUSINESS_RULES.MAX_SLOTS_PER_DAY) {
    return { valid: false, error: `Maximum ${BUSINESS_RULES.MAX_SLOTS_PER_DAY} slots per day` };
  }

  // Check for overlapping slots
  for (const slot of slotsOnDay) {
    if (timesOverlap(startTime, endTime, slot.startTime, slot.endTime)) {
      return { 
        valid: false, 
        error: `Overlaps with existing slot: ${getShortDay(slot.day)} ${formatTimeDisplay(slot.startTime)} - ${formatTimeDisplay(slot.endTime)}` 
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validate slot for update (excludes current slot from overlap check)
 */
export function validateSlotUpdate(slotData, existingSlots, currentSlotId) {
  const filteredSlots = existingSlots.filter(s => s.id !== currentSlotId);
  return validateSlot(slotData, filteredSlots);
}

// ============================================
// FIRESTORE API FUNCTIONS
// ============================================

/**
 * Create a new availability slot
 */
export async function createSlot(slotData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Fetch existing slots for validation
  const existingSlots = await fetchOwnSlots();
  
  // Validate
  const validation = validateSlot(slotData, existingSlots);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const duration = calculateDuration(slotData.startTime, slotData.endTime);

  const newSlot = {
    userId: user.uid,
    day: slotData.day,
    startTime: slotData.startTime,
    endTime: slotData.endTime,
    duration: duration,
    isRecurring: slotData.isRecurring ?? true,
    status: SLOT_STATUS.AVAILABLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, "availabilitySlots"), newSlot);
  
  return {
    id: docRef.id,
    ...newSlot,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Fetch current user's availability slots
 */
export async function fetchOwnSlots() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const q = query(
    collection(db, "availabilitySlots"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Fetch slots sorted by day and time for display
 */
export async function fetchOwnSlotsSorted() {
  const slots = await fetchOwnSlots();
  
  // Sort by day order, then by start time
  return slots.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

/**
 * Update an existing availability slot
 */
export async function updateSlot(slotId, updateData) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Fetch the slot to verify ownership and status
  const slotRef = doc(db, "availabilitySlots", slotId);
  const slotSnap = await getDoc(slotRef);

  if (!slotSnap.exists()) {
    throw new Error("Slot not found");
  }

  const slot = slotSnap.data();

  if (slot.userId !== user.uid) {
    throw new Error("You can only edit your own slots");
  }

  if (slot.status === SLOT_STATUS.BOOKED) {
    throw new Error("Cannot edit a booked slot");
  }

  // Fetch all slots for overlap validation
  const existingSlots = await fetchOwnSlots();
  
  // Merge update data with existing slot
  const newSlotData = {
    day: updateData.day ?? slot.day,
    startTime: updateData.startTime ?? slot.startTime,
    endTime: updateData.endTime ?? slot.endTime
  };

  // Validate the update
  const validation = validateSlotUpdate(newSlotData, existingSlots, slotId);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const duration = calculateDuration(newSlotData.startTime, newSlotData.endTime);

  await updateDoc(slotRef, {
    ...newSlotData,
    duration: duration,
    isRecurring: updateData.isRecurring ?? slot.isRecurring,
    updatedAt: serverTimestamp()
  });

  return {
    id: slotId,
    ...slot,
    ...newSlotData,
    duration: duration,
    updatedAt: new Date()
  };
}

/**
 * Delete an availability slot
 */
export async function deleteSlot(slotId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  const slotRef = doc(db, "availabilitySlots", slotId);
  const slotSnap = await getDoc(slotRef);

  if (!slotSnap.exists()) {
    throw new Error("Slot not found");
  }

  const slot = slotSnap.data();

  if (slot.userId !== user.uid) {
    throw new Error("You can only delete your own slots");
  }

  if (slot.status === SLOT_STATUS.BOOKED) {
    throw new Error("Cannot delete a booked slot. Please cancel the booking first.");
  }

  await deleteDoc(slotRef);

  return { success: true, deletedId: slotId };
}

/**
 * Fetch peer's available slots (read-only)
 */
export async function fetchPeerAvailability(peerId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  if (peerId === user.uid) {
    throw new Error("Cannot view your own availability as peer");
  }

  const q = query(
    collection(db, "availabilitySlots"),
    where("userId", "==", peerId),
    where("status", "==", SLOT_STATUS.AVAILABLE)
  );

  const snapshot = await getDocs(q);
  
  const slots = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Sort by day and time
  return slots.sort((a, b) => {
    const dayDiff = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
  });
}

/**
 * Get a single slot by ID
 */
export async function getSlotById(slotId) {
  const slotRef = doc(db, "availabilitySlots", slotId);
  const slotSnap = await getDoc(slotRef);

  if (!slotSnap.exists()) {
    return null;
  }

  return {
    id: slotSnap.id,
    ...slotSnap.data()
  };
}

/**
 * Get slots count for the current user
 */
export async function getSlotCount() {
  const slots = await fetchOwnSlots();
  return {
    total: slots.length,
    byDay: DAYS.reduce((acc, day) => {
      acc[day] = slots.filter(s => s.day === day).length;
      return acc;
    }, {}),
    available: slots.filter(s => s.status === SLOT_STATUS.AVAILABLE).length,
    booked: slots.filter(s => s.status === SLOT_STATUS.BOOKED).length
  };
}
