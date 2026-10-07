package com.almanac.tracker.feature.study

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.SubjectDetailResponse
import com.almanac.tracker.core.model.TopicDto
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import kotlin.math.roundToInt

@Composable
fun SubjectScreen(id: String) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "subject-$id") { SubjectViewModel(id, container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val overrides by vm.progressOverrides.collectAsStateWithLifecycle()
    val gone by vm.gone.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var menu by rememberSaveable { mutableStateOf(false) }
    var editing by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    var openTopic by rememberSaveable { mutableStateOf<String?>(null) }
    CollectNotices(vm.notices)
    LaunchedEffect(gone) { if (gone) nav.back() }
    val data = (load as? Load.Ready)?.data

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Plan", nav::back) {
            if (data != null) {
                IconButton(onClick = { menu = true }) { AIcon(AlmanacIcon.More, "More actions", Almanac.colors.ink) }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem({ Text("Edit subject") }, { menu = false; editing = true })
                    DropdownMenuItem({ Text("Delete subject…", color = Almanac.colors.clay) }, { menu = false; confirmDelete = true })
                }
            }
        }
        LoadContent(load, onRetry = { vm.refresh() }) { d ->
            SubjectBody(d, overrides, vm, onOpenTopic = { openTopic = it })
        }
    }

    if (editing && data != null) SubjectEditorSheet(data.subject, onDismiss = { editing = false })
    if (confirmDelete && data != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete “${data.subject.name}”?") },
            text = { Text("This permanently removes the subject, its ${data.topics.size} topics and their revisions. Logged sessions are kept without a subject.") },
            confirmButton = { TextButton({ confirmDelete = false; vm.deleteSubject(data.subject.name) }) { Text("Delete forever", color = Almanac.colors.clay) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
    val topic = data?.topics?.firstOrNull { it.id == openTopic }
    if (topic != null && data != null) {
        TopicSheet(topic, data.subject.id, overrides[topic.id] ?: topic.progress, vm, onDismiss = { openTopic = null })
    }
}

@Composable
private fun SubjectBody(d: SubjectDetailResponse, overrides: Map<String, Int>, vm: SubjectViewModel, onOpenTopic: (String) -> Unit) {
    val c = Almanac.colors
    val s = d.subject
    val today = LocalDate.now()
    Row(verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            MonoLabel("Subject · ${d.topics.size} topic${if (d.topics.size == 1) "" else "s"}")
            Text(s.name, style = Almanac.type.display, color = c.ink)
            Text(
                listOfNotNull("${StudyMath.formatDuration(s.studySeconds)} logged", d.accuracy?.let { "${StudyMath.percent(it)} accuracy" }, s.goalTitle).joinToString(" · "),
                style = Almanac.type.small, color = c.muted,
            )
        }
        Text("${(s.progress * 100).roundToInt()}%", style = Almanac.type.headline.copy(fontSize = Almanac.type.display.fontSize), color = c.moss)
    }
    StartSessionButton(s.id, null, "Start ${s.name} session", Modifier.fillMaxWidth())

    AlmanacCard {
        SectionHeader("Topics", meta = "${d.topics.count { it.status == "completed" }}/${d.topics.size} done")
        if (d.topics.isEmpty()) {
            EmptyState("No topics yet.", "Break ${s.name} into topics — progress and revision schedules work per topic.")
        } else {
            Column {
                d.topics.sortedBy { it.position }.forEachIndexed { i, t ->
                    TopicRow(t, overrides[t.id] ?: t.progress, today, onClick = { onOpenTopic(t.id) })
                    if (i < d.topics.lastIndex) Divider()
                }
            }
        }
        AddTopicField(vm)
    }

    // The memory path for the topic whose next revision is soonest.
    val focusTopic = d.topics
        .mapNotNull { t -> t.revisions.filter { it.completedAt == null && it.skippedAt == null }.minByOrNull { it.dueDate }?.let { t to it } }
        .minByOrNull { it.second.dueDate }
    if (focusTopic != null) {
        val (t, next) = focusTopic
        AlmanacCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${t.name} — memory path", style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("Rev ${next.step} of ${t.revisions.size}", style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.ochre)
            }
            MemoryPath(t.revisions, today)
            Text(
                "Next revision ${StudyMath.relativeDue(next.dueDate, today)}. Skipping one quietly shifts the schedule — nothing is lost.",
                style = Almanac.type.small, color = c.muted,
            )
            StartSessionButton(s.id, t.id, "Revise ${t.name}", small = true, kind = ButtonKind.Primary)
        }
    }

    AlmanacCard {
        SectionHeader("Recent sessions")
        if (d.recentSessions.isEmpty()) {
            Text("Your study history for ${s.name} will appear here once you complete your first session.", style = Almanac.type.small, color = c.muted)
        } else {
            SessionList(d.recentSessions, today)
        }
    }
}

