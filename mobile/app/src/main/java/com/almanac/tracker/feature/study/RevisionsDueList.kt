package com.almanac.tracker.feature.study

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.model.DueRevisionDto
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.LocalMessenger
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch

/**
 * Revisions due today or overdue, each with Done and "Tomorrow" (snooze). Rows hide
 * optimistically and come back with an explanation if the server refuses.
 * The API has no reopen / un-snooze endpoint yet, so these have no Undo.
 */
@Composable
fun RevisionsDueList(
    items: List<DueRevisionDto>,
    modifier: Modifier = Modifier,
    title: String = "Revisions due",
    showSubject: Boolean = true,
    onOpenSubject: ((String) -> Unit)? = null,
) {
    val container = LocalAppContainer.current
    val repo = remember(container) { StudyRepository(container) }
    val messenger = LocalMessenger.current
    val scope = rememberCoroutineScope()
    val c = Almanac.colors
    var hidden by remember { mutableStateOf(setOf<String>()) }
    val visible = items.filterNot { it.id in hidden }

    fun act(r: DueRevisionDto, snooze: Boolean) {
        if (r.id in hidden) return
        hidden = hidden + r.id
        scope.launch {
            try {
                val undo = repo.actOnRevision(r.id, snooze)
                messenger.show(if (snooze) "${r.topicName} moved to tomorrow" else "${r.topicName} revised · Rev ${r.step} done") {
                    try {
                        undo()
                        hidden = hidden - r.id
                    } catch (t: Throwable) {
                        messenger.error(t.toAppError().message)
                    }
                }
            } catch (t: Throwable) {
                hidden = hidden - r.id
                messenger.error(t.toAppError().message)
            }
        }
    }

    AlmanacCard(modifier) {
        SectionHeader(title, meta = if (visible.isEmpty()) null else "${visible.size}", metaColor = c.ochre)
        if (visible.isEmpty()) {
            Text("Nothing due. Completing a topic schedules its revisions automatically.", style = Almanac.type.small, color = c.muted)
        } else {
            Column {
                visible.forEachIndexed { i, r ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f).then(if (onOpenSubject != null) Modifier.clickable(onClickLabel = "Open ${r.subjectName}") { onOpenSubject(r.subjectId) } else Modifier)) {
                            Text(r.topicName, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            val sub = buildList {
                                if (showSubject) add(r.subjectName)
                                add(if (r.overdueDays > 0) "${r.overdueDays}d overdue" else "due today")
                            }.joinToString(" · ")
                            Text(
                                sub, style = Almanac.type.caption, color = if (r.overdueDays > 0) c.ochre else c.muted, maxLines = 1,
                            )
                        }
                        Pill("REV ${r.step}", Tone.Ochre)
                        TextButton(onClick = { act(r, snooze = true) }) { Text("Tomorrow", style = Almanac.type.caption.copy(fontWeight = FontWeight.SemiBold), color = c.muted) }
                        IconButton(onClick = { act(r, snooze = false) }) {
                            Box(Modifier.size(32.dp).clip(CircleShape).background(c.mossSoft), contentAlignment = Alignment.Center) {
                                AIcon(AlmanacIcon.Check, "Mark ${r.topicName} revision ${r.step} done", c.moss, 16.dp)
                            }
                        }
                    }
                    if (i < visible.lastIndex) Divider()
                }
            }
        }
    }
}
