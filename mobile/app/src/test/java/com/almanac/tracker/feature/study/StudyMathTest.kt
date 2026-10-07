package com.almanac.tracker.feature.study

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneId

class StudyMathTest {
    @Test fun elapsedAdvancesWithMonotonicClockOnly() {
        assertEquals(130L, StudyMath.elapsedNow(100, anchorMs = 5_000, nowMs = 35_900, paused = false))
    }

    @Test fun pausedSessionDoesNotAdvance() {
        assertEquals(100L, StudyMath.elapsedNow(100, 5_000, 600_000, paused = true))
    }

    @Test fun clockGoingBackwardsNeverReducesElapsed() {
        assertEquals(100L, StudyMath.elapsedNow(100, 50_000, 10_000, paused = false))
    }

    @Test fun blocksOfFiftyMinutes() {
        assertEquals(1 to 0f, StudyMath.block(0))
        val (i, p) = StudyMath.block(3000 + 1500)
        assertEquals(2, i)
        assertEquals(0.5f, p, 0.001f)
    }

    @Test fun accuracyHandlesEmptyAndClamps() {
        assertNull(StudyMath.accuracy(0, 0))
        assertNull(StudyMath.accuracy(null, 3))
        assertEquals(0.79, StudyMath.accuracy(14, 11)!!, 0.01)
        assertEquals(1.0, StudyMath.accuracy(5, 9)!!, 0.0)
    }

    @Test fun focusLabels() {
        assertEquals("Poor", StudyMath.focusLabel(1))
        assertEquals("Deep", StudyMath.focusLabel(5))
        assertNull(StudyMath.focusLabel(0))
        assertNull(StudyMath.focusLabel(null))
    }

    @Test fun formatting() {
        assertEquals("2h 15m", StudyMath.formatDuration(8100))
        assertEquals("45m", StudyMath.formatDuration(2700))
        assertEquals("3h", StudyMath.formatDuration(10800))
        assertEquals("38:12", StudyMath.formatTimer(2292))
        assertEquals("1:02:05", StudyMath.formatTimer(3725))
    }

    @Test fun timeValidationAllowsMidnightCrossingAndRejectsBadInput() {
        val today = LocalDate.parse("2026-10-07")
        assertTrue(StudyMath.validateTimes("2026-10-06", "23:30", "00:45", today).isEmpty())
        assertEquals(75, StudyMath.spanMinutes(23 * 60 + 30, 45))
        assertTrue("endTime" in StudyMath.validateTimes("2026-10-07", "08:00", "08:00", today))
        assertTrue("endTime" in StudyMath.validateTimes("2026-10-07", "01:00", "18:00", today)) // 17h
        assertTrue("date" in StudyMath.validateTimes("2026-10-08", "08:00", "09:00", today))
        assertTrue("startTime" in StudyMath.validateTimes("2026-10-07", "25:00", "09:00", today))
    }

    @Test fun questionValidation() {
        assertTrue(StudyMath.validateQuestions("14", "11").isEmpty())
        assertTrue(StudyMath.validateQuestions("", "").isEmpty())
        assertTrue("questionsCorrect" in StudyMath.validateQuestions("10", "12"))
        assertTrue("questionsAttempted" in StudyMath.validateQuestions("x", ""))
    }

    @Test fun clockInUserZone() {
        assertEquals("13:15", StudyMath.clockOf("2026-10-07T07:45:00Z", ZoneId.of("Asia/Kolkata")))
        assertEquals("2026-10-08", StudyMath.dateOf("2026-10-07T20:30:00Z", ZoneId.of("Asia/Kolkata")))
    }

    @Test fun revisionStates() {
        val today = LocalDate.parse("2026-10-07")
        assertEquals(StudyMath.RevState.Due, StudyMath.revisionState("2026-10-07", null, null, today))
        assertEquals(StudyMath.RevState.Upcoming, StudyMath.revisionState("2026-10-09", null, null, today))
        assertEquals(StudyMath.RevState.Done, StudyMath.revisionState("2026-10-01", "2026-10-01T10:00:00Z", null, today))
        assertEquals("3d late", StudyMath.relativeDue("2026-10-04", today))
        assertEquals("in 2d", StudyMath.relativeDue("2026-10-09", today))
    }
}
