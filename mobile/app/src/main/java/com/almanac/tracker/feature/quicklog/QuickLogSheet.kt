package com.almanac.tracker.feature.quicklog

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.HabitSummary
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.feature.habits.HabitLogControl
import com.almanac.tracker.feature.plan.TaskEditorSheet
import com.almanac.tracker.feature.today.CheckInSheet
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.SessionKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.ScaleRow
import com.almanac.tracker.ui.components.SkeletonBlock
import com.almanac.tracker.ui.components.StatusBanner
import com.almanac.tracker.ui.components.errorBody
import com.almanac.tracker.ui.theme.Almanac

private enum class Panel { None, Habits, Note, Mood, Energy, Revisions }

/** The "+" sheet: start a session or log anything in one or two taps. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickLogSheet(onDismiss: () -> Unit) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "quick-log") { QuickLogViewModel(container) }
    val load by vm.today.collectAsStateWithLifecycle()
    val busy by vm.busy.collectAsStateWithLifecycle()
    val online by container.network.online.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    val c = Almanac.colors
    var panel by rememberSaveable { mutableStateOf(Panel.None) }
    var taskSheet by rememberSaveable { mutableStateOf(false) }
    var sleepSheet by rememberSaveable { mutableStateOf(false) }
    CollectNotices(vm.notices)
    val data = (load as? Load.Ready<TodayResponse>)?.data

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(if (panel == Panel.None) "Log something" else panelTitle(panel), style = Almanac.type.headline, color = c.ink, modifier = Modifier.weight(1f))
                TextButton(onClick = { if (panel == Panel.None) onDismiss() else panel = Panel.None }) {
                    Text(if (panel == Panel.None) "Close" else "Back", style = Almanac.type.small, color = c.muted)
                }
            }
            if (!online) StatusBanner("Offline — habits, mood, energy, sleep and notes are saved on this phone and sync later. Sessions and tasks need a connection.", AlmanacIcon.CloudOff, inverse = false)
            if (load is Load.Failed && data == null) StatusBanner(errorBody((load as Load.Failed).error), AlmanacIcon.Alert, inverse = false)

            when (panel) {
                Panel.None -> Home(data, busy, vm, onTile = { panel = it }, onTask = { taskSheet = true }, onSleep = { sleepSheet = true }, onStart = {
                    vm.startSession(data?.focus?.topicId) { onDismiss(); nav.go(SessionKey) }
                }, onOpenSession = { onDismiss(); nav.go(SessionKey) }, loading = load is Load.Loading)
                Panel.Habits -> HabitsPanel(data, vm)
                Panel.Note -> NotePanel(data, busy == "note") { note -> data?.let { vm.saveNote(it.today, note) { panel = Panel.None } } }
                Panel.Mood, Panel.Energy -> ScalePanel(data, panel, vm)
                Panel.Revisions -> RevisionsPanel(data, vm)
            }
        }
    }
    if (taskSheet) TaskEditorSheet(null, onDismiss = { taskSheet = false })
    if (sleepSheet && data != null) CheckInSheet(data.today) { sleepSheet = false }
}

private fun panelTitle(p: Panel) = when (p) {
    Panel.Habits -> "Log a habit"
    Panel.Note -> "Note"
    Panel.Mood -> "Mood"
    Panel.Energy -> "Energy"
    Panel.Revisions -> "Revisions due"
    Panel.None -> "Log something"
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Home(
    data: TodayResponse?, busy: String?, vm: QuickLogViewModel,
    onTile: (Panel) -> Unit, onTask: () -> Unit, onSleep: () -> Unit, onStart: () -> Unit, onOpenSession: () -> Unit, loading: Boolean,
) {
    val c = Almanac.colors
    val running = data?.runningSession
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.inverse)
            .clickable(enabled = busy == null, role = Role.Button, onClick = if (running != null) onOpenSession else onStart)
            .heightIn(min = 72.dp).padding(16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Box(Modifier.size(44.dp).clip(RoundedCornerShape(14.dp)).background(c.ochre), contentAlignment = Alignment.Center) {
            if (busy == "session") CircularProgressIndicator(Modifier.size(20.dp), color = c.inverse, strokeWidth = 2.dp)
            else AIcon(AlmanacIcon.Play, null, c.inverse, 20.dp)
        }
        Column(Modifier.weight(1f)) {
            Text(if (running != null) "Open running session" else "Start study session", style = Almanac.type.bodyStrong, color = c.inverseInk)
            Text(
                running?.let { listOfNotNull(it.subjectName, it.topicName).joinToString(" · ").ifEmpty { "In progress" } }
                    ?: data?.focus?.label?.let { "$it (today’s focus)" } ?: "Pick the subject on the next screen",
                style = Almanac.type.caption, color = c.inverseInk.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis,
            )
        }
        AIcon(AlmanacIcon.Forward, null, c.inverseInk, 18.dp)
    }

    val revCount = data?.revisionsDue?.size ?: 0
    val tiles = listOf(
        Tile("Task", "due today", AlmanacIcon.Task, c.ink, c.sunken) { onTask() },
        Tile("Habit", data?.habits?.count { it.today.scheduled }?.let { "$it today" } ?: "today", AlmanacIcon.Habits, c.moss, c.mossSoft) { onTile(Panel.Habits) },
        Tile("Note", "free text", AlmanacIcon.Note, c.ink, c.sunken) { onTile(Panel.Note) },
        Tile("Mood", "1–10", AlmanacIcon.Smile, c.dusk, c.duskSoft) { onTile(Panel.Mood) },
        Tile("Energy", "1–10", AlmanacIcon.Bolt, c.ochre, c.ochreSoft) { onTile(Panel.Energy) },
        Tile("Sleep", "last night", AlmanacIcon.Moon, c.dusk, c.duskSoft) { onSleep() },
        Tile("Revision", if (revCount == 0) "none due" else "$revCount due", AlmanacIcon.Check, c.moss, c.mossSoft) { onTile(Panel.Revisions) },
    )
    tiles.chunked(3).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            row.forEach { TileView(it, Modifier.weight(1f), enabled = !loading || it.label == "Task") }
            repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
        }
    }

    val repeats = data?.let { repeatCandidates(it) }.orEmpty()
    if (repeats.isNotEmpty()) {
        MonoLabel("One-tap repeats")
        val overrides by vm.logger.overrides.collectAsStateWithLifecycle()
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            repeats.forEach { h ->
                val value = overrides["${h.id}@${data!!.today}"] ?: h.today.value
                val done = h.isBinary && value >= 1
                val label = when {
                    h.isBinary -> if (done) "${h.name} ✓ done" else "${h.name} ✓"
                    else -> "+1 ${h.name}"
                }
                Text(
                    label,
                    style = Almanac.type.small.copy(fontWeight = FontWeight.Medium), color = if (done) c.faint else c.ink,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.clip(CircleShape).border(1.dp, c.line, CircleShape)
                        .clickable(enabled = !done, role = Role.Button) { vm.logHabit(h, data.today, if (h.isBinary) 1.0 else value + 1) }
                        .heightIn(min = 40.dp).padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }
        }
    }
}

/** Up to four scheduled, one-tap-loggable habits, most consistent first. */
fun repeatCandidates(d: TodayResponse): List<HabitSummary> =
    d.habits.filter { it.today.scheduled && (it.isBinary || it.isReduce || it.tracking == "quantity") }
        .sortedByDescending { it.consistency.d30.successes }
        .take(4)

