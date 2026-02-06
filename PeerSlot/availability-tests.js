/**
 * ============================================
 * PEERSLOT - AVAILABILITY SLOT TESTS
 * ============================================
 * Comprehensive test suite for availability slot functionality
 * Run in browser console or with a test runner
 */

import {
    DAYS,
    TIME_SLOTS,
    BUSINESS_RULES,
    SLOT_STATUS,
    timeToMinutes,
    minutesToTime,
    formatTimeDisplay,
    getShortDay,
    calculateDuration,
    timesOverlap,
    validateSlot,
    validateSlotUpdate
} from "./availability.js";

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

function assertDeepEqual(actual, expected, testName) {
    const condition = JSON.stringify(actual) === JSON.stringify(expected);
    assert(condition, testName, condition ? "" : `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}`);
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
    // timeToMinutes tests
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

    function test_timeToMinutes_endOfDay() {
        assertEqual(timeToMinutes("23:59"), 1439, "timeToMinutes: 23:59 = 1439");
    },

    // minutesToTime tests
    function test_minutesToTime_0() {
        assertEqual(minutesToTime(0), "00:00", "minutesToTime: 0 = 00:00");
    },

    function test_minutesToTime_360() {
        assertEqual(minutesToTime(360), "06:00", "minutesToTime: 360 = 06:00");
    },

    function test_minutesToTime_870() {
        assertEqual(minutesToTime(870), "14:30", "minutesToTime: 870 = 14:30");
    },

    // formatTimeDisplay tests
    function test_formatTimeDisplay_morning() {
        assertEqual(formatTimeDisplay("06:00"), "6:00 AM", "formatTimeDisplay: 06:00 = 6:00 AM");
    },

    function test_formatTimeDisplay_noon() {
        assertEqual(formatTimeDisplay("12:00"), "12:00 PM", "formatTimeDisplay: 12:00 = 12:00 PM");
    },

    function test_formatTimeDisplay_afternoon() {
        assertEqual(formatTimeDisplay("14:30"), "2:30 PM", "formatTimeDisplay: 14:30 = 2:30 PM");
    },

    function test_formatTimeDisplay_midnight() {
        assertEqual(formatTimeDisplay("00:00"), "12:00 AM", "formatTimeDisplay: 00:00 = 12:00 AM");
    },

    // getShortDay tests
    function test_getShortDay_monday() {
        assertEqual(getShortDay("Monday"), "Mon", "getShortDay: Monday = Mon");
    },

    function test_getShortDay_wednesday() {
        assertEqual(getShortDay("Wednesday"), "Wed", "getShortDay: Wednesday = Wed");
    },

    // calculateDuration tests
    function test_calculateDuration_1hour() {
        assertEqual(calculateDuration("10:00", "11:00"), 60, "calculateDuration: 10:00-11:00 = 60 min");
    },

    function test_calculateDuration_30min() {
        assertEqual(calculateDuration("14:00", "14:30"), 30, "calculateDuration: 14:00-14:30 = 30 min");
    },

    function test_calculateDuration_2hours() {
        assertEqual(calculateDuration("08:00", "10:00"), 120, "calculateDuration: 08:00-10:00 = 120 min");
    }
];

// ============================================
// TIME OVERLAP TESTS
// ============================================

const overlapTests = [
    function test_overlap_noOverlap_before() {
        assertEqual(
            timesOverlap("08:00", "09:00", "10:00", "11:00"),
            false,
            "No overlap: 8-9 and 10-11"
        );
    },

    function test_overlap_noOverlap_after() {
        assertEqual(
            timesOverlap("14:00", "15:00", "10:00", "11:00"),
            false,
            "No overlap: 14-15 and 10-11"
        );
    },

    function test_overlap_adjacent_noOverlap() {
        assertEqual(
            timesOverlap("10:00", "11:00", "11:00", "12:00"),
            false,
            "No overlap: adjacent slots 10-11 and 11-12"
        );
    },

    function test_overlap_partialStart() {
        assertEqual(
            timesOverlap("10:30", "11:30", "10:00", "11:00"),
            true,
            "Overlap: 10:30-11:30 and 10-11"
        );
    },

    function test_overlap_partialEnd() {
        assertEqual(
            timesOverlap("10:00", "11:00", "10:30", "11:30"),
            true,
            "Overlap: 10-11 and 10:30-11:30"
        );
    },

    function test_overlap_contained() {
        assertEqual(
            timesOverlap("10:00", "12:00", "10:30", "11:30"),
            true,
            "Overlap: 10-12 contains 10:30-11:30"
        );
    },

    function test_overlap_containedReverse() {
        assertEqual(
            timesOverlap("10:30", "11:30", "10:00", "12:00"),
            true,
            "Overlap: 10:30-11:30 inside 10-12"
        );
    },

    function test_overlap_exact() {
        assertEqual(
            timesOverlap("10:00", "11:00", "10:00", "11:00"),
            true,
            "Overlap: exact same time 10-11"
        );
    }
];

