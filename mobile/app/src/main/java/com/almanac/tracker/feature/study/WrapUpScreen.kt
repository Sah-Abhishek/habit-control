package com.almanac.tracker.feature.study

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.ErrorState
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.components.errorBody
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import kotlin.math.roundToInt

/** Optional details after a session (Figma "Mobile / Session wrap-up"). The time is already saved. */
@Composable
fun WrapUpScreen(sessionId: String, longSession: Boolean) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "wrapup-$sessionId") { WrapUpViewModel(sessionId, container) }
    val state by vm.state.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    CollectNotices(vm.notices)
    LaunchedEffect(vm) { vm.doneFlow.collect { nav.back() } }

    when (val s = state) {
        WrapUpState.Loading -> RefreshablePage(false, vm::load) { SkeletonCard(3); SkeletonCard(4) }
        is WrapUpState.Failed -> RefreshablePage(false, vm::load) {
            BackBar("Done", nav::back)
            ErrorState("Couldn’t open the wrap-up", "${errorBody(s.error)} The session time itself is already saved.", onRetry = vm::load)
        }
        WrapUpState.Missing -> RefreshablePage(false, vm::load) {
            BackBar("Done", nav::back)
            EmptyState("This session no longer exists.", "It may have been deleted on another device.")
        }
        is WrapUpState.Ready -> WrapUpForm(s.data, longSession, vm, onClose = nav::back)
    }
}

