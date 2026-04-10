# 🎯 PeerSlot Rewards System - Complete Documentation

## System Overview

The PeerSlot Rewards System automatically calculates PeerTokens and unlocks badges based on user participation in peer learning sessions.

### Core Metrics

- **Helping**: When a user helps another peer → **50 PeerTokens** earned
- **Receiving Help**: When a user receives help from a peer → **20 PeerTokens** earned
- **Total**: Combined tokens determine overall achievement level

---

## 📊 Badge System

### Category 1: Helping Badges (Helper Milestones)

| Tokens | Badge | Requirement | Session Count |
|--------|-------|-------------|----------------|
| 50+ | 🥉 Bronze Helper | Helped 1+ peer | 1 session |
| 150+ | 🥈 Silver Mentor | Helped 3+ peers | 3 sessions |
| 300+ | 🥇 Gold Expert | Helped 6+ peers | 6 sessions |
| 600+ | 💎 Platinum Authority | Helped 12+ peers | 12 sessions |
| 1000+ | 👑 Diamond Master | Helped 20+ peers | 20 sessions |

### Category 2: Learning Badges (Learner Milestones)

| Tokens | Badge | Requirement | Session Count |
|--------|-------|-------------|----------------|
| 20+ | 📚 Novice Learner | Received 1+ session | 1 session |
| 60+ | 🎓 Active Learner | Received 3+ sessions | 3 sessions |
| 120+ | ⭐ Super Learner | Received 6+ sessions | 6 sessions |
| 200+ | 🌟 Champion Learner | Received 10+ sessions | 10 sessions |

### Category 3: Total Achievement Badges

| Tokens | Badge | Requirement |
|--------|-------|-------------|
| 70+ | 🚀 Starter | 1 help + 1 learning session |
| 210+ | 📈 Climber | 3 helps + 3 learning sessions |
| 420+ | 🌍 Global Contributor | 6 helps + 6 learning sessions |
| 800+ | ⚡ Legendary | 12 helps + 10 learning sessions |

---

## 🔄 How Rewards Are Calculated

### Data Collection Process

1. **User visits Rewards page** → System loads user data
2. **Query matchRequests collection** for current user:
   - Sessions where `requesterId === userId` = User was **RECEIVING** help (20 tokens each)
   - Sessions where `slotOwnerId === userId` = User was **HELPING** (50 tokens each)
3. **Filter for completed sessions** (only count status: 'completed')
4. **Calculate totals**:
   - `helpingTokens` = number of helping sessions × 50
   - `receivingTokens` = number of receiving sessions × 20
   - `totalTokens` = helpingTokens + receivingTokens
5. **Determine badges** by comparing against milestone thresholds
6. **Update user document** with calculated values (for persistence)
7. **Display UI** with tokens, badges, and progress

### Retroactive Calculation

✨ **Important Feature**: The system automatically fetches and calculates rewards from **ALL previous sessions**, even if the user has never visited the Rewards page before. This means:

- All past helping sessions = credited with 50 tokens each
- All past learning sessions = credited with 20 tokens each
- User sees their complete earned rewards on first visit

---

## 📱 UI Components

### Rewards Page Elements

1. **PeerToken Balance Card**
   - Shows total PeerTokens earned
   - Shows number of badges unlocked
   - Example: "245 PeerTokens earned" | "5 badges"

2. **Badges Unlocked Grid**
   - Displays all earned badges with emoji
   - Shows badge title and tier requirement
   - Visual highlight for earned badges (blue background)
   - Empty state: "No badges yet" with encouragement

3. **Progress to Next Badge Panel**
   - Shows current badge being worked toward
   - Progress bar with percentage
   - Example: "🥈 Silver Mentor: 80 / 150 tokens (53%)"

4. **Recent Activity List**
   - Shows total tokens and breakdown
   - Lists helping vs learning token amounts
   - Shows recent completed sessions with token rewards
   - Example: "🤝 Helped John Smith (+50 tokens)"

