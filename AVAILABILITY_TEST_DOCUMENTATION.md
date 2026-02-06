# Availability Slot Management - Test Cases Documentation

## User Story
**As a** MUJ student  
**I want to** add and manage my availability slots  
**So that** others can see when I am free

---

## Acceptance Criteria & Implementation Status

### ✅ AC1: View own availability slots
**Given** a student is logged in  
**When** the availability section is opened  
**Then** all existing availability slots for the student are displayed

**Implementation:** `availability.html` - `renderSlots()` function
- Loads slots from Firebase on page load
- Displays slots grouped by date
- Shows count of total, available, and booked slots
- Real-time sync with calendar view

---

### ✅ AC2: Add a new availability slot
**Given** the student is on the availability management screen  
**When** a valid date, start time, and end time are added and saved  
**Then** the availability slot is created successfully

**Implementation:** `availability.html` - Add slot button event listener
- Date picker with minimum date validation (no past dates)
- Time selectors with 30-minute intervals
- Auto-suggests end time based on start time
- Saves to Firebase `availabilitySlots` collection
- Updates UI and calendar immediately

---

### ✅ AC3: Edit an existing availability slot
**Given** the student has existing availability slots  
**When** an availability slot is edited and saved  
**Then** the updated availability slot is reflected correctly

**Implementation:** `availability.html` - Edit modal with `saveEdit()` function
- Click edit icon to open modal
- Pre-fills current values
- Validates changes before saving
- Updates Firebase document
- Refreshes UI and calendar
- Cannot edit booked slots (locked with 🔒 icon)

---

### ✅ AC4: Delete an availability slot
**Given** the student has existing availability slots  
**When** an availability slot is deleted  
**Then** the slot is removed from the list

**Implementation:** `availability.html` - `deleteSlot()` function
- Click delete icon with confirmation dialog
- Removes from Firebase
- Updates UI and calendar
- Cannot delete booked slots

---

### ✅ AC5: Validate availability slot inputs
**Given** the student is adding or editing an availability slot  
**When** invalid inputs are provided (e.g., end time before start time)  
**Then** a validation error is shown and the slot is not saved

**Implementation:** `availability.html` - `validateSlot()` function

**Validation Rules:**
- ❌ Missing required fields (date, start time, end time)
- ❌ Past dates
- ❌ End time before or equal to start time
- ❌ Duration < 30 minutes
- ❌ Duration > 3 hours (180 minutes)
- ❌ Overlapping slots on same date
- ✅ All validations show user-friendly error messages via toast notifications

---

### ✅ AC6: Persist availability slots
**Given** availability slots have been saved  
**When** the page is refreshed or the student logs out and logs back in  
**Then** the saved availability slots are retained

**Implementation:** Firebase Firestore persistence
- All slots stored in `availabilitySlots` collection
- Indexed by `userId` and `date`
- Automatic persistence across sessions
- `onAuthStateChanged` loads user's slots on login

---

### ✅ AC7: View availability of another student
**Given** another student has added availability slots  
**When** their profile or availability is viewed  
**Then** their availability slots are visible in read-only mode

**Implementation:** `peer-availability-view.html`
- URL parameter: `?peerId=<userId>`
- Displays peer's name, avatar, and subjects
- Shows only available (not booked) slots
- Filters out past slots
- Read-only view with "Book" button placeholder
- Calendar integration showing peer's availability

---

## Test Cases

### ✅ TC-01: View existing availability slots
**Input:** Open availability management screen as a logged-in MUJ student  
**Expected Result:** All previously created availability slots are displayed

**Test Steps:**
1. Login to application
2. Navigate to Availability page
3. Verify slots list displays all user's slots
4. Verify slots are grouped by date
5. Verify calendar shows all slots as events

**Status:** ✅ PASS

---

### ✅ TC-02: Add a valid availability slot
**Input:** Enter a valid date, start time, and end time and click Save  
**Expected Result:** Availability slot is saved successfully and displayed in the list

**Test Steps:**
1. Select a future date (e.g., tomorrow)
2. Select start time (e.g., 2:00 PM)
3. Select end time (e.g., 3:30 PM)
4. Click "Add Slot" button
5. Verify success toast appears
6. Verify slot appears in list
7. Verify slot appears on calendar

**Status:** ✅ PASS

---

### ✅ TC-03: Edit an existing availability slot
**Input:** Edit date or time of an existing availability slot and click Save  
**Expected Result:** Updated availability slot details are saved and displayed

**Test Steps:**
1. Click edit icon on an available slot
2. Change date or time values
3. Click "Save Changes"
4. Verify success toast appears
5. Verify updated values in slot list
6. Verify updated event on calendar

**Status:** ✅ PASS

---

### ✅ TC-04: Delete an availability slot
**Input:** Delete an existing availability slot  
**Expected Result:** Availability slot is removed from the list

**Test Steps:**
1. Click delete icon on an available slot
2. Confirm deletion in dialog
3. Verify success toast appears
4. Verify slot removed from list
5. Verify event removed from calendar

**Status:** ✅ PASS

---

### ✅ TC-05: Validation – end time before start time
**Input:** Enter an availability slot where end time is before start time and click Save  
**Expected Result:** Validation error message is shown and slot is not saved

**Test Steps:**
1. Select date
2. Select start time: 3:00 PM
3. Select end time: 2:00 PM (before start)
4. Click "Add Slot"
5. Verify error toast: "End time must be after start time"
6. Verify slot is NOT added to list

**Status:** ✅ PASS

---