@Composable
private fun TopicRow(t: TopicDto, progress: Int, today: LocalDate, onClick: () -> Unit) {
    val c = Almanac.colors
    val dueNow = t.revisions.any { StudyMath.revisionState(it.dueDate, it.completedAt, it.skippedAt, today) == StudyMath.RevState.Due }
    val (tag, tone) = when {
        dueNow -> "Revise now" to Tone.Ochre
        t.status == "completed" -> "Completed" to Tone.Moss
        progress == 0 -> "Not started" to Tone.Neutral
        else -> null to Tone.Neutral
    }
    Column(
        Modifier.fillMaxWidth().clickable(onClickLabel = "Edit ${t.name}", role = Role.Button, onClick = onClick).padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(t.name, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (tag != null) Pill(tag, tone)
            Spacer(Modifier.weight(1f))
            Text("$progress%", style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = if (progress == 0) c.faint else c.ink)
        }
        ProgressBar(progress / 100f, color = if (progress >= 60) c.moss else if (progress > 0) c.ochre else c.line, label = "${t.name} $progress percent")
    }
}

@Composable
private fun AddTopicField(vm: SubjectViewModel) {
    var name by rememberSaveable { mutableStateOf("") }
    val submit = { if (name.isNotBlank()) vm.addTopic(name) { name = "" } }
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        LabeledField(
            "Add a topic", name, { name = it.take(120) }, Modifier.weight(1f), placeholder = "e.g. Transactions",
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { submit() }),
        )
        AlmanacButton("Add", { submit() }, enabled = name.isNotBlank(), small = true, modifier = Modifier.padding(bottom = 22.dp))
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TopicSheet(topic: TopicDto, subjectId: String, progress: Int, vm: SubjectViewModel, onDismiss: () -> Unit) {
    val c = Almanac.colors
    var name by rememberSaveable(topic.id) { mutableStateOf(topic.name) }
    var slider by rememberSaveable(topic.id) { mutableFloatStateOf(progress.toFloat()) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    val completed = topic.status == "completed"

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(topic.name, style = Almanac.type.headline, color = c.ink)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Progress", style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f))
                Text("${slider.roundToInt()}%", style = Almanac.type.data, color = c.moss)
            }
            Slider(
                value = slider,
                onValueChange = { slider = (it / 5).roundToInt() * 5f },
                onValueChangeFinished = { vm.setProgress(topic, slider.roundToInt()) },
                valueRange = 0f..100f,
                colors = SliderDefaults.colors(thumbColor = c.moss, activeTrackColor = c.moss, inactiveTrackColor = c.sunken),
                modifier = Modifier.semantics { contentDescription = "${topic.name} progress"; stateDescription = "${slider.roundToInt()} percent" },
            )
            if (topic.revisions.isNotEmpty()) {
                MonoLabel("Revisions")
                MemoryPath(topic.revisions)
            }
            AlmanacButton(
                if (completed) "Reopen topic" else "Mark complete · schedule revisions",
                { vm.setCompleted(topic, !completed); onDismiss() },
                kind = if (completed) ButtonKind.Secondary else ButtonKind.Accent,
                icon = if (completed) AlmanacIcon.Refresh else AlmanacIcon.Check,
                modifier = Modifier.fillMaxWidth(),
            )
            StartSessionButton(subjectId, topic.id, "Study this topic", Modifier.fillMaxWidth(), kind = ButtonKind.Primary)
            Divider()
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LabeledField("Rename", name, { name = it.take(120) }, Modifier.weight(1f))
                AlmanacButton("Save", { vm.rename(topic, name) }, enabled = name.isNotBlank() && name.trim() != topic.name, small = true, kind = ButtonKind.Secondary, modifier = Modifier.padding(bottom = 22.dp))
            }
            AlmanacButton("Delete topic…", { confirmDelete = true }, kind = ButtonKind.Ghost, icon = AlmanacIcon.Trash)
        }
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete “${topic.name}”?") },
            text = { Text("Its progress and revision schedule are removed. Sessions logged on it are kept without a topic.") },
            confirmButton = { TextButton({ confirmDelete = false; vm.deleteTopic(topic); onDismiss() }) { Text("Delete", color = c.clay) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
}