---

## 💾 Database Structure

### User Document Updates

When rewards are calculated, the user document is updated with:

```javascript
{
  peerToken: 245,              // Total tokens earned
  helpingTokens: 150,          // Tokens from helping
  receivingTokens: 95,         // Tokens from learning
  helpingCount: 3,             // Number of helping sessions
  receivingCount: 4,           // Number of receiving sessions
  completedSessionsCount: 7    // Total completed sessions
}
```

---

## 📈 Example Scenarios

### Scenario 1: Active Helper
- **5 helping sessions** → 5 × 50 = 250 tokens
- **2 learning sessions** → 2 × 20 = 40 tokens
- **Total**: 290 tokens

**Badges Earned**:
- 🥉 Bronze Helper (50+ tokens)
- 🥈 Silver Mentor (150+ tokens)
- 📚 Novice Learner (20+ tokens)
- 🚀 Starter (70+ tokens)
- 📈 Climber (210+ tokens)

### Scenario 2: Dedicated Learner
- **2 helping sessions** → 2 × 50 = 100 tokens
- **8 learning sessions** → 8 × 20 = 160 tokens
- **Total**: 260 tokens

**Badges Earned**:
- 🥉 Bronze Helper (50+ tokens)
- 📚 Novice Learner (20+ tokens)
- 🎓 Active Learner (60+ tokens)
- ⭐ Super Learner (120+ tokens)
- 🚀 Starter (70+ tokens)
- 📈 Climber (210+ tokens)

### Scenario 3: Balanced Contributor
- **10 helping sessions** → 10 × 50 = 500 tokens
- **10 learning sessions** → 10 × 20 = 200 tokens
- **Total**: 700 tokens

**Badges Earned**: All badges up to 🌍 Global Contributor (except Legendary)

---

## 🛠️ Implementation Details

### Key Files Modified

1. **rewards.js** - Core reward calculation logic
   - `calculateUserRewards()` - Fetches sessions and calculates tokens
   - `getUnlockedBadges()` - Determines which badges are earned
   - `getNextBadgeMilestone()` - Calculates progress to next badge
   - `renderRewardData()` - Updates UI with calculated data

2. **rewards.html** - UI template with correct element IDs
   - `#peerTokenBalance` - Displays total tokens
   - `#badgeCount` - Displays number of badges
   - `#badgeGrid` - Container for badge cards
   - `#badgeProgress` - Shows next milestone
   - `#progressBar` - Visual progress indicator
   - `#activityList` - Shows recent activity

3. **rewards.css** - Styling for earned badges
   - `.badge-earned` - Blue gradient background for earned badges
   - `.empty-badge` - Dashed border for no badges state
   - Progress bar animations and colors

---

## ✨ Features

- ✅ Automatic token calculation from completed sessions
- ✅ 15 unique badges across 3 categories
- ✅ Retroactive calculation of all previous sessions
- ✅ Separate tracking of helping vs learning tokens
- ✅ Real-time progress to next milestone
- ✅ Session count tracking
- ✅ Recent activity with token amounts
- ✅ Persistent storage in Firestore
- ✅ Dynamic badge unlocking

---

## 🚀 How to Test

1. Open Rewards page (rewards.html)
2. Wait for data to load (1-2 seconds)
3. Verify:
   - ✓ Total PeerTokens displayed
   - ✓ Badges unlocked match your sessions
   - ✓ Progress bar shows next milestone
   - ✓ Activity list shows token breakdown
4. Check if all previous sessions were counted (retroactive)

---

## 📝 Notes

- Tokens are awarded **only for completed sessions** (status: 'completed')
- Badges unlock **automatically** when token threshold is reached
- User tokens are **reusable** across platform features (not consumed)
- System **updates on page load** - no manual refresh needed
- **Persistent storage** - tokens remain even after logout/login

