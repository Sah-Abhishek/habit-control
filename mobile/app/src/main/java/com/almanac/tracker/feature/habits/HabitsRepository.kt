package com.almanac.tracker.feature.habits

import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.ArchivedBody
import com.almanac.tracker.core.model.HabitDetailResponse
import com.almanac.tracker.core.model.HabitInput
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.HabitsResponse
import com.almanac.tracker.core.model.LogResult
import com.almanac.tracker.core.model.LogValueBody
import kotlinx.coroutines.flow.Flow

class HabitsRepository(private val container: AppContainer) {
    private val json get() = container.api.json()

    fun habits(): Flow<Load<HabitsResponse>> = container.cachedApi.stream("habits", serializer = HabitsResponse.serializer())

    fun detail(id: String): Flow<Load<HabitDetailResponse>> = container.cachedApi.stream("habits/$id", serializer = HabitDetailResponse.serializer())

    /**
     * Sets the day's value (idempotent PUT). Offline → queued; the last value for a
     * habit/day wins, so repeated taps send one request when back online.
     */
    suspend fun setValue(habitId: String, habitName: String, date: String, value: Double): WriteResult<LogResult> =
        container.mutations.sendOrQueue(
            "PUT", "habits/$habitId/logs/$date",
            json.encodeToString(LogValueBody.serializer(), LogValueBody(value)),
            label = "$habitName on $date",
            serializer = LogResult.serializer(),
        )

    suspend fun create(input: HabitInput): HabitSummary =
        container.mutations.send("POST", "habits", json.encodeToString(HabitInput.serializer(), input), HabitSummary.serializer())

    suspend fun update(id: String, input: HabitInput): HabitSummary =
        container.mutations.send("PATCH", "habits/$id", json.encodeToString(HabitInput.serializer(), input), HabitSummary.serializer())

    suspend fun setArchived(id: String, archived: Boolean): ArchivedBody =
        container.mutations.send("PUT", "habits/$id/archived", json.encodeToString(ArchivedBody.serializer(), ArchivedBody(archived)), ArchivedBody.serializer())

    suspend fun delete(id: String) = container.mutations.delete("habits/$id")
}
