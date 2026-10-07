package com.almanac.tracker.feature.plan

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.GoalDetailResponse
import com.almanac.tracker.core.model.GoalInputDto
import com.almanac.tracker.core.model.GoalsResponse
import com.almanac.tracker.core.model.MilestoneDto
import com.almanac.tracker.core.model.MilestoneInputDto
import com.almanac.tracker.core.model.StudyOverviewResponse
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.TasksResponse
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.feature.study.StudyRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Collects a cache-then-network stream into a StateFlow, re-running on refresh. */
internal class Reloadable<T>(private val vm: ViewModel, private val source: () -> Flow<Load<T>>, private val onFresh: () -> Unit = {}) {
    private val _state = MutableStateFlow<Load<T>>(Load.Loading)
    val state: StateFlow<Load<T>> = _state.asStateFlow()
    private var job: Job? = null

    fun load(quiet: Boolean = false) {
        job?.cancel()
        job = vm.viewModelScope.launch {
            source().collect {
                if (quiet && it is Load.Loading) return@collect
                _state.value = it
                if (it is Load.Ready && !it.stale) onFresh()
            }
        }
    }
}

internal fun Throwable.toFieldErrors(offlineMessage: String = "This needs a connection. Try again when you’re online."): Map<String, String> {
    val e = toAppError()
    return (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to if (e is AppError.Offline) offlineMessage else e.message)
}

class TasksViewModel(container: AppContainer) : ViewModel() {
    private val repo = TasksRepository(container)
    val notices = Notices()
    val toggler = TaskToggler(repo, viewModelScope, notices)
    private val _filter = MutableStateFlow("today")
    val filter: StateFlow<String> = _filter.asStateFlow()
    private val tasks = Reloadable(this, { repo.tasks(_filter.value) }, onFresh = { toggler.clear() })
    val load: StateFlow<Load<TasksResponse>> = tasks.state

    init {
        tasks.load()
        viewModelScope.launch { container.dataChanged.collect { tasks.load(quiet = true) } }
    }

    fun setFilter(f: String) {
        if (f == _filter.value) return
        _filter.value = f
        tasks.load()
    }

    fun refresh() = tasks.load()
    fun toggle(t: TaskRowDto, done: Boolean) = toggler.toggle(t, done)
}

class PlanViewModel(container: AppContainer) : ViewModel() {
    private val goalsRepo = GoalsRepository(container)
    private val tasksRepo = TasksRepository(container)
    val notices = Notices()
    val toggler = TaskToggler(tasksRepo, viewModelScope, notices)
    private val goals = Reloadable(this, { goalsRepo.goals() })
    private val tasks = Reloadable(this, { tasksRepo.tasks("today") }, onFresh = { toggler.clear() })
    private val study = Reloadable(this, { StudyRepository(container).overview() })
    val goalsLoad: StateFlow<Load<GoalsResponse>> = goals.state
    val tasksLoad: StateFlow<Load<TasksResponse>> = tasks.state
    val studyLoad: StateFlow<Load<StudyOverviewResponse>> = study.state

    init {
        refresh()
        viewModelScope.launch {
            container.dataChanged.collect {
                goals.load(quiet = true)
                tasks.load(quiet = true)
                study.load(quiet = true)
            }
        }
    }

    fun refresh() {
        goals.load()
        tasks.load()
        study.load()
    }

    fun toggle(t: TaskRowDto, done: Boolean) = toggler.toggle(t, done)

    suspend fun createGoal(input: GoalInputDto): Map<String, String> = try {
        goalsRepo.create(input)
        notices.send("“${input.title}” added")
        emptyMap()
    } catch (t: Throwable) {
        t.toFieldErrors("Creating a goal needs a connection.")
    }
}

class GoalDetailViewModel(private val id: String, container: AppContainer) : ViewModel() {
    private val repo = GoalsRepository(container)
    private val tasksRepo = TasksRepository(container)
    val notices = Notices()
    val toggler = TaskToggler(tasksRepo, viewModelScope, notices)
    private val detail = Reloadable(this, { repo.detail(id) }, onFresh = { toggler.clear() })
    val load: StateFlow<Load<GoalDetailResponse>> = detail.state
    /** True once the goal is deleted or missing; the screen navigates back. */
    val gone = MutableStateFlow(false)
    private val busy = MutableStateFlow(false)
    val working: StateFlow<Boolean> = busy.asStateFlow()

    init {
        detail.load()
        viewModelScope.launch {
            detail.state.collect { if (it is Load.Failed && (it.error as? AppError.Api)?.status == 404) gone.value = true }
        }
        viewModelScope.launch { container.dataChanged.collect { detail.load(quiet = true) } }
    }

    fun refresh() = detail.load()
    fun toggle(t: TaskRowDto, done: Boolean) = toggler.toggle(t, done)

    private fun act(success: String?, block: suspend () -> Unit) {
        if (busy.value) return
        busy.value = true
        viewModelScope.launch {
            try {
                block()
                if (success != null) notices.send(success)
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                busy.value = false
            }
        }
    }

    suspend fun update(input: GoalInputDto): Map<String, String> = try {
        repo.update(id, input)
        notices.send("Goal updated")
        emptyMap()
    } catch (t: Throwable) {
        t.toFieldErrors()
    }

    fun makePrimary() = act("Now your main goal") { repo.makePrimary(id) }

    fun setStatus(status: String, previous: String) {
        if (busy.value) return
        busy.value = true
        viewModelScope.launch {
            try {
                repo.setStatus(id, status)
                val label = when (status) { "paused" -> "Goal paused"; "completed" -> "Goal completed"; "archived" -> "Goal archived"; else -> "Goal active again" }
                notices.send(label) { runCatching { repo.setStatus(id, previous) }.onFailure { notices.send(it.toAppError().message) } }
            } catch (t: Throwable) {
                notices.send(t.toAppError().message)
            } finally {
                busy.value = false
            }
        }
    }

    fun delete(title: String) = act(null) {
        repo.delete(id)
        notices.send("“$title” deleted")
        gone.value = true
    }

    suspend fun saveMilestone(existing: MilestoneDto?, input: MilestoneInputDto): Map<String, String> = try {
        if (existing == null) repo.addMilestone(id, input) else repo.updateMilestone(existing.id, input)
        notices.send(if (existing == null) "Milestone added" else "Milestone saved")
        emptyMap()
    } catch (t: Throwable) {
        t.toFieldErrors()
    }

    fun setMilestoneComplete(m: MilestoneDto, complete: Boolean) = act(null) {
        repo.setMilestoneComplete(m.id, complete)
        notices.send(if (complete) "“${m.title}” complete" else "“${m.title}” reopened") {
            runCatching { repo.setMilestoneComplete(m.id, !complete) }.onFailure { notices.send(it.toAppError().message) }
        }
    }

    /** Undo recreates it (with a new id, at the end of the route). */
    fun deleteMilestone(m: MilestoneDto) = act(null) {
        repo.deleteMilestone(m.id)
        notices.send("“${m.title}” deleted") {
            runCatching { repo.addMilestone(id, MilestoneInputDto(m.title, m.targetDate, m.progress)) }.onFailure { notices.send(it.toAppError().message) }
        }
    }
}
