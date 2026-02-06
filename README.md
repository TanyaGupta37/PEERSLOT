# PEERSLOT
PeerSlot is a peer-to-peer academic support web platform designed for university students.
It helps students find the right peer for doubt-solving, study sessions, and academic collaboration in a structured, reliable, and secure way, instead of informal chats.

The platform uses Firebase Authentication and Firestore to manage users and profiles, and provides a clean dashboard experience with search, calendar, and session views.

---

## 🚀 Features

### Core Features
- **User Authentication**: Sign up/Login with MUJ university email verification
- **Profile Setup**: Complete academic profile with subjects, skills, and bio
- **Dashboard**: Clean, modern dashboard with stats and quick actions

### ✨ Availability Slot Management (NEW)
Complete CRUD functionality for managing availability slots:

- **Add Slots**: Set your available time slots for each day of the week
- **View Slots**: See all your slots organized by day with status indicators
- **Edit Slots**: Modify existing slots (day, start time, end time)
- **Delete Slots**: Remove slots you no longer need
- **View Peer Availability**: See when other peers are available (read-only)
- **Calendar Integration**: Slots automatically appear on your calendar

### Business Rules
The availability system enforces these rules:
| Rule | Value |
|------|-------|
| Minimum slot duration | 30 minutes |
| Maximum slot duration | 3 hours |
| Maximum slots per day | 5 |
| Maximum total slots | 20 |
| Available hours | 6:00 AM - 11:00 PM |
| Overlap prevention | ✓ Enforced |
| Booked slot protection | ✓ Cannot edit/delete |

---

## 🛠️ Tech Stack
- **Frontend**: HTML, CSS, JavaScript (ES Modules)
- **Backend**: Firebase Authentication, Firestore
- **Calendar**: FullCalendar.js
- **Icons**: Lucide Icons
- **Hosting (planned)**: Firebase Hosting / GitHub Pages

---

## 📁 Project Structure

```
PeerSlot/
├── index.html              # Landing page
├── login.html              # Login page
├── signup.html             # Sign up page
├── setup.html              # Profile setup
├── dashboard.html          # Main dashboard
├── 
├── firebase.js             # Firebase configuration
├── login.js                # Login logic
├── signup.js               # Signup logic
├── dashboard.js            # Dashboard logic
├── dashboard-calendar.js   # Calendar integration
├── 
├── availability.js         # Availability slot API & logic
├── availability-ui.js      # Availability UI controller
├── availability.css        # Availability styles
├── peer-availability.js    # Peer availability viewer
├── 
├── style.css               # Main styles
├── dashboard.css           # Dashboard-specific styles
├── 
├── availability-tests.js   # Test suite (browser)
├── test-node.js            # Test suite (Node.js)
└── test-runner.html        # Visual test runner
```

---

## 🏃 Running Project Locally

This project uses JavaScript ES modules and Firebase CDN imports, so it must be run through an HTTP server.
Opening the HTML files directly (file://) will not work.

### Method 1: Python (Recommended)
```bash
# Navigate to project folder
cd path/to/PeerSlot

# Start local server
python -m http.server 5500
# OR
python3 -m http.server 5500

# Open browser
http://localhost:5500/index.html
```

### Method 2: Node.js
```bash
npx http-server
# Open: http://localhost:8080
```

### Method 3: PHP
```bash
php -S localhost:8000
```

---

## 🧪 Running Tests

### Node.js (Recommended)
```bash
cd PeerSlot
node test-node.js
```

### Browser
1. Start local server
2. Open http://localhost:5500/test-runner.html
3. Click "Run All Tests"

### Test Coverage
- ✅ Utility functions (time conversion, formatting)
- ✅ Overlap detection algorithms
- ✅ Slot validation (all business rules)
- ✅ Update validation
- ✅ Edge cases (boundary times, max limits)

---

## 📖 Availability Slot API

### Data Structure
```javascript
{
  id: string,              // Auto-generated
  userId: string,          // Owner's UID
  day: string,             // 'Monday' | 'Tuesday' | ... | 'Sunday'
  startTime: string,       // 'HH:MM' 24-hour format
  endTime: string,         // 'HH:MM' 24-hour format
  duration: number,        // Minutes
  isRecurring: boolean,    // Weekly repeat
  status: string,          // 'available' | 'booked' | 'blocked'
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Functions

| Function | Description |
|----------|-------------|
| `createSlot(slotData)` | Add new availability slot |
| `fetchOwnSlots()` | Get current user's slots |
| `fetchOwnSlotsSorted()` | Get slots sorted by day/time |
| `updateSlot(slotId, updateData)` | Modify existing slot |
| `deleteSlot(slotId)` | Remove a slot |
| `fetchPeerAvailability(peerId)` | Get another user's available slots |
| `validateSlot(slotData, existingSlots)` | Validate slot against rules |
| `getSlotCount()` | Get slot statistics |

---

## 🎨 UI Components

### Add Slot Form
- Day selector (Monday - Sunday)
- Start time selector (6:00 AM - 11:00 PM, 30-min intervals)
- End time selector (auto-suggests based on start time)
- Add button with validation feedback

### Slot List
- Grouped by day
- Color-coded: Green (available), Blue (booked)
- Edit/Delete buttons for each slot
- Lock icon for booked slots

### Modals
- **Edit Modal**: Modify day, start/end time
- **Delete Modal**: Confirmation before deletion

### Toast Notifications
- Success/Error feedback for all actions
- Auto-dismiss after 3 seconds

---

## 👥 Contributors
- Built with ❤️ for MUJ students

---

## 📄 License
This project is for educational purposes.

