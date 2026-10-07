package com.almanac.tracker.feature.plan

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.data.Notices
import com.almanac.tracker.core.data.WriteResult
import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

fun priorityTone(priority: String): Tone = when (priority) {
    "critical" -> Tone.Clay
    "high" -> Tone.Ochre
    "medium" -> Tone.Dusk
    else -> Tone.Neutral
}

fun priorityLabel(priority: String) = priority.replaceFirstChar { it.uppercase() }

/**
 * Task row from the Figma Today "Tasks" card: the whole row toggles completion
 * (accessible as a checkbox); `task.completedAt` drives done state.
 */
@Composable
fun TaskRow(task: TaskRowDto, onToggle: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val done = task.done
    val context = PlanLogic.taskContext(task)
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .toggleable(value = done, role = Role.Checkbox, onValueChange = onToggle)
            .semantics(mergeDescendants = true) {
                contentDescription = buildString {
                    append(task.title)
                    if (task.overdue && !done) append(", overdue")
                    append(", ${priorityLabel(task.priority)} priority")
                }
            }
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            Modifier.size(22.dp).clip(RoundedCornerShape(7.dp))
                .then(if (done) Modifier.background(c.moss) else Modifier.border(1.5.dp, if (task.overdue) c.clay else c.line, RoundedCornerShape(7.dp))),
            contentAlignment = Alignment.Center,
        ) { if (done) AIcon(AlmanacIcon.Check, null, c.mossOn, 15.dp) }
        Column(Modifier.weight(1f)) {
            Text(
                task.title,
                style = Almanac.type.body.copy(textDecoration = if (done) TextDecoration.LineThrough else null),
                color = if (done) c.faint else c.ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = listOfNotNull(
                if (task.overdue && !done) "Overdue${task.dueDate?.let { " · was due ${PlanLogic.formatDate(it)}" } ?: ""}" else task.dueDate?.let { "Due ${PlanLogic.formatDate(it)}" },
                context,
            ).joinToString(" · ")
            if (meta.isNotEmpty()) Text(meta, style = Almanac.type.caption, color = if (task.overdue && !done) c.clay else c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        if (!done) Pill(priorityLabel(task.priority), priorityTone(task.priority))
        PlanLogic.minutesText(task.estimateMinutes)?.let { Text(it, style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted) }
    }
}

/**
 * Optimistic completion toggles shared by screens showing tasks. Works offline
 * (queued); rolls back and explains if the server refuses.
 */
class TaskToggler(private val repo: TasksRepository, private val scope: CoroutineScope, private val notices: Notices) {
    private val _overrides = MutableStateFlow<Map<String, Boolean>>(emptyMap())
    val overrides: StateFlow<Map<String, Boolean>> = _overrides.asStateFlow()
    private val inFlight = mutableSetOf<String>()

    /** Applies the optimistic state to a server row. */
    fun view(task: TaskRowDto): TaskRowDto = when (_overrides.value[task.id]) {
        true -> if (task.done) task else task.copy(completedAt = "pending")
        false -> task.copy(completedAt = null)
        null -> task
    }

    fun toggle(task: TaskRowDto, done: Boolean) {
        if (task.id in inFlight) return // double-tap guard
        inFlight += task.id
        _overrides.update { it + (task.id to done) }
        scope.launch {
            try {
                when (repo.setDone(task, done)) {
                    is WriteResult.Saved -> notices.send(if (done) "“${task.title}” done" else "“${task.title}” reopened") {
                        _overrides.update { it + (task.id to !done) }
                        runCatching { repo.setDone(task, !done) }.onFailure { e -> notices.send(e.toAppError().message) }
                    }
                    WriteResult.Queued -> notices.send("Saved on this phone — will sync when you’re back online.")
                }
            } catch (t: Throwable) {
                _overrides.update { it - task.id }
                notices.send(t.toAppError().message)
            } finally {
                inFlight -= task.id
            }
        }
    }

    fun clear() = _overrides.update { emptyMap() }
}