@Composable
private fun WrapUpForm(d: WrapUpData, longSession: Boolean, vm: WrapUpViewModel, onClose: () -> Unit) {
    val c = Almanac.colors
    val s = d.session
    val saving by vm.saving.collectAsStateWithLifecycle()
    val currentTopicProgress by vm.topicProgress.collectAsStateWithLifecycle()
    var focus by rememberSaveable(s.id) { mutableStateOf(s.focus) }
    var subjectId by rememberSaveable(s.id) { mutableStateOf(s.subjectId) }
    var topicId by rememberSaveable(s.id) { mutableStateOf(s.topicId) }
    var method by rememberSaveable(s.id) { mutableStateOf(s.method) }
    var attempted by rememberSaveable(s.id) { mutableStateOf(s.questionsAttempted?.toString() ?: "") }
    var correct by rememberSaveable(s.id) { mutableStateOf(s.questionsCorrect?.toString() ?: "") }
    var notes by rememberSaveable(s.id) { mutableStateOf(s.notes ?: "") }
    var progress by rememberSaveable(s.id, topicId) { mutableStateOf<Float?>(null) }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var editingTimes by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    val duration = s.durationSeconds ?: 0
    val isLong = longSession || duration > StudyMath.LONG_SESSION_SECONDS
    val start = StudyMath.clockOf(s.startedAt, d.zone)
    val end = StudyMath.clockOf(s.endedAt, d.zone)
    val topicName = d.topics.firstOrNull { it.id == topicId }?.name ?: s.topicName
    val shownProgress = progress ?: currentTopicProgress?.toFloat()

    fun submit() {
        val local = StudyMath.validateQuestions(attempted, correct)
        errors = local
        if (local.isNotEmpty()) return
        val a = attempted.trim().toIntOrNull()
        val k = correct.trim().toIntOrNull()
        vm.save(
            SessionDetailsBody(
                focus = focus.takeIf { it != s.focus },
                method = method.takeIf { it != s.method },
                questionsAttempted = a.takeIf { it != s.questionsAttempted },
                questionsCorrect = k.takeIf { it != s.questionsCorrect },
                // Only send when changed; "" tells the server to clear an existing note.
                notes = notes.trim().takeIf { it != (s.notes ?: "").trim() },
                subjectId = subjectId.takeIf { it != s.subjectId },
                topicId = topicId.takeIf { it != s.topicId },
                topicProgress = progress?.roundToInt()?.takeIf { topicId != null && it != currentTopicProgress },
            ),
        ) { errors = it }
    }

    RefreshablePage(refreshing = false, onRefresh = vm::load) {
        BackBar("Done", onClose)
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            MonoLabel(if (start != null && end != null) "Session saved · $start → $end" else "Session saved", color = c.moss)
            Text(
                "${StudyMath.formatDuration(duration)}${topicName?.let { " on $it" } ?: ""}.",
                style = Almanac.type.display, color = c.ink,
            )
        }
        FormError(errors["_form"])

        if (isLong) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.ochreSoft).padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                AIcon(AlmanacIcon.Alert, null, c.ochre, 18.dp)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("This session ran ${StudyMath.formatDuration(duration)}.", style = Almanac.type.bodyStrong, color = c.ink)
                    Text("Did the timer keep running after you stopped? Correct the times so your stats stay honest.", style = Almanac.type.small, color = c.muted)
                    TextButton(onClick = { editingTimes = true }) { Text("Edit times", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ochre) }
                }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("How focused were you?", style = Almanac.type.bodyStrong, color = c.ink)
            FocusPicker(focus) { focus = it }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Picker("Subject", d.subjects.firstOrNull { it.id == subjectId }?.name ?: s.subjectName ?: "None", Modifier.weight(1f),
                listOf<Pair<String?, String>>(null to "None") + d.subjects.filterNot { it.archived }.map { it.id to it.name }) {
                if (it != subjectId) { subjectId = it; topicId = null; progress = null }
            }
            Picker("Method", StudyMath.methodLabel(method) ?: "Not set", Modifier.weight(1f),
                listOf<Pair<String?, String>>(null to "Not set") + StudyMath.METHODS.map { it.first to it.second }) { method = it }
        }
        val topicChoices = d.topics.filter { it.subjectId == subjectId }
        if (subjectId != null && topicChoices.isNotEmpty()) {
            Picker("Topic", topicName ?: "None", Modifier.fillMaxWidth(), listOf<Pair<String?, String>>(null to "None") + topicChoices.map { it.id to it.name }) {
                topicId = it
                progress = null
                vm.loadTopicProgress(subjectId, it)
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            LabeledField("Questions attempted", attempted, { v -> attempted = v.filter(Char::isDigit).take(5) }, Modifier.weight(1f), optional = true,
                error = errors["questionsAttempted"], keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            LabeledField("Correct", correct, { v -> correct = v.filter(Char::isDigit).take(5) }, Modifier.weight(1f), optional = true,
                error = errors["questionsCorrect"], keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                hint = StudyMath.accuracy(attempted.toIntOrNull(), correct.toIntOrNull())?.let { "${StudyMath.percent(it)} accuracy" })
        }

        if (topicId != null && shownProgress != null) {
            AlmanacCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${topicName ?: "Topic"} progress", style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f))
                    Text(
                        if (progress != null && currentTopicProgress != null) "$currentTopicProgress% → ${progress!!.roundToInt()}%" else "${shownProgress.roundToInt()}%",
                        style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = c.moss,
                    )
                }
                Slider(
                    value = shownProgress,
                    onValueChange = { progress = (it / 5).roundToInt() * 5f },
                    valueRange = 0f..100f,
                    colors = SliderDefaults.colors(thumbColor = c.moss, activeTrackColor = c.moss, inactiveTrackColor = c.sunken),
                    modifier = Modifier.semantics { contentDescription = "Topic progress"; stateDescription = "${shownProgress.roundToInt()} percent" },
                )
                Text("Mark the topic complete on its subject page to schedule revisions.", style = Almanac.type.caption, color = c.faint)
            }
        }

        LabeledField("Notes", notes, { notes = it.take(2000) }, optional = true, singleLine = false, minLines = 3, placeholder = "What to revisit, what clicked…")

        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AlmanacButton("Done", ::submit, pending = saving, modifier = Modifier.weight(1f))
            AlmanacButton("Edit times", { editingTimes = true }, kind = ButtonKind.Secondary)
        }
        TextButton(onClick = { confirmDelete = true }, enabled = !saving) {
            AIcon(AlmanacIcon.Trash, null, c.muted, 16.dp)
            Text("  Delete session", style = Almanac.type.small, color = c.muted)
        }
        Text("Everything here is optional — skipping keeps the ${StudyMath.formatDuration(duration)}.", style = Almanac.type.caption, color = c.faint, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }

    if (editingTimes) {
        EditTimesSheet(
            initialDate = StudyMath.dateOf(s.startedAt, d.zone) ?: s.localDate,
            initialStart = start ?: "",
            initialEnd = end ?: "",
            today = LocalDate.now(d.zone),
            saving = saving,
            onSave = { date, st, en, onErrors -> vm.editTimes(date, st, en) { errs -> if (errs.isEmpty()) editingTimes = false else onErrors(errs) } },
            onDismiss = { editingTimes = false },
        )
    }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this session?") },
            text = { Text("${StudyMath.formatDuration(duration)} will be removed from your study time. This can’t be undone.") },
            confirmButton = { TextButton({ confirmDelete = false; vm.delete() }) { Text("Delete", color = c.clay) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

/** Five optional focus levels; tapping the selected one clears it. */
@Composable
private fun FocusPicker(value: Int?, onChange: (Int?) -> Unit) {
    val c = Almanac.colors
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.sunken).padding(4.dp).selectableGroup(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        StudyMath.FOCUS_LABELS.forEachIndexed { i, label ->
            val level = i + 1
            val on = value == level
            Box(
                Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp)).background(if (on) c.card else androidx.compose.ui.graphics.Color.Transparent)
                    .selectable(on, role = Role.RadioButton) { onChange(if (on) null else level) },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = Almanac.type.small.copy(fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium), color = if (on) c.ink else c.muted, maxLines = 1)
            }
        }
    }
}