// ============================================
// VALIDATION TESTS
// ============================================

const validationTests = [
    // Required fields
    function test_validate_missingDay() {
        const result = validateSlot({ startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails when day is missing");
        assert(result.error.includes("fill"), "Error message mentions filling fields");
    },

    function test_validate_missingStartTime() {
        const result = validateSlot({ day: "Monday", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails when startTime is missing");
    },

    function test_validate_missingEndTime() {
        const result = validateSlot({ day: "Monday", startTime: "10:00" });
        assertEqual(result.valid, false, "Validation fails when endTime is missing");
    },

    // Invalid day
    function test_validate_invalidDay() {
        const result = validateSlot({ day: "Funday", startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails for invalid day");
        assert(result.error.includes("day"), "Error mentions invalid day");
    },

    // Invalid time format
    function test_validate_invalidStartTimeFormat() {
        const result = validateSlot({ day: "Monday", startTime: "10am", endTime: "11:00" });
        assertEqual(result.valid, false, "Validation fails for invalid start time format");
    },

    function test_validate_invalidEndTimeFormat() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "11pm" });
        assertEqual(result.valid, false, "Validation fails for invalid end time format");
    },

    // Time bounds
    function test_validate_tooEarly() {
        const result = validateSlot({ day: "Monday", startTime: "05:00", endTime: "06:00" });
        assertEqual(result.valid, false, "Validation fails for start time before 6 AM");
        assert(result.error.toLowerCase().includes("before"), "Error mentions before limit");
    },

    function test_validate_tooLate() {
        const result = validateSlot({ day: "Monday", startTime: "22:00", endTime: "23:30" });
        assertEqual(result.valid, false, "Validation fails for end time after 11 PM");
        assert(result.error.toLowerCase().includes("after"), "Error mentions after limit");
    },

    // End before start
    function test_validate_endBeforeStart() {
        const result = validateSlot({ day: "Monday", startTime: "11:00", endTime: "10:00" });
        assertEqual(result.valid, false, "Validation fails when end time is before start time");
        assert(result.error.toLowerCase().includes("after"), "Error mentions end time must be after");
    },

    function test_validate_sameTime() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:00" });
        assertEqual(result.valid, false, "Validation fails when start and end are same");
    },

    // Duration limits
    function test_validate_tooShort() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:15" });
        assertEqual(result.valid, false, "Validation fails for duration < 30 min");
        assert(result.error.includes("30") || result.error.includes("minimum"), "Error mentions minimum duration");
    },

    function test_validate_tooLong() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "14:00" });
        assertEqual(result.valid, false, "Validation fails for duration > 3 hours");
        assert(result.error.includes("3") || result.error.includes("maximum"), "Error mentions maximum duration");
    },

    function test_validate_exactlyMinDuration() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:30" });
        assertEqual(result.valid, true, "Validation passes for exactly 30 min duration");
    },

    function test_validate_exactlyMaxDuration() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "13:00" });
        assertEqual(result.valid, true, "Validation passes for exactly 3 hour duration");
    },

    // Valid slot
    function test_validate_validSlot() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "11:00" });
        assertEqual(result.valid, true, "Validation passes for valid 1 hour slot");
        assertEqual(result.error, null, "No error for valid slot");
    },

    // Slot limits
    function test_validate_maxTotalSlots() {
        const existingSlots = Array(20).fill(null).map((_, i) => ({
            id: `slot-${i}`,
            day: DAYS[i % 7],
            startTime: "10:00",
            endTime: "11:00"
        }));
        const result = validateSlot({ day: "Monday", startTime: "14:00", endTime: "15:00" }, existingSlots);
        assertEqual(result.valid, false, "Validation fails when total slots >= 20");
        assert(result.error.includes("20") || result.error.includes("maximum"), "Error mentions max slots");
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
        assertEqual(result.valid, false, "Validation fails when slots per day >= 5");
        assert(result.error.includes("5") || result.error.includes("per day"), "Error mentions per day limit");
    },

    // Overlap prevention
    function test_validate_overlap() {
        const existingSlots = [
            { id: "1", day: "Monday", startTime: "10:00", endTime: "11:00" }
        ];
        const result = validateSlot({ day: "Monday", startTime: "10:30", endTime: "11:30" }, existingSlots);
        assertEqual(result.valid, false, "Validation fails for overlapping slots");
        assert(result.error.toLowerCase().includes("overlap"), "Error mentions overlap");
    },

    function test_validate_noOverlapDifferentDay() {
        const existingSlots = [
            { id: "1", day: "Monday", startTime: "10:00", endTime: "11:00" }
        ];
        const result = validateSlot({ day: "Tuesday", startTime: "10:00", endTime: "11:00" }, existingSlots);
        assertEqual(result.valid, true, "Validation passes for same time on different day");
    },

    function test_validate_adjacentSlotsOK() {
        const existingSlots = [
            { id: "1", day: "Monday", startTime: "10:00", endTime: "11:00" }
        ];
        const result = validateSlot({ day: "Monday", startTime: "11:00", endTime: "12:00" }, existingSlots);
        assertEqual(result.valid, true, "Validation passes for adjacent slots");
    }
];

