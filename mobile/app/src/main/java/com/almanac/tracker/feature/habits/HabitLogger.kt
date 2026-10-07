package com.almanac.tracker.feature.habits

import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Optimistic habit logging shared by Habits, Habit detail, Today and Quick log.
 * The UI shows `overrides[habitId@date]` immediately; on failure it rolls back and
 * explains; offline it keeps the value and reports that it will sync.
 */
class HabitLogger(private val repo: HabitsRepository, private val scope: CoroutineScope, private val notices: Notices) {
    private val _overrides = MutableStateFlow<Map<String, Double>>(emptyMap())
    val overrides: StateFlow<Map<String, Double>> = _overrides.asStateFlow()

    fun valueFor(habitId: String, date: String, serverValue: Double): Double = _overrides.value[key(habitId, date)] ?: serverValue

    fun set(habit: HabitSummary, date: String, previous: Double, value: Double) {
        if (value == previous) return
        val k = key(habit.id, date)
        _overrides.update { it + (k to value) }
        scope.launch {
            try {
                when (repo.setValue(habit.id, habit.name, date, value)) {
                    is WriteResult.Saved -> notices.send(message(habit, value)) { undo(habit, date, previous) }
                    WriteResult.Queued -> notices.send("${message(habit, value)} — saved on this phone, will sync.")
                }
            } catch (t: Throwable) {
                _overrides.update { it - k }
                notices.send(t.toAppError().message)
            }
        }
    }

    private fun undo(habit: HabitSummary, date: String, previous: Double) {
        _overrides.update { it + (key(habit.id, date) to previous) }
        scope.launch {
            runCatching { repo.setValue(habit.id, habit.name, date, previous) }.onFailure { notices.send(it.toAppError().message) }
        }
    }

    /** Called after fresh server data arrives so stale optimistic values don't linger. */
    fun clear() = _overrides.update { emptyMap() }

    private fun message(h: HabitSummary, v: Double): String = when {
        h.isBinary -> if (v >= 1) "${h.name} done" else "${h.name} unticked"
        h.isReduce -> "${h.name}: ${formatAmount(v)} (limit ${formatAmount(h.target)})"
        else -> "${h.name}: ${formatAmount(v)} ${h.unit ?: if (h.tracking == "duration") "min" else ""}".trim()
    }

    private fun key(habitId: String, date: String) = "$habitId@$date"
}
