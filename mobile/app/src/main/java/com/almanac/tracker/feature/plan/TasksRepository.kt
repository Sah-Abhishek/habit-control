package com.almanac.tracker.feature.plan

import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.DoneBody
import com.almanac.tracker.core.model.TaskInputDto
import com.almanac.tracker.core.model.TaskOptionsResponse
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.TasksResponse
import kotlinx.coroutines.flow.Flow

/** Tasks API (docs/api.md → Tasks). Toggling is offline-safe; create/edit/delete need a connection. */
class TasksRepository(private val container: AppContainer) {
    private val json get() = container.api.json()

    /** filter: today | upcoming | someday | completed */
    fun tasks(filter: String): Flow<Load<TasksResponse>> =
        container.cachedApi.stream("tasks", mapOf("filter" to filter), TasksResponse.serializer())

    fun options(): Flow<Load<TaskOptionsResponse>> =
        container.cachedApi.stream("tasks/options", serializer = TaskOptionsResponse.serializer())

    /** Idempotent PUT; queued when offline. */
    suspend fun setDone(task: TaskRowDto, done: Boolean): WriteResult<DoneBody> =
        container.mutations.sendOrQueue(
            "PUT", "tasks/${task.id}/done",
            json.encodeToString(DoneBody.serializer(), DoneBody(done)),
            label = "“${task.title}” ${if (done) "done" else "reopened"}",
            serializer = DoneBody.serializer(),
        )

    suspend fun create(input: TaskInputDto): TaskRowDto =
        container.mutations.send("POST", "tasks", json.encodeToString(TaskInputDto.serializer(), input), TaskRowDto.serializer())

    suspend fun update(id: String, input: TaskInputDto): TaskRowDto =
        container.mutations.send("PATCH", "tasks/$id", json.encodeToString(TaskInputDto.serializer(), input), TaskRowDto.serializer())

    suspend fun delete(id: String) = container.mutations.delete("tasks/$id")
}

/** The fields needed to recreate a task (used by Undo after delete). */
fun TaskRowDto.toInput() = TaskInputDto(
    title = title, notes = notes, dueDate = dueDate, priority = priority,
    goalId = goalId, subjectId = subjectId, topicId = topicId, estimateMinutes = estimateMinutes,
)
