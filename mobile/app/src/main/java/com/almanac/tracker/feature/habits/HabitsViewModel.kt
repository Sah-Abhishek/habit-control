package com.almanac.tracker.feature.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.HabitInput
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.HabitsResponse
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HabitsViewModel(private val container: AppContainer) : ViewModel() {
    val repo = HabitsRepository(container)
    val notices = Notices()
    val logger = HabitLogger(repo, viewModelScope, notices)

    private val _load = MutableStateFlow<Load<HabitsResponse>>(Load.Loading)
    val load: StateFlow<Load<HabitsResponse>> = _load.asStateFlow()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            repo.habits().collect {
                if (quiet && it is Load.Loading) return@collect
                _load.value = it
                if (it is Load.Ready && !it.stale) logger.clear()
            }
        }
    }

    fun log(habit: HabitSummary, date: String, value: Double) =
        logger.set(habit, date, logger.valueFor(habit.id, date, habit.today.value), value)

    /** Returns field errors (empty = saved). */
    suspend fun save(id: String?, input: HabitInput): Map<String, String> = try {
        if (id == null) repo.create(input) else repo.update(id, input)
        notices.send(if (id == null) "“${input.name.trim()}” added" else "Habit updated")
        emptyMap()
    } catch (t: Throwable) {
        val e = t.toAppError()
        (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message)
    }
}