@Composable
private fun <T> Picker(label: String, current: String, modifier: Modifier, options: List<Pair<T, String>>, onPick: (T) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("$label  ·  optional", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = Almanac.colors.ink)
        Box {
            AlmanacButton(current, { open = true }, kind = ButtonKind.Secondary, small = true, modifier = Modifier.fillMaxWidth().semantics { contentDescription = "$label: $current. Change" })
            DropdownMenu(open, { open = false }) {
                options.forEach { (value, text) -> DropdownMenuItem({ Text(text) }, { open = false; onPick(value) }) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun EditTimesSheet(
    initialDate: String,
    initialStart: String,
    initialEnd: String,
    today: LocalDate,
    saving: Boolean,
    onSave: (String, String, String, (Map<String, String>) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    val c = Almanac.colors
    var date by rememberSaveable { mutableStateOf(initialDate) }
    var start by rememberSaveable { mutableStateOf(initialStart) }
    var end by rememberSaveable { mutableStateOf(initialEnd) }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    val span = StudyMath.parseClock(start)?.let { s -> StudyMath.parseClock(end)?.let { e -> StudyMath.spanMinutes(s, e) } }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Edit times", style = Almanac.type.headline, color = c.ink)
            Text("24-hour times in your timezone. An end before the start means it ran past midnight.", style = Almanac.type.small, color = c.muted)
            FormError(errors["_form"])
            LabeledField("Day it started", date, { date = it.take(10) }, error = errors["date"], hint = "YYYY-MM-DD")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                LabeledField("Start", start, { start = it.take(5) }, Modifier.weight(1f), error = errors["startTime"], placeholder = "07:45",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                LabeledField("End", end, { end = it.take(5) }, Modifier.weight(1f), error = errors["endTime"], placeholder = "08:37",
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            }
            if (span != null && span > 0) Text("= ${StudyMath.formatDuration(span * 60L)}", style = Almanac.type.data, color = c.moss)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton("Save times", {
                    val local = StudyMath.validateTimes(date.trim(), start.trim(), end.trim(), today)
                    errors = local
                    if (local.isEmpty()) onSave(date.trim(), start.trim().padStart(5, '0'), end.trim().padStart(5, '0')) { errors = it }
                }, pending = saving)
            }
        }
    }
}
