package com.almanac.tracker.feature.insights

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.InsightsResponse
import com.almanac.tracker.core.model.TaskInputDto
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.WeeklyReviewResponse
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate

class InsightsViewModel(private val container: AppContainer) : ViewModel() {
    private val _range = MutableStateFlow(InsightRange.Month)
    val range: StateFlow<InsightRange> = _range.asStateFlow()
    private val _load = MutableStateFlow<Load<InsightsResponse>>(Load.Loading)
    val load: StateFlow<Load<InsightsResponse>> = _load.asStateFlow()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun select(r: InsightRange) {
        if (r == _range.value) return
        _range.value = r
        _load.value = Load.Loading
        refresh()
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            container.cachedApi.stream("insights", mapOf("range" to _range.value.key), InsightsResponse.serializer()).collect {
                if (quiet && it is Load.Loading) return@collect
                _load.value = it
            }
        }
    }
}

class WeeklyReviewViewModel(private val container: AppContainer, initialWeek: String?) : ViewModel() {
    /** null = last completed week, as decided by the server. */
    private val _week = MutableStateFlow(initialWeek?.let { runCatching { LocalDate.parse(it) }.getOrNull() })
    private val _load = MutableStateFlow<Load<WeeklyReviewResponse>>(Load.Loading)
    val load: StateFlow<Load<WeeklyReviewResponse>> = _load.asStateFlow()
    val notices = Notices()
    private val _adding = MutableStateFlow(false)
    val adding: StateFlow<Boolean> = _adding.asStateFlow()
    private var job: Job? = null

    init { refresh() }

    fun refresh() {
        job?.cancel()
        job = viewModelScope.launch {
            container.cachedApi.stream("review/weekly", mapOf("week" to _week.value?.toString()), WeeklyReviewResponse.serializer()).collect {
                _load.value = it
                if (it is Load.Ready && _week.value == null) _week.value = runCatching { LocalDate.parse(it.data.weekStart) }.getOrNull()
            }
        }
    }

    fun shift(weeks: Long) {
        val current = _week.value ?: return
        _week.value = current.plusWeeks(weeks)
        _load.value = Load.Loading
        refresh()
    }

    /** Turns the suggestion into a task. Guarded against double taps. */
    fun addSuggestionToPlan(suggestion: String) {
        if (_adding.value) return
        _adding.value = true
        viewModelScope.launch {
            try {
                val body = container.api.json().encodeToString(TaskInputDto.serializer(), TaskInputDto(title = suggestion.take(200), priority = "medium"))
                container.mutations.send("POST", "tasks", body, TaskRowDto.serializer())
                notices.send("Added to your tasks")
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                _adding.value = false
            }
        }
    }
}
