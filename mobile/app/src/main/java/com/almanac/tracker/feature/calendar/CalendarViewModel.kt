package com.almanac.tracker.feature.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.CalendarDayDetailResponse
import com.almanac.tracker.core.model.CalendarResponse
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.YearMonth

class CalendarViewModel(private val container: AppContainer, initialMonth: String?) : ViewModel() {
    /** null = "the server's current month" (server decides in the user's timezone). */
    private val _month = MutableStateFlow(parseMonth(initialMonth))
    val month: StateFlow<YearMonth?> = _month.asStateFlow()
    private val _load = MutableStateFlow<Load<CalendarResponse>>(Load.Loading)
    val load: StateFlow<Load<CalendarResponse>> = _load.asStateFlow()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            container.cachedApi.stream("calendar", mapOf("month" to _month.value?.toString()), CalendarResponse.serializer()).collect {
                if (quiet && it is Load.Loading) return@collect
                _load.value = it
                if (it is Load.Ready && _month.value == null) parseMonth(it.data.month)?.let { m -> _month.value = m }
            }
        }
    }

    fun shift(months: Long) {
        val current = _month.value ?: return
        _month.value = current.plusMonths(months)
        _load.value = Load.Loading
        refresh()
    }

    fun goTo(month: YearMonth) {
        _month.value = month
        _load.value = Load.Loading
        refresh()
    }
}

class DayViewModel(private val container: AppContainer, val date: String) : ViewModel() {
    private val _load = MutableStateFlow<Load<CalendarDayDetailResponse>>(Load.Loading)
    val load: StateFlow<Load<CalendarDayDetailResponse>> = _load.asStateFlow()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            container.cachedApi.stream("calendar/day/$date", serializer = CalendarDayDetailResponse.serializer()).collect {
                if (quiet && it is Load.Loading) return@collect
                _load.value = it
            }
        }
    }
}
