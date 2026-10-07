package com.almanac.tracker.feature.study

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.model.SubjectDetailResponse
import com.almanac.tracker.core.model.TopicDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SubjectViewModel(private val id: String, container: AppContainer) : ViewModel() {
    val repo = StudyRepository(container)
    val notices = Notices()
    private val _load = MutableStateFlow<Load<SubjectDetailResponse>>(Load.Loading)
    val load: StateFlow<Load<SubjectDetailResponse>> = _load.asStateFlow()
    /** Optimistic topic progress while a save is in flight. */
    private val _progress = MutableStateFlow<Map<String, Int>>(emptyMap())
    val progressOverrides: StateFlow<Map<String, Int>> = _progress.asStateFlow()
    val gone = MutableStateFlow(false)
    private val busy = mutableSetOf<String>()
    private var job: Job? = null

    init {
        refresh()
        viewModelScope.launch { container.dataChanged.collect { refresh(quiet = true) } }
    }

    fun refresh(quiet: Boolean = false) {
        job?.cancel()
        job = viewModelScope.launch {
            repo.subject(id).collect {
                if (quiet && it is Load.Loading) return@collect
                if (it is Load.Failed && (it.error as? AppError.Api)?.status == 404) gone.value = true
                _load.value = it
                if (it is Load.Ready && !it.stale) _progress.value = emptyMap()
            }
        }
    }

    /** Runs [block] once per key at a time (double-tap guard) and reports failures. */
    private fun guarded(key: String, block: suspend () -> Unit) {
        if (!busy.add(key)) return
        viewModelScope.launch {
            try { block() } catch (t: Throwable) { notices.send(t.toAppError().message) } finally { busy.remove(key) }
        }
    }

    fun addTopic(name: String, onDone: () -> Unit) = guarded("add") {
        repo.addTopic(id, name)
        notices.send("“${name.trim()}” added")
        onDone()
    }

    fun rename(topic: TopicDto, name: String) = guarded("rename-${topic.id}") {
        repo.renameTopic(topic.id, name)
        notices.send("Topic renamed")
    }

    fun setProgress(topic: TopicDto, value: Int) {
        val previous = _progress.value[topic.id] ?: topic.progress
        if (value == previous) return
        _progress.value = _progress.value + (topic.id to value)
        guarded("progress-${topic.id}") {
            try {
                repo.setTopicProgress(topic.id, value)
                notices.send("${topic.name}: $previous% → $value%") { runCatching { repo.setTopicProgress(topic.id, previous) } }
            } catch (t: Throwable) {
                _progress.value = _progress.value - topic.id
                throw t
            }
        }
    }

    fun setCompleted(topic: TopicDto, completed: Boolean) = guarded("complete-${topic.id}") {
        repo.setTopicCompleted(topic.id, completed)
        if (completed) notices.send("${topic.name} completed — revisions scheduled") { runCatching { repo.setTopicCompleted(topic.id, false) } }
        else notices.send("${topic.name} reopened — pending revisions removed")
    }

    fun deleteTopic(topic: TopicDto) = guarded("delete-${topic.id}") {
        repo.deleteTopic(topic.id)
        notices.send("“${topic.name}” deleted")
    }

    fun deleteSubject(name: String) = guarded("delete-subject") {
        repo.deleteSubject(id)
        notices.send("“$name” deleted")
        gone.value = true
    }
}
