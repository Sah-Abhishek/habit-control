package com.almanac.tracker.feature.insights

import org.junit.Assert.assertEquals
import org.junit.Test

class InsightsLogicTest {
    @Test fun rangeFromKeyFallsBackTo30Days() {
        assertEquals(InsightRange.Quarter, InsightRange.fromKey("90d"))
        assertEquals(InsightRange.Month, InsightRange.fromKey("bogus"))
        assertEquals(InsightRange.Month, InsightRange.fromKey(null))
    }

    @Test fun niceMaxCoversValuesAndTarget() {
        assertEquals(1.0, niceMax(emptyList()), 0.0)
        assertEquals(20.0, niceMax(listOf(12.0, 14.6), target = 15.0), 0.0)
        assertEquals(4.0, niceMax(listOf(3.2)), 0.0) // 3.2 + 10% = 3.52 → next whole number
    }

    @Test fun scaleIsClampedAndSafe() {
        assertEquals(0.5f, scale(5.0, 10.0))
        assertEquals(1f, scale(50.0, 10.0))
        assertEquals(0f, scale(5.0, 0.0))
        assertEquals(0f, scale(Double.NaN, 10.0))
    }

    @Test fun formatsDurations() {
        assertEquals("2h 15m", formatDuration(8100))
        assertEquals("45m", formatDuration(2700))
        assertEquals("3h", formatDuration(10800))
        assertEquals("0m", formatDuration(-5))
        assertEquals("—", formatPercent(null))
        assertEquals("79%", formatPercent(0.79))
        assertEquals("7.8", formatOne(7.81))
    }
}