// ============================================
// UPDATE VALIDATION TESTS
// ============================================

const updateValidationTests = [
    function test_validateUpdate_canUpdateOwnSlot() {
        const existingSlots = [
            { id: "slot-1", day: "Monday", startTime: "10:00", endTime: "11:00" }
        ];
        const result = validateSlotUpdate(
            { day: "Monday", startTime: "10:30", endTime: "11:30" },
            existingSlots,
            "slot-1"
        );
        assertEqual(result.valid, true, "Can update own slot without overlap error");
    },

    function test_validateUpdate_cannotOverlapOtherSlot() {
        const existingSlots = [
            { id: "slot-1", day: "Monday", startTime: "10:00", endTime: "11:00" },
            { id: "slot-2", day: "Monday", startTime: "12:00", endTime: "13:00" }
        ];
        const result = validateSlotUpdate(
            { day: "Monday", startTime: "12:30", endTime: "13:30" },
            existingSlots,
            "slot-1"
        );
        assertEqual(result.valid, false, "Cannot update to overlap another slot");
    }
];

// ============================================
// CONSTANTS TESTS
// ============================================

const constantsTests = [
    function test_constants_daysCount() {
        assertEqual(DAYS.length, 7, "DAYS array has 7 days");
    },

    function test_constants_daysOrder() {
        assertEqual(DAYS[0], "Monday", "Week starts with Monday");
        assertEqual(DAYS[6], "Sunday", "Week ends with Sunday");
    },

    function test_constants_timeSlotsStart() {
        assertEqual(TIME_SLOTS[0], "06:00", "Time slots start at 6 AM");
    },

    function test_constants_timeSlotsEnd() {
        assertEqual(TIME_SLOTS[TIME_SLOTS.length - 1], "23:00", "Time slots end at 11 PM");
    },

    function test_constants_timeSlots30minInterval() {
        const interval = timeToMinutes(TIME_SLOTS[1]) - timeToMinutes(TIME_SLOTS[0]);
        assertEqual(interval, 30, "Time slots are 30 min apart");
    },

    function test_constants_businessRules() {
        assertEqual(BUSINESS_RULES.MIN_DURATION_MINUTES, 30, "Min duration is 30 min");
        assertEqual(BUSINESS_RULES.MAX_DURATION_MINUTES, 180, "Max duration is 180 min");
        assertEqual(BUSINESS_RULES.MAX_SLOTS_PER_DAY, 5, "Max slots per day is 5");
        assertEqual(BUSINESS_RULES.MAX_TOTAL_SLOTS, 20, "Max total slots is 20");
    },

    function test_constants_slotStatus() {
        assertEqual(SLOT_STATUS.AVAILABLE, "available", "Available status is 'available'");
        assertEqual(SLOT_STATUS.BOOKED, "booked", "Booked status is 'booked'");
        assertEqual(SLOT_STATUS.BLOCKED, "blocked", "Blocked status is 'blocked'");
    }
];