### ✅ TC-06: Validation – missing required fields
**Input:** Leave date, start time, or end time empty and click Save  
**Expected Result:** Validation error message is shown and slot is not saved

**Test Steps:**
1. Leave date empty, click "Add Slot"
   - Verify error: "Please fill all fields"
2. Select date, leave start time empty, click "Add Slot"
   - Verify error: "Please fill all fields"
3. Select date and start time, leave end time empty, click "Add Slot"
   - Verify error: "Please fill all fields"

**Status:** ✅ PASS

---

### ✅ TC-07: Availability persistence after refresh
**Input:** Save availability slots and refresh the browser  
**Expected Result:** Previously saved availability slots are retained

**Test Steps:**
1. Add 2-3 availability slots
2. Refresh the page (F5 or Ctrl+R)
3. Wait for page to load
4. Verify all slots are still displayed
5. Verify calendar shows all events

**Status:** ✅ PASS (Firebase persistence)

---

### ✅ TC-08: Availability persistence after logout/login
**Input:** Save availability slots, log out, and log back in  
**Expected Result:** Previously saved availability slots are still present

**Test Steps:**
1. Add 2-3 availability slots
2. Logout from application
3. Login again with same credentials
4. Navigate to Availability page
5. Verify all slots are still displayed
6. Verify calendar shows all events

**Status:** ✅ PASS (Firebase persistence)

---

### ✅ TC-09: View another student's availability
**Input:** Open another student's profile or availability view  
**Expected Result:** Other student's availability slots are visible in read-only mode

**Test Steps:**
1. Navigate to `peer-availability-view.html?peerId=<otherUserId>`
2. Verify peer's name and info displayed
3. Verify only available slots shown (no booked slots)
4. Verify no edit/delete buttons (read-only)
5. Verify "Book" button available for each slot
6. Verify calendar shows peer's availability

**Status:** ✅ PASS

---

## Additional Validation Test Cases

### ✅ TC-10: Validation – duration too short
**Input:** Create slot with duration < 30 minutes  
**Expected Result:** Error: "Minimum slot duration is 30 minutes"

**Test Steps:**
1. Select start time: 2:00 PM
2. Select end time: 2:15 PM (15 minutes)
3. Click "Add Slot"
4. Verify error message

**Status:** ✅ PASS

---

### ✅ TC-11: Validation – duration too long
**Input:** Create slot with duration > 3 hours  
**Expected Result:** Error: "Maximum slot duration is 3 hours"

**Test Steps:**
1. Select start time: 2:00 PM
2. Select end time: 6:00 PM (4 hours)
3. Click "Add Slot"
4. Verify error message

**Status:** ✅ PASS

---

### ✅ TC-12: Validation – overlapping slots
**Input:** Create slot that overlaps with existing slot on same date  
**Expected Result:** Error: "This slot overlaps with an existing slot"

**Test Steps:**
1. Add slot: Feb 10, 2:00 PM - 3:00 PM
2. Try to add: Feb 10, 2:30 PM - 3:30 PM
3. Verify error message
4. Verify second slot NOT added

**Status:** ✅ PASS

---

### ✅ TC-13: Validation – past date
**Input:** Try to create slot for a past date  
**Expected Result:** Error: "Cannot add slots for past dates"

**Test Steps:**
1. Select yesterday's date
2. Select valid times
3. Click "Add Slot"
4. Verify error message

**Status:** ✅ PASS

---

### ✅ TC-14: Cannot edit booked slots
**Input:** Try to edit a slot with status "booked"  
**Expected Result:** Edit button is disabled/hidden, lock icon shown

**Test Steps:**
1. View a booked slot in the list
2. Verify edit button is not present
3. Verify delete button is not present
4. Verify lock icon (🔒) is displayed

**Status:** ✅ PASS

---

## Database Schema

### Collection: `availabilitySlots`

```javascript
{
  id: string,              // Auto-generated document ID
  userId: string,          // User's Firebase Auth UID
  date: string,            // Format: "YYYY-MM-DD"
  startTime: string,       // Format: "HH:MM" (24-hour)
  endTime: string,         // Format: "HH:MM" (24-hour)
  status: string,          // "available" | "booked"
  createdAt: Timestamp,    // Firebase Timestamp
  updatedAt: Timestamp     // Firebase Timestamp
}
```

### Firestore Indexes Required

```
Collection: availabilitySlots
- userId (Ascending) + date (Ascending)
- userId (Ascending) + status (Ascending) + date (Ascending)
```

---

## Files Involved

| File | Purpose |
|------|---------|
| `availability.html` | Main availability management page (AC1-AC6, TC-01 to TC-08) |
| `peer-availability-view.html` | Peer availability viewer (AC7, TC-09) |
| `firebase.js` | Firebase configuration |
| `availability.css` | Styling for availability components |
| `style.css` | Global styles |

---

## API Functions (from availability.js)

| Function | Purpose |
|----------|---------|
| `loadUserSlots()` | Fetch user's slots from Firebase |
| `validateSlot()` | Validate slot data before save/update |
| `renderSlots()` | Display slots in UI |
| `updateCalendar()` | Sync slots with calendar |
| `addDoc()` | Create new slot in Firebase |
| `updateDoc()` | Update existing slot in Firebase |
| `deleteDoc()` | Delete slot from Firebase |

---

## Summary

✅ **All 14 Test Cases: PASS**  
✅ **All 7 Acceptance Criteria: Implemented**  
✅ **Firebase Persistence: Working**  
✅ **Validation: Complete**  
✅ **Read-Only Peer View: Implemented**

**Total Coverage:** 100%
