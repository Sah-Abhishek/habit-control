package com.almanac.tracker.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.model.GoalCardDto
import com.almanac.tracker.core.model.GoalInputDto
import com.almanac.tracker.core.model.HabitInput
import com.almanac.tracker.core.model.SettingsDto
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.feature.habits.HabitsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate

data class ReduceItem(val name: String, val stopCompletely: Boolean = false, val baseline: Int = 3)

data class OnboardingState(
    val step: Int = 0,
    val goalTypes: Set<String> = emptySet(),
    val buildHabits: List<String> = emptyList(),
    val reduceHabits: List<ReduceItem> = emptyList(),
    val targetHours: String = "2",
    val targetMinutes: String = "0",
    val goalTitle: String = "",
    val goalTarget: String = "",
    val pending: Boolean = false,
    val error: String? = null,
    val fieldErrors: Map<String, String> = emptyMap(),
    /** Items already created, so a retry after a partial failure never duplicates them. */
    val created: Set<String> = emptySet(),
    val finished: Boolean = false,
)

const val ONBOARDING_STEPS = 5

class OnboardingViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = _state.asStateFlow()
    private val habits = HabitsRepository(container)

    fun update(f: (OnboardingState) -> OnboardingState) = _state.update { f(it).copy(error = null, fieldErrors = emptyMap()) }

    fun next() {
        val s = _state.value
        val errors = validateStep(s)
        if (errors.isNotEmpty()) {
            _state.update { it.copy(fieldErrors = errors) }
            return
        }
        if (s.step < ONBOARDING_STEPS - 1) _state.update { it.copy(step = it.step + 1) } else finish()
    }

    fun back() = _state.update { if (it.step > 0) it.copy(step = it.step - 1, fieldErrors = emptyMap()) else it }

    /** Skip = clear this step's input and move on. */
    fun skip() {
        _state.update {
            val cleared = when (it.step) {
                0 -> it.copy(goalTypes = emptySet())
                1 -> it.copy(buildHabits = emptyList())
                2 -> it.copy(reduceHabits = emptyList())
                3 -> it
                else -> it.copy(goalTitle = "", goalTarget = "")
            }
            cleared.copy(fieldErrors = emptyMap())
        }
        next()
    }

    /** Leaves onboarding entirely; nothing is created except the "onboarded" flag. */
    fun skipAll() {
        _state.update { it.copy(buildHabits = emptyList(), reduceHabits = emptyList(), goalTitle = "", goalTarget = "", step = ONBOARDING_STEPS - 1) }
        finish(keepTarget = false)
    }

    private fun validateStep(s: OnboardingState): Map<String, String> = buildMap {
        if (s.step == 3) parseTargetMinutes(s.targetHours, s.targetMinutes).onFailure { put("target", it.message ?: "Invalid") }
        if (s.step == 4 && s.goalTarget.isNotBlank()) {
            val d = runCatching { LocalDate.parse(s.goalTarget.trim()) }.getOrNull()
            when {
                d == null -> put("goalTarget", "Use YYYY-MM-DD, e.g. 2027-02-26")
                d.isBefore(LocalDate.now()) -> put("goalTarget", "Pick a date in the future")
            }
            if (s.goalTitle.isBlank()) put("goalTitle", "Name the goal, or clear the date to skip")
        }
    }

    private fun finish(keepTarget: Boolean = true) {
        val s = _state.value
        if (s.pending) return
        _state.update { it.copy(pending = true, error = null) }
        viewModelScope.launch {
            val json = container.api.json()
            try {
                for (name in s.buildHabits) {
                    val key = "build:$name"
                    if (key in _state.value.created) continue
                    habits.create(HabitInput(name = name, kind = "build", tracking = "binary", target = 1.0, scheduleDays = (0..6).toList(), isSensitive = false))
                    _state.update { it.copy(created = it.created + key) }
                }
                for (item in s.reduceHabits) {
                    val key = "reduce:${item.name}"
                    if (key in _state.value.created) continue
                    val limit = if (item.stopCompletely) 0.0 else (item.baseline - 1).coerceAtLeast(0).toDouble()
                    habits.create(HabitInput(name = item.name, kind = "reduce", tracking = "quantity", target = limit, unit = "times", scheduleDays = (0..6).toList(), baseline = item.baseline.toDouble(), isSensitive = true))
                    _state.update { it.copy(created = it.created + key) }
                }
                if (s.goalTitle.isNotBlank() && "goal" !in _state.value.created) {
                    val body = GoalInputDto(title = s.goalTitle.trim().take(120), startDate = LocalDate.now().toString(), targetDate = s.goalTarget.trim().ifEmpty { null }, isPrimary = true)
                    container.mutations.send("POST", "goals", json.encodeToString(GoalInputDto.serializer(), body), GoalCardDto.serializer())
                    _state.update { it.copy(created = it.created + "goal") }
                }
                val target = if (keepTarget) parseTargetMinutes(s.targetHours, s.targetMinutes).getOrNull() else null
                val patch = SettingsPatch(dailyStudyTargetMin = target, onboarded = true)
                container.mutations.send("PATCH", "settings", json.encodeToString(SettingsPatch.serializer(), patch), SettingsDto.serializer())
                _state.update { it.copy(pending = false, finished = true) }
            } catch (t: Throwable) {
                _state.update { it.copy(pending = false, error = t.toAppError().message + " Anything already added is kept — tap Finish to try the rest.") }
            }
        }
    }
}
