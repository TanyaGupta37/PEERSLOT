/**
 * ============================================
 * PEERSLOT - NODE.JS TEST RUNNER
 * ============================================
 * Run with: node test-node.js
 */

// Mock browser globals
global.window = {};

// ============================================
// IMPORT CORE LOGIC (copied for Node.js compatibility)
// ============================================

const DAYS = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday"
];

const TIME_SLOTS = [
    "06:00", "06:30", "07:00", "07:30", "08:00", "08:30",
    "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
    "21:00", "21:30", "22:00", "22:30", "23:00"
];

const BUSINESS_RULES = {
    MIN_DURATION_MINUTES: 30,
    MAX_DURATION_MINUTES: 180,
    MAX_SLOTS_PER_DAY: 5,
    MAX_TOTAL_SLOTS: 20,
    EARLIEST_TIME: "06:00",
    LATEST_TIME: "23:00"
};

const SLOT_STATUS = {
    AVAILABLE: "available",
    BOOKED: "booked",
    BLOCKED: "blocked"
};

// Utility functions
function timeToMinutes(time) {
    const [hours, mins] = time.split(":").map(Number);
    return hours * 60 + mins;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

function formatTimeDisplay(time) {
    const [hours, mins] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${mins.toString().padStart(2, "0")} ${period}`;
}

function getShortDay(day) {
    return day.substring(0, 3);
}

function calculateDuration(startTime, endTime) {
    return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function timesOverlap(start1, end1, start2, end2) {
    const s1 = timeToMinutes(start1);
    const e1 = timeToMinutes(end1);
    const s2 = timeToMinutes(start2);
    const e2 = timeToMinutes(end2);
    return s1 < e2 && s2 < e1;
}

function validateSlot(slotData, existingSlots = []) {
    const { day, startTime, endTime } = slotData;

    if (!day || !startTime || !endTime) {
        return { valid: false, error: "Please fill all fields" };
    }

    if (!DAYS.includes(day)) {
        return { valid: false, error: "Invalid day selected" };
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return { valid: false, error: "Invalid time format" };
    }

    if (startTime < BUSINESS_RULES.EARLIEST_TIME) {
        return { valid: false, error: `Slots cannot start before ${formatTimeDisplay(BUSINESS_RULES.EARLIEST_TIME)}` };
    }

    if (endTime > BUSINESS_RULES.LATEST_TIME) {
        return { valid: false, error: `Slots cannot end after ${formatTimeDisplay(BUSINESS_RULES.LATEST_TIME)}` };
    }

    const duration = calculateDuration(startTime, endTime);
    if (duration <= 0) {
        return { valid: false, error: "End time must be after start time" };
    }

    if (duration < BUSINESS_RULES.MIN_DURATION_MINUTES) {
        return { valid: false, error: `Minimum slot duration is ${BUSINESS_RULES.MIN_DURATION_MINUTES} minutes` };
    }

    if (duration > BUSINESS_RULES.MAX_DURATION_MINUTES) {
        return { valid: false, error: `Maximum slot duration is ${BUSINESS_RULES.MAX_DURATION_MINUTES / 60} hours` };
    }

    if (existingSlots.length >= BUSINESS_RULES.MAX_TOTAL_SLOTS) {
        return { valid: false, error: `Maximum ${BUSINESS_RULES.MAX_TOTAL_SLOTS} slots allowed` };
    }

    const slotsOnDay = existingSlots.filter(s => s.day === day);
    if (slotsOnDay.length >= BUSINESS_RULES.MAX_SLOTS_PER_DAY) {
        return { valid: false, error: `Maximum ${BUSINESS_RULES.MAX_SLOTS_PER_DAY} slots per day` };
    }

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

function validateSlotUpdate(slotData, existingSlots, currentSlotId) {
    const filteredSlots = existingSlots.filter(s => s.id !== currentSlotId);
    return validateSlot(slotData, filteredSlots);
}

// ============================================
// TEST UTILITIES
// ============================================

const testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function assert(condition, testName, details = "") {
    if (condition) {
        testResults.passed++;
        testResults.tests.push({ name: testName, status: "PASS", details });
        console.log(`✅ PASS: ${testName}`);
    } else {
        testResults.failed++;
        testResults.tests.push({ name: testName, status: "FAIL", details });
        console.error(`❌ FAIL: ${testName}${details ? ` - ${details}` : ""}`);
    }
}

function assertEqual(actual, expected, testName) {
    const condition = actual === expected;
    assert(condition, testName, condition ? "" : `Expected: ${expected}, Got: ${actual}`);
}

function runTestGroup(groupName, tests) {
    console.log(`\n========== ${groupName} ==========\n`);
    tests.forEach(test => {
        try {
            test();
        } catch (err) {
            console.error(`❌ FAIL: ${test.name} - Error: ${err.message}`);
            testResults.failed++;
            testResults.tests.push({ name: test.name, status: "FAIL", details: err.message });
        }
    });
}

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

const utilityTests = [
    function test_timeToMinutes_midnight() {
        assertEqual(timeToMinutes("00:00"), 0, "timeToMinutes: midnight = 0");
    },
    function test_timeToMinutes_6am() {
        assertEqual(timeToMinutes("06:00"), 360, "timeToMinutes: 6 AM = 360");
    },
    function test_timeToMinutes_noon() {
        assertEqual(timeToMinutes("12:00"), 720, "timeToMinutes: noon = 720");
    },
    function test_timeToMinutes_6pm() {
        assertEqual(timeToMinutes("18:00"), 1080, "timeToMinutes: 6 PM = 1080");
    },
    function test_timeToMinutes_withMinutes() {
        assertEqual(timeToMinutes("14:30"), 870, "timeToMinutes: 14:30 = 870");
    },
    function test_minutesToTime_0() {
        assertEqual(minutesToTime(0), "00:00", "minutesToTime: 0 = 00:00");
    },
    function test_minutesToTime_360() {
        assertEqual(minutesToTime(360), "06:00", "minutesToTime: 360 = 06:00");
    },
    function test_formatTimeDisplay_morning() {
        assertEqual(formatTimeDisplay("06:00"), "6:00 AM", "formatTimeDisplay: 06:00 = 6:00 AM");
    },
    function test_formatTimeDisplay_noon() {
        assertEqual(formatTimeDisplay("12:00"), "12:00 PM", "formatTimeDisplay: 12:00 = 12:00 PM");
    },
    function test_formatTimeDisplay_afternoon() {
        assertEqual(formatTimeDisplay("14:30"), "2:30 PM", "formatTimeDisplay: 14:30 = 2:30 PM");
    },
    function test_getShortDay_monday() {
        assertEqual(getShortDay("Monday"), "Mon", "getShortDay: Monday = Mon");
    },
    function test_calculateDuration_1hour() {
        assertEqual(calculateDuration("10:00", "11:00"), 60, "calculateDuration: 10:00-11:00 = 60 min");
    },
    function test_calculateDuration_30min() {
        assertEqual(calculateDuration("14:00", "14:30"), 30, "calculateDuration: 14:00-14:30 = 30 min");
    }
];

// ============================================
// OVERLAP TESTS
// ============================================

const overlapTests = [
    function test_overlap_noOverlap_before() {
        assertEqual(timesOverlap("08:00", "09:00", "10:00", "11:00"), false, "No overlap: 8-9 and 10-11");
    },
    function test_overlap_noOverlap_after() {
        assertEqual(timesOverlap("14:00", "15:00", "10:00", "11:00"), false, "No overlap: 14-15 and 10-11");
    },
    function test_overlap_adjacent_noOverlap() {
        assertEqual(timesOverlap("10:00", "11:00", "11:00", "12:00"), false, "No overlap: adjacent 10-11, 11-12");
    },
    function test_overlap_partialStart() {
        assertEqual(timesOverlap("10:30", "11:30", "10:00", "11:00"), true, "Overlap: 10:30-11:30 and 10-11");
    },
    function test_overlap_contained() {
        assertEqual(timesOverlap("10:00", "12:00", "10:30", "11:30"), true, "Overlap: 10-12 contains 10:30-11:30");
    },
    function test_overlap_exact() {
        assertEqual(timesOverlap("10:00", "11:00", "10:00", "11:00"), true, "Overlap: exact same time");
    }
];

// ============================================
// VALIDATION TESTS
// ============================================

const validationTests = [
    function test_validate_missingDay() {
        const result = validateSlot({ startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails when day is missing");
    },
    function test_validate_missingStartTime() {
        const result = validateSlot({ day: "Monday", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails when startTime is missing");
    },
    function test_validate_invalidDay() {
        const result = validateSlot({ day: "Funday", startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails for invalid day");
    },
    function test_validate_tooEarly() {
        const result = validateSlot({ day: "Monday", startTime: "05:00", endTime: "06:00" });
        assertEqual(result.valid, false, "Validation fails for start before 6 AM");
    },
    function test_validate_tooLate() {
        const result = validateSlot({ day: "Monday", startTime: "22:00", endTime: "23:30" });
        assertEqual(result.valid, false, "Validation fails for end after 11 PM");
    },
    function test_validate_endBeforeStart() {
        const result = validateSlot({ day: "Monday", startTime: "11:00", endTime: "10:00" });
        assertEqual(result.valid, false, "Validation fails when end is before start");
    },
    function test_validate_tooShort() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:15" });
        assertEqual(result.valid, false, "Validation fails for duration < 30 min");
    },
    function test_validate_tooLong() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "14:00" });
        assertEqual(result.valid, false, "Validation fails for duration > 3 hours");
    },
    function test_validate_exactlyMinDuration() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:30" });
        assertEqual(result.valid, true, "Validation passes for exactly 30 min");
    },
    function test_validate_exactlyMaxDuration() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "13:00" });
        assertEqual(result.valid, true, "Validation passes for exactly 3 hours");
    },
    function test_validate_validSlot() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, true, "Validation passes for valid slot");
    },
    function test_validate_maxTotalSlots() {
        const existingSlots = Array(20).fill(null).map((_, i) => ({
            id: `slot-${i}`, day: DAYS[i % 7], startTime: "10:00", endTime: "11:00"
        }));
        const result = validateSlot({ day: "Monday", startTime: "14:00", endTime: "15:00" }, existingSlots);
        assertEqual(result.valid, false, "Validation fails when total >= 20");
    },
    function test_validate_maxSlotsPerDay() {
        const existingSlots = [
            { id: "1", day: "Monday", startTime: "06:00", endTime: "07:00" },
            { id: "2", day: "Monday", startTime: "08:00", endTime: "09:00" },
            { id: "3", day: "Monday", startTime: "10:00", endTime: "11:00" },
            { id: "4", day: "Monday", startTime: "12:00", endTime: "13:00" },
            { id: "5", day: "Monday", startTime: "14:00", endTime: "15:00" }
        ];
        const result = validateSlot({ day: "Monday", startTime: "16:00", endTime: "17:00" }, existingSlots);
        assertEqual(result.valid, false, "Validation fails when day slots >= 5");
    },
    function test_validate_overlap() {
        const existingSlots = [{ id: "1", day: "Monday", startTime: "10:00", endTime: "11:00" }];
        const result = validateSlot({ day: "Monday", startTime: "10:30", endTime: "11:30" }, existingSlots);
        assertEqual(result.valid, false, "Validation fails for overlapping slots");
    },
    function test_validate_adjacentOK() {
        const existingSlots = [{ id: "1", day: "Monday", startTime: "10:00", endTime: "11:00" }];
        const result = validateSlot({ day: "Monday", startTime: "11:00", endTime: "12:00" }, existingSlots);
        assertEqual(result.valid, true, "Validation passes for adjacent slots");
    }
];

// ============================================
// UPDATE VALIDATION TESTS
// ============================================

const updateTests = [
    function test_update_canUpdateOwn() {
        const existingSlots = [{ id: "slot-1", day: "Monday", startTime: "10:00", endTime: "11:00" }];
        const result = validateSlotUpdate({ day: "Monday", startTime: "10:30", endTime: "11:30" }, existingSlots, "slot-1");
        assertEqual(result.valid, true, "Can update own slot");
    },
    function test_update_cannotOverlapOther() {
        const existingSlots = [
            { id: "slot-1", day: "Monday", startTime: "10:00", endTime: "11:00" },
            { id: "slot-2", day: "Monday", startTime: "12:00", endTime: "13:00" }
        ];
        const result = validateSlotUpdate({ day: "Monday", startTime: "12:30", endTime: "13:30" }, existingSlots, "slot-1");
        assertEqual(result.valid, false, "Cannot update to overlap another");
    }
];

// ============================================
// EDGE CASE TESTS
// ============================================

const edgeTests = [
    function test_edge_earliestValid() {
        const result = validateSlot({ day: "Monday", startTime: "06:00", endTime: "07:00" });
        assertEqual(result.valid, true, "Valid slot at earliest time");
    },
    function test_edge_latestValid() {
        const result = validateSlot({ day: "Monday", startTime: "22:00", endTime: "23:00" });
        assertEqual(result.valid, true, "Valid slot at latest time");
    },
    function test_edge_allDaysValid() {
        const allValid = DAYS.every(day => validateSlot({ day, startTime: "10:00", endTime: "11:00" }).valid);
        assertEqual(allValid, true, "All 7 days pass validation");
    },
    function test_edge_crossNoon() {
        const result = validateSlot({ day: "Monday", startTime: "11:30", endTime: "12:30" });
        assertEqual(result.valid, true, "Slot crossing noon is valid");
    }
];

// ============================================
// RUN ALL TESTS
// ============================================

console.log("🧪 PEERSLOT AVAILABILITY TESTS (Node.js)\n");
console.log("================================\n");

runTestGroup("UTILITY FUNCTIONS", utilityTests);
runTestGroup("OVERLAP DETECTION", overlapTests);
runTestGroup("SLOT VALIDATION", validationTests);
runTestGroup("UPDATE VALIDATION", updateTests);
runTestGroup("EDGE CASES", edgeTests);

// Summary
console.log("\n================================");
console.log("📊 TEST RESULTS SUMMARY");
console.log("================================\n");
console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

if (testResults.failed > 0) {
    console.log("\n🔴 FAILED TESTS:");
    testResults.tests
        .filter(t => t.status === "FAIL")
        .forEach(t => console.log(`  - ${t.name}: ${t.details}`));
    process.exit(1);
} else {
    console.log("\n🎉 ALL TESTS PASSED!");
    process.exit(0);
}
