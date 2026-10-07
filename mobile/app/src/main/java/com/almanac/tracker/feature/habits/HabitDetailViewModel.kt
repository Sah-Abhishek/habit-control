package com.almanac.tracker.feature.habits

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.HabitDetailResponse
import com.almanac.tracker.core.model.HabitInput
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class HabitDetailViewModel(private val id: String, container: AppContainer) : ViewModel() {
    private val repo = HabitsRepository(container)
    val notices = Notices()
    val logger = HabitLogger(repo, viewModelScope, notices)
    private val _load = MutableStateFlow<Load<HabitDetailResponse>>(Load.Loading)
    val load: StateFlow<Load<HabitDetailResponse>> = _load.asStateFlow()
    /** Set when the habit was deleted (here or elsewhere) — the screen navigates back. */
    val gone = MutableStateFlow(false)
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            repo.detail(id).collect {
                if (quiet && it is Load.Loading) return@collect
                if (it is Load.Failed && (it.error as? AppError.Api)?.status == 404) gone.value = true
                _load.value = it
                if (it is Load.Ready && !it.stale) logger.clear()
            }
        }
    }

    fun log(habit: HabitSummary, date: String, serverValue: Double, value: Double) =
        logger.set(habit, date, logger.valueFor(habit.id, date, serverValue), value)

    suspend fun save(input: HabitInput): Map<String, String> = try {
        repo.update(id, input)
        notices.send("Habit updated")
        emptyMap()
    } catch (t: Throwable) {
        val e = t.toAppError()
        (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message)
    }

    fun setArchived(name: String, archived: Boolean) = viewModelScope.launch {
        try {
            repo.setArchived(id, archived)
            if (archived) notices.send("“$name” archived — history kept") { runCatching { repo.setArchived(id, false) } }
            else notices.send("“$name” restored")
        } catch (t: Throwable) {
            notices.send(t.toAppError().message)
        }
    }

    fun delete(name: String) = viewModelScope.launch {
        try {
            repo.delete(id)
            notices.send("“$name” deleted")
            gone.value = true
        } catch (t: Throwable) {
            notices.send(t.toAppError().message)
        }
    }
}