private data class Tile(val label: String, val sub: String, val icon: AlmanacIcon, val tint: Color, val soft: Color, val onClick: () -> Unit)

@Composable
private fun TileView(t: Tile, modifier: Modifier, enabled: Boolean) {
    val c = Almanac.colors
    Column(
        modifier.clip(RoundedCornerShape(18.dp)).background(c.card).border(1.dp, c.hair, RoundedCornerShape(18.dp))
            .clickable(enabled = enabled, role = Role.Button, onClickLabel = "Log ${t.label}", onClick = t.onClick)
            .heightIn(min = 96.dp).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(t.soft), contentAlignment = Alignment.Center) { AIcon(t.icon, null, t.tint, 18.dp) }
        Column {
            Text(t.label, style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink, maxLines = 1)
            Text(t.sub, style = Almanac.type.caption, color = c.faint, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun HabitsPanel(data: TodayResponse?, vm: QuickLogViewModel) {
    val c = Almanac.colors
    if (data == null) { repeat(3) { SkeletonBlock(1f, 44) }; return }
    val habits = data.habits.filter { it.today.scheduled }
    val overrides by vm.logger.overrides.collectAsStateWithLifecycle()
    if (habits.isEmpty()) { Text("No habits scheduled today. Create habits from the Habits tab.", style = Almanac.type.small, color = c.muted); return }
    habits.forEachIndexed { i, h ->
        val value = overrides["${h.id}@${data.today}"] ?: h.today.value
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(h.name, style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            HabitLogControl(h, value, onSet = { vm.logHabit(h, data.today, it) })
        }
        if (i < habits.lastIndex) Divider()
    }
}

@Composable
private fun NotePanel(data: TodayResponse?, saving: Boolean, onSave: (String) -> Unit) {
    var note by rememberSaveable(data?.checkIn?.note) { mutableStateOf(data?.checkIn?.note.orEmpty()) }
    Text("Today’s note. Saving replaces the existing note for today.", style = Almanac.type.caption, color = Almanac.colors.faint)
    LabeledField("Note", note, { note = it.take(2000) }, singleLine = false, minLines = 4, placeholder = "What happened, what to revisit…")
    AlmanacButton("Save note", { onSave(note) }, pending = saving, enabled = data != null, modifier = Modifier.fillMaxWidth())
}

@Composable
private fun ScalePanel(data: TodayResponse?, panel: Panel, vm: QuickLogViewModel) {
    val key = if (panel == Panel.Mood) "mood" else "energy"
    val scales by vm.scales.collectAsStateWithLifecycle()
    val server = if (panel == Panel.Mood) data?.checkIn?.mood else data?.checkIn?.energy
    val value = if (key in scales) scales[key] else server
    Text("Tap a number. Tap it again to clear.", style = Almanac.type.caption, color = Almanac.colors.faint)
    ScaleRow(if (panel == Panel.Mood) "Mood" else "Energy", value, { v -> data?.let { vm.setScale(it.today, key, v) } }, enabled = data != null, modifier = Modifier.semantics { contentDescription = "${key} scale" })
}

@Composable
private fun RevisionsPanel(data: TodayResponse?, vm: QuickLogViewModel) {
    val c = Almanac.colors
    val hidden by vm.hiddenRevisions.collectAsStateWithLifecycle()
    val list = data?.revisionsDue.orEmpty().filterNot { it.id in hidden }
    if (list.isEmpty()) { Text("No revisions due. Nice.", style = Almanac.type.small, color = c.muted); return }
    list.forEachIndexed { i, r ->
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(r.topicName, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${r.subjectName} · Rev ${r.step}" + if (r.overdueDays > 0) " · ${r.overdueDays}d late" else "", style = Almanac.type.caption, color = c.muted)
            }
            AlmanacButton("Done", { vm.completeRevision(r) }, icon = AlmanacIcon.Check, small = true)
        }
        if (i < list.lastIndex) Divider()
    }
}