// ============================================
// EDGE CASES
// ============================================

const edgeCaseTests = [
    // Boundary times
    function test_edge_earliestValidSlot() {
        const result = validateSlot({ day: "Monday", startTime: "06:00", endTime: "07:00" });
        assertEqual(result.valid, true, "Valid slot at earliest time 6:00-7:00 AM");
    },

    function test_edge_latestValidSlot() {
        const result = validateSlot({ day: "Monday", startTime: "22:00", endTime: "23:00" });
        assertEqual(result.valid, true, "Valid slot at latest time 10:00-11:00 PM");
    },

    // All days validation
    function test_edge_allDaysValid() {
        const allValid = DAYS.every(day => {
            const result = validateSlot({ day, startTime: "10:00", endTime: "11:00" });
            return result.valid;
        });
        assert(allValid, "All 7 days pass validation");
    },

    // Duration boundaries
    function test_edge_29minFails() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "10:29" });
        assertEqual(result.valid, false, "29 min duration fails validation");
    },

    function test_edge_181minFails() {
        const result = validateSlot({ day: "Monday", startTime: "10:00", endTime: "13:01" });
        assertEqual(result.valid, false, "181 min duration fails validation");
    },

    // Special time cases
    function test_edge_crossNoonSlot() {
        const result = validateSlot({ day: "Monday", startTime: "11:30", endTime: "12:30" });
        assertEqual(result.valid, true, "Slot crossing noon is valid");
    },

    // Maximum slots edge
    function test_edge_19SlotsCanAddMore() {
        const existingSlots = Array(19).fill(null).map((_, i) => ({
            id: `slot-${i}`,
            day: DAYS[i % 7],
            startTime: "06:00",
            endTime: "07:00"
        }));
        const result = validateSlot({ day: "Friday", startTime: "10:00", endTime: "11:00" }, existingSlots);
        assertEqual(result.valid, true, "Can add slot when 19 exist");
    },

    // Exactly 4 slots per day can add one more
    function test_edge_4SlotsPerDayCanAddMore() {
        const existingSlots = [
            { id: "1", day: "Monday", startTime: "06:00", endTime: "07:00" },
            { id: "2", day: "Monday", startTime: "08:00", endTime: "09:00" },
            { id: "3", day: "Monday", startTime: "10:00", endTime: "11:00" },
            { id: "4", day: "Monday", startTime: "12:00", endTime: "13:00" }
        ];
        const result = validateSlot({ day: "Monday", startTime: "14:00", endTime: "15:00" }, existingSlots);
        assertEqual(result.valid, true, "Can add 5th slot on day with 4 slots");
    }
];

// ============================================
// RUN ALL TESTS
// ============================================

export function runAllTests() {
    console.clear();
    console.log("🧪 PEERSLOT AVAILABILITY TESTS\n");
    console.log("================================\n");

    runTestGroup("UTILITY FUNCTIONS", utilityTests);
    runTestGroup("TIME OVERLAP DETECTION", overlapTests);
    runTestGroup("SLOT VALIDATION", validationTests);
    runTestGroup("UPDATE VALIDATION", updateValidationTests);
    runTestGroup("CONSTANTS", constantsTests);
    runTestGroup("EDGE CASES", edgeCaseTests);

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
    }

    return testResults;
}

// Auto-run if this file is loaded directly
if (typeof window !== "undefined") {
    window.runAvailabilityTests = runAllTests;
    console.log("💡 Run tests by calling: runAvailabilityTests()");
}

export { testResults };
