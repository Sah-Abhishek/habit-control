package com.almanac.tracker.feature.habits

import com.almanac.tracker.core.model.ConsistencyDto
import com.almanac.tracker.core.model.ConsistencySet
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.ReductionDto
import org.junit.Assert.assertEquals
import org.junit.Test

class HabitFormattingTest {
    @Test fun formatsWholeAndFractionalAmounts() {
        assertEquals("2", formatAmount(2.0))
        assertEquals("2.5", formatAmount(2.5))
        assertEquals("0", formatAmount(0.0))
        assertEquals("2.1", formatAmount(2.14))
    }

    private fun habit(kind: String = "build", tracking: String = "binary", reduction: ReductionDto? = null, c30: ConsistencyDto = ConsistencyDto()) =
        HabitSummary(id = "h", name = "Read", kind = kind, tracking = tracking, target = if (kind == "reduce") 3.0 else 1.0, consistency = ConsistencySet(d30 = c30), reduction = reduction)

    @Test fun buildMetaShowsConsistency() {
        assertEquals("26 of last 30 days", habitMeta(habit(c30 = ConsistencyDto(26, 30, 26 / 30.0))))
        assertEquals("Starts today", habitMeta(habit()))
    }

    @Test fun reduceMetaShowsAverageAndDirection() {
        val r = ReductionDto(weekAvg = 2.1, prevWeekAvg = 3.4, weekChange = 0.38)
        assertEquals("Limit 3 · 7-day avg 2.1, down from 3.4", habitMeta(habit("reduce", "quantity", r)))
        val worse = ReductionDto(weekAvg = 2.4, prevWeekAvg = 1.7, weekChange = -0.4)
        assertEquals("Limit 3 · 7-day avg 2.4, up from 1.7", habitMeta(habit("reduce", "quantity", worse)))
        assertEquals("Limit 3 · just started", habitMeta(habit("reduce", "quantity", ReductionDto())))
    }
}
