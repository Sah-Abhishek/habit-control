package com.almanac.tracker.feature.calendar

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.CalendarDayDetailResponse
import com.almanac.tracker.feature.insights.formatDuration
import com.almanac.tracker.feature.insights.formatOne
import com.almanac.tracker.feature.today.CheckInSheet
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val TITLE_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE · d MMM", Locale.getDefault())
private val FOCUS_LABELS = listOf("Poor", "Low", "Okay", "Good", "Deep")
private val METHOD_LABELS = mapOf(
    "lecture" to "Lecture", "reading" to "Reading", "notes" to "Notes", "practice" to "Practice",
    "problem_solving" to "Problem solving", "revision" to "Revision", "mock_test" to "Mock test", "project_work" to "Project work",
)

fun scoreHeadline(score: Double?): String = when {
    score == null -> "Nothing tracked"
    score >= 0.85 -> "A full day"
    score >= 0.6 -> "A solid day"
    score >= 0.3 -> "A lighter day"
    else -> "A quiet day"
}

@Composable
fun DayScreen(date: String) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "day-$date") { DayViewModel(container, date) }
    val load by vm.load.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var editing by rememberSaveable { mutableStateOf(false) }
    val parsed = runCatching { LocalDate.parse(date) }.getOrNull()
    // Server enforces "no future days" too; this just hides the button.
    val editable = parsed != null && !parsed.isAfter(LocalDate.now())

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Calendar", nav::back)
        if (parsed == null) {
            EmptyState("That date isn’t valid", "Go back and pick a day from the calendar.")
            return@RefreshablePage
        }
        LoadContent(load, onRetry = { vm.refresh() }) { d -> DayContent(d, parsed, editable) { editing = true } }
    }
    if (editing) CheckInSheet(date = date, onDismiss = { editing = false })
}

@Composable
private fun DayContent(d: CalendarDayDetailResponse, date: LocalDate, editable: Boolean, onEdit: () -> Unit) {
    val c = Almanac.colors
    Row(verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            MonoLabel(date.format(TITLE_FMT), c.ochre)
            Text(scoreHeadline(d.score), style = Almanac.type.headline, color = c.ink)
        }
        if (editable) AlmanacButton("Edit check-in", onEdit, kind = ButtonKind.Secondary, icon = AlmanacIcon.Edit, small = true)
    }
    val e = d.entry
    val doneHabits = d.habits.count { it.state in setOf("done", "clear", "within") }
    val scheduled = d.habits.count { it.state != "off" && it.state != "future" }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Stat("Study", formatDuration(d.studySeconds), Modifier.weight(1f), c.ochre)
        Stat("Habits", "$doneHabits/$scheduled", Modifier.weight(1f), c.moss)
        Stat("Tasks", "${d.tasksCompleted.size}", Modifier.weight(1f))
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Stat("Sleep", e.sleep?.let { "${formatOne(it.hours)}h" } ?: "—", Modifier.weight(1f), c.dusk)
        Stat("Mood", e.mood?.toString() ?: "—", Modifier.weight(1f))
        Stat("Energy", e.energy?.toString() ?: "—", Modifier.weight(1f))
    }
    if (e.stress != null || e.sleep != null) {
        Text(
            listOfNotNull(
                e.sleep?.let { "Slept ${it.bed} → ${it.wake}" + (it.quality?.let { q -> " · quality $q/10" } ?: "") },
                e.stress?.let { "Stress $it/10" },
            ).joinToString(" · "),
            style = Almanac.type.caption, color = c.muted,
        )
    }
    e.focus.label?.let {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            MonoLabel("Focus")
            Text(it, style = Almanac.type.small, color = c.ink)
        }
    }
    if (!e.note.isNullOrBlank()) {
        AlmanacCard(color = c.sunken) {
            Text("“${e.note}”", style = Almanac.type.title.copy(fontStyle = FontStyle.Italic), color = c.muted)
        }
    }

    AlmanacCard {
        SectionHeader("Sessions", meta = if (d.sessions.isEmpty()) null else "${d.sessions.size}")
        if (d.sessions.isEmpty()) Text("No study sessions this day.", style = Almanac.type.small, color = c.muted)
        d.sessions.forEachIndexed { i, s ->
            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(s.startedAt.toLocalTimeLabel(), style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted)
                Column(Modifier.weight(1f)) {
                    Text(listOfNotNull(s.subjectName, s.topicName).joinToString(" · ").ifEmpty { "Study session" }, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1)
                    Text(
                        listOfNotNull(s.method?.let { METHOD_LABELS[it] ?: it }, s.focus?.let { "Focus: ${FOCUS_LABELS.getOrNull(it - 1) ?: it}" }).joinToString(" · ").ifEmpty { " " },
                        style = Almanac.type.caption, color = c.muted,
                    )
                }
                Text(formatDuration(s.durationSeconds ?: 0), style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = c.ink)
            }
            if (i < d.sessions.lastIndex) Divider()
        }
    }

    AlmanacCard {
        SectionHeader("Habits", meta = if (scheduled > 0) "$doneHabits of $scheduled" else null)
        if (d.habits.isEmpty()) Text("No habits were scheduled.", style = Almanac.type.small, color = c.muted)
        d.habits.forEach { h ->
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(h.name, style = Almanac.type.body, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1)
                val (label, tone) = when (h.state) {
                    "done" -> "Done" to Tone.Moss
                    "clear" -> "Clear" to Tone.Moss
                    "within" -> "Within limit" to Tone.Moss
                    "partial" -> "Partly" to Tone.Ochre
                    "over" -> "Over limit" to Tone.Clay
                    "off" -> "Not scheduled" to Tone.Neutral
                    "pending" -> "Not yet" to Tone.Neutral
                    else -> "Missed" to Tone.Neutral
                }
                Pill(label, tone)
            }
        }
    }

    if (d.tasksCompleted.isNotEmpty()) {
        AlmanacCard {
            SectionHeader("Completed", meta = "${d.tasksCompleted.size}")
            d.tasksCompleted.forEach { Text("✓  ${it.title}", style = Almanac.type.small, color = c.muted) }
        }
    }
    Spacer(Modifier.padding(4.dp))
}

/** ISO instant → local "HH:mm" on this device (sessions already belong to this day). */
private fun String.toLocalTimeLabel(): String = runCatching {
    java.time.Instant.parse(this).atZone(java.time.ZoneId.systemDefault()).toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrDefault("—")
