package com.almanac.tracker.contract

import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.core.network.AppJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Real /api/v1/today responses (captured from the dev server) must decode into the app model. */
class TodayContractTest {
    private fun fixture(name: String) = checkNotNull(javaClass.classLoader?.getResource("contract/$name")) { "missing $name" }.readText()

    @Test fun decodesBrandNewAccount() {
        val t = AppJson.decodeFromString(TodayResponse.serializer(), fixture("today-new-account.json"))
        assertTrue(t.habits.isEmpty())
        assertEquals(7, t.week.size)
        assertEquals(null, t.goal)
    }

    @Test fun decodesSeededAccount() {
        val t = AppJson.decodeFromString(TodayResponse.serializer(), fixture("today-demo.json"))
        assertTrue(t.habits.isNotEmpty())
        assertNotNull(t.goal)
        assertNotNull(t.goalDay)
    }
}
