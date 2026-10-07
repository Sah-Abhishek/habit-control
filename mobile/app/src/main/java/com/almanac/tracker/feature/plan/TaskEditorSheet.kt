package com.almanac.tracker.feature.plan

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.TaskInputDto
import com.almanac.tracker.core.model.TaskOptionsResponse
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.LocalMessenger
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch

private val PRIORITIES = listOf("low" to "Low", "medium" to "Medium", "high" to "High", "critical" to "Critical")

/**
 * Create or edit a task. Saving needs a connection (the server validates links to
 * goals/subjects/topics); completion toggles elsewhere work offline.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TaskEditorSheet(existing: TaskRowDto?, onDismiss: () -> Unit, defaults: TaskInputDto? = null) {
    val container = LocalAppContainer.current
    val repo = remember { TasksRepository(container) }
    val messenger = LocalMessenger.current
    val scope = rememberCoroutineScope()
    val c = Almanac.colors
    val seed = existing?.toInput() ?: defaults ?: TaskInputDto(title = "")
    val optionsLoad by remember { repo.options() }.collectAsState(initial = Load.Loading)
    val options = (optionsLoad as? Load.Ready<TaskOptionsResponse>)?.data ?: TaskOptionsResponse()

    var title by rememberSaveable { mutableStateOf(seed.title) }
    var notes by rememberSaveable { mutableStateOf(seed.notes ?: "") }
    var due by rememberSaveable { mutableStateOf(seed.dueDate) }
    var priority by rememberSaveable { mutableStateOf(seed.priority) }
    var goalId by rememberSaveable { mutableStateOf(seed.goalId) }
    var subjectId by rememberSaveable { mutableStateOf(seed.subjectId) }
    var topicId by rememberSaveable { mutableStateOf(seed.topicId) }
    var estimate by rememberSaveable { mutableStateOf(seed.estimateMinutes?.toString() ?: "") }
    var errors by rememberSaveable { mutableStateOf(mapOf<String, String>()) }
    var pending by rememberSaveable { mutableStateOf(false) }
    val topicChoices = PlanLogic.topicsFor(subjectId, options.topics)

    fun input() = TaskInputDto(
        title = title.trim(), notes = notes.trim().ifEmpty { null }, dueDate = due, priority = priority,
        goalId = goalId, subjectId = subjectId, topicId = PlanLogic.reconcileTopic(subjectId, topicId, options.topics) ?: topicId?.takeIf { options.topics.isEmpty() },
        estimateMinutes = estimate.trim().toIntOrNull(),
    )

    fun save() {
        if (pending) return
        val local = PlanLogic.validateTask(title, estimate)
        errors = local
        if (local.isNotEmpty()) return
        pending = true
        scope.launch {
            try {
                if (existing == null) repo.create(input()) else repo.update(existing.id, input())
                messenger.show(if (existing == null) "Task added" else "Task updated")
                onDismiss()
            } catch (t: Throwable) {
                val e = t.toAppError()
                errors = (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() }?.mapKeys { it.key.removePrefix("data.") }
                    ?: mapOf("_form" to if (e is AppError.Offline) "Adding and editing tasks needs a connection. Ticking tasks off works offline." else e.message)
            } finally {
                pending = false
            }
        }
    }

    fun delete() {
        val task = existing ?: return
        if (pending) return
        pending = true
        scope.launch {
            try {
                repo.delete(task.id)
                onDismiss()
                messenger.show("“${task.title}” deleted") {
                    runCatching { repo.create(task.toInput()) }.onFailure { messenger.error(it.toAppError().message) }
                }
            } catch (t: Throwable) {
                errors = mapOf("_form" to t.toAppError().message)
            } finally {
                pending = false
            }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New task" else "Edit task", style = Almanac.type.headline, color = c.ink)
            FormError(errors["_form"])
            LabeledField("Title", title, { title = it.take(200) }, error = errors["title"], placeholder = "e.g. Solve PYQ set 3")
            LabeledField("Notes", notes, { notes = it.take(2000) }, optional = true, singleLine = false, minLines = 2, error = errors["notes"])
            DateField("Due date", due, { due = it }, optional = true, error = errors["dueDate"])
            Text("Priority", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
            Segmented(PRIORITIES, priority, { priority = it })
            if (optionsLoad is Load.Failed) {
                Text("Couldn’t load goals and subjects to link. You can still save the task.", style = Almanac.type.caption, color = c.muted)
            }
            PickerField("Goal", goalId, options.goals.map { it.id to it.title }, { goalId = it })
            PickerField("Subject", subjectId, options.subjects.map { it.id to it.name }, { s ->
                subjectId = s
                topicId = PlanLogic.reconcileTopic(s, topicId, options.topics)
            })
            PickerField(
                "Topic", topicId, topicChoices.map { it.id to it.name }, { topicId = it },
                enabled = subjectId != null && topicChoices.isNotEmpty(),
                emptyHint = if (subjectId == null) "Choose a subject first" else "No topics in this subject",
            )
            LabeledField(
                "Estimate (minutes)", estimate, { estimate = it.filter(Char::isDigit).take(4) }, optional = true, error = errors["estimateMinutes"],
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (existing != null) AlmanacButton("Delete", ::delete, kind = ButtonKind.Ghost, icon = AlmanacIcon.Trash, enabled = !pending)
                Spacer(Modifier.weight(1f))
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton(if (existing == null) "Add task" else "Save", ::save, pending = pending)
            }
        }
    }
}
