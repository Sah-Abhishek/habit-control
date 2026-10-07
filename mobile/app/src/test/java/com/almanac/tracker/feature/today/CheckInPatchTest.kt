package com.almanac.tracker.feature.today

import com.almanac.tracker.core.model.ConsistencyDto
import com.almanac.tracker.core.model.ConsistencySet
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.HabitToday
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.feature.quicklog.repeatCandidates
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckInPatchTest {
    @Test fun onlyChangedFieldsAreSent() {
        assertEquals("""{"energy":7}""", CheckInPatch.of("energy", 7).toJson())
        assertEquals("{}", CheckInPatch().toJson())
        assertTrue(CheckInPatch().isEmpty)
    }

    @Test fun nullClearsAField() {
        assertEquals("""{"mood":null}""", CheckInPatch.of("mood", null).toJson())
        assertEquals("""{"note":"hi"}""", CheckInPatch(note = CheckInPatch.Field.Set("hi")).toJson())
    }

    private fun habit(id: String, tracking: String, kind: String = "build", successes: Int = 0, scheduled: Boolean = true) = HabitSummary(
        id = id, name = id, kind = kind, tracking = tracking, target = 1.0,
        today = HabitToday(scheduled = scheduled), consistency = ConsistencySet(d30 = ConsistencyDto(successes = successes)),
    )

    @Test fun repeatsPickOneTapHabitsMostConsistentFirst() {
        val d = TodayResponse(
            today = "2026-10-07",
            habits = listOf(
                habit("a", "binary", successes = 3),
                habit("b", "duration", successes = 30), // needs an amount → excluded
                habit("c", "quantity", "reduce", successes = 10),
                habit("d", "binary", successes = 20, scheduled = false), // not today → excluded
                habit("e", "binary", successes = 25),
                habit("f", "quantity", successes = 1),
                habit("g", "binary", successes = 2),
            ),
        )
        assertEquals(listOf("e", "c", "a", "g"), repeatCandidates(d).map { it.id })
    }
}
