package com.almanac.tracker.feature.today

import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.DayEntryDto
import com.almanac.tracker.core.model.SleepInputDto
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.core.model.TopicOptionsResponse
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** A partial check-in: only keys present are changed; a null value clears that field. */
data class CheckInPatch(
    val mood: Field<Int> = Field.Unchanged,
    val energy: Field<Int> = Field.Unchanged,
    val stress: Field<Int> = Field.Unchanged,
    val note: Field<String> = Field.Unchanged,
) {
    sealed interface Field<out T> {
        data object Unchanged : Field<Nothing>
        data class Set<T>(val value: T?) : Field<T>
    }

    val isEmpty get() = listOf(mood, energy, stress, note).all { it == Field.Unchanged }

    fun toJson(): String {
        val map = linkedMapOf<String, JsonElement>()
        fun put(key: String, f: Field<*>) {
            if (f is Field.Set<*>) map[key] = when (val v = f.value) {
                null -> JsonNull
                is Number -> JsonPrimitive(v)
                else -> JsonPrimitive(v.toString())
            }
        }
        put("mood", mood); put("energy", energy); put("stress", stress); put("note", note)
        return JsonObject(map).toString()
    }

    companion object {
        fun of(key: String, value: Int?): CheckInPatch = when (key) {
            "mood" -> CheckInPatch(mood = Field.Set(value))
            "energy" -> CheckInPatch(energy = Field.Set(value))
            "stress" -> CheckInPatch(stress = Field.Set(value))
            else -> CheckInPatch()
        }
    }
}

/**
 * Days API: check-in values, sleep and focus. Check-in, sleep and focus writes are
 * idempotent, so they queue offline and replay later.
 */
class DaysRepository(private val container: AppContainer) {

    fun today(): Flow<Load<TodayResponse>> = container.cachedApi.stream("today", serializer = TodayResponse.serializer())

    fun entry(date: String): Flow<Load<DayEntryDto>> = container.cachedApi.stream("days/$date", serializer = DayEntryDto.serializer())

    fun topicOptions(): Flow<Load<TopicOptionsResponse>> = container.cachedApi.stream("topics/options", serializer = TopicOptionsResponse.serializer())

    suspend fun checkIn(date: String, patch: CheckInPatch): WriteResult<DayEntryDto> =
        container.mutations.sendOrQueue("PATCH", "days/$date/check-in", patch.toJson(), "Check-in for $date", DayEntryDto.serializer())

    suspend fun setSleep(date: String, input: SleepInputDto): WriteResult<DayEntryDto> {
        val body = JsonObject(
            mapOf(
                "bed" to JsonPrimitive(input.bed),
                "wake" to JsonPrimitive(input.wake),
                "quality" to (input.quality?.let { JsonPrimitive(it) } ?: JsonNull),
            ),
        ).toString()
        return container.mutations.sendOrQueue("PUT", "days/$date/sleep", body, "Sleep for $date", DayEntryDto.serializer())
    }

    /** Online only: deleting isn't queued. */
    suspend fun clearSleep(date: String) = container.mutations.delete("days/$date/sleep")

    suspend fun setFocus(date: String, topicId: String?, text: String?): WriteResult<DayEntryDto> {
        val body = JsonObject(
            mapOf(
                "topicId" to (topicId?.let { JsonPrimitive(it) } ?: JsonNull),
                "text" to (text?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull),
            ),
        ).toString()
        return container.mutations.sendOrQueue("PUT", "days/$date/focus", body, "Today’s focus", DayEntryDto.serializer())
    }

}
