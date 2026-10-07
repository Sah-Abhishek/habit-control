package com.almanac.tracker.feature.habits

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.ConsistencyDto
import com.almanac.tracker.core.model.HabitDetailResponse
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.components.Trail
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

@Composable
fun HabitDetailScreen(id: String) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "habit-$id") { HabitDetailViewModel(id, container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val gone by vm.gone.collectAsStateWithLifecycle()
    val overrides by vm.logger.overrides.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    var editing by rememberSaveable { mutableStateOf(false) }
    var menu by rememberSaveable { mutableStateOf(false) }
    var confirmDelete by rememberSaveable { mutableStateOf(false) }
    CollectNotices(vm.notices)
    LaunchedEffect(gone) { if (gone) nav.back() }
    val data = (load as? Load.Ready)?.data

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Habits", nav::back) {
            if (data != null) {
                IconButton(onClick = { menu = true }) { AIcon(AlmanacIcon.More, "More actions", Almanac.colors.ink) }
                DropdownMenu(menu, { menu = false }) {
                    if (!data.habit.archived) DropdownMenuItem({ Text("Edit") }, { menu = false; editing = true })
                    DropdownMenuItem({ Text(if (data.habit.archived) "Restore" else "Archive") }, { menu = false; vm.setArchived(data.habit.name, !data.habit.archived) })
                    DropdownMenuItem({ Text("Delete…", color = Almanac.colors.clay) }, { menu = false; confirmDelete = true })
                }
            }
        }
        LoadContent(load, onRetry = { vm.refresh() }) { d -> Detail(d, overrides, vm) }
    }
    if (editing && data != null) HabitEditorSheet(data.habit, onDismiss = { editing = false }, save = vm::save)
    if (confirmDelete && data != null) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete “${data.habit.name}”?") },
            text = { Text("This permanently removes the habit and every day you logged. Archive instead to keep the history.") },
            confirmButton = { TextButton({ confirmDelete = false; vm.delete(data.habit.name) }) { Text("Delete forever", color = Almanac.colors.clay) } },
            dismissButton = { TextButton({ confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

private val DAY_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault())
private val SINCE_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault())

private fun pct(c: ConsistencyDto) = c.rate?.let { "${(it * 100).roundToInt()}%" } ?: "—"
private fun r1(v: Double?) = v?.let { formatAmount((it * 10).roundToInt() / 10.0) } ?: "—"

@Composable
private fun Detail(d: HabitDetailResponse, overrides: Map<String, Double>, vm: HabitDetailViewModel) {
    val h = d.habit
    val c = Almanac.colors
    val r = h.reduction
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Pill(if (h.isReduce) "Reducing" else "Building", if (h.isReduce) Tone.Clay else Tone.Moss)
            if (h.archived) Pill("Archived")
            if (h.isSensitive) Pill("Sensitive", Tone.Dusk)
        }
        Text(h.name, style = Almanac.type.display, color = c.ink)
        val since = runCatching { LocalDate.parse(h.startedOn).format(SINCE_FMT) }.getOrDefault(h.startedOn)
        Text(
            "Since $since" + if (h.isReduce) " · limit ${formatAmount(h.target)} / day" + (h.baseline?.let { " · baseline ${formatAmount(it)}" } ?: "") else "",
            style = Almanac.type.small, color = c.muted,
        )
    }

    if (r != null) {
        AlmanacCard {
            MonoLabel("7-day average")
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(r1(r.weekAvg), style = Almanac.type.bigNumber.copy(fontSize = Almanac.type.bigNumber.fontSize * 1.2f), color = c.ink)
                if (r.weekChange != null) {
                    Column(Modifier.padding(bottom = 6.dp)) {
                        Text("${if (r.weekChange >= 0) "↓" else "↑"} ${(abs(r.weekChange) * 100).roundToInt()}%", style = Almanac.type.data, color = if (r.weekChange >= 0) c.moss else c.clay)
                        Text("from ${r1(r.prevWeekAvg)} the week before", style = Almanac.type.caption, color = c.muted)
                    }
                } else {
                    Text("Comparison appears after two weeks.", style = Almanac.type.caption, color = c.muted, modifier = Modifier.padding(bottom = 6.dp))
                }
            }
            BaselineChart(d.weeklyAverages, h.baseline, h.target)
            Text(
                r.avoidedVsBaseline?.let { "≈ $it fewer times than your baseline since you started. Days without a log count as zero." }
                    ?: "Add a baseline (Edit) to see how much you’ve avoided. Days without a log count as zero.",
                style = Almanac.type.caption, color = c.muted,
            )
        }
        if (r.todayValue > 0) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.sunken).padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(formatAmount(r.todayValue), style = Almanac.type.data, color = c.clay)
                Text(
                    "logged today" + (if (r.todayValue <= h.target) " — inside your limit." else ".") + " One day doesn’t undo your trend; your progress stays exactly where it is.",
                    style = Almanac.type.small, color = c.ink,
                )
            }
        }
        StatGrid(
            listOf(
                Triple("Clear days", "${r.clearDaysLast30} / 30", "last 30 days"),
                Triple("Best clear run", "${r.longestClearRun} days", null),
                Triple("Monthly avg", r1(r.monthAvg), r.prevMonthAvg?.let { "prev ${r1(it)}" } ?: "first month"),
                Triple("Since last", when (r.daysSinceLast) { null -> "never"; 0 -> "today"; else -> "${r.daysSinceLast} days" }, null),
            ),
        )
    }

    StatGrid(
        listOf(
            Triple("7 days", pct(h.consistency.d7), "${h.consistency.d7.successes} of ${h.consistency.d7.scheduled}"),
            Triple("30 days", pct(h.consistency.d30), "${h.consistency.d30.successes} of ${h.consistency.d30.scheduled}"),
            Triple("90 days", pct(h.consistency.d90), "${h.consistency.d90.successes} of ${h.consistency.d90.scheduled}"),
            Triple("Streak", "${h.streak.current}", "best ${h.streak.best}"),
        ),
    )

    AlmanacCard {
        SectionHeader("Last 90 days")
        Text("A gap is a missed day — the thread continues.", style = Almanac.type.caption, color = c.faint)
        Trail(d.thread90, h.kind, tickWidth = 2, gap = 1, maxHeight = 20)
    }

    AlmanacCard {
        SectionHeader("Recent days")
        Text("Forgot a day? Fix it here.", style = Almanac.type.caption, color = c.faint)
        d.recentDays.forEachIndexed { i, t ->
            val value = overrides["${h.id}@${t.date}"] ?: t.value
            Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                val label = runCatching { LocalDate.parse(t.date).format(DAY_FMT) }.getOrDefault(t.date)
                Text(if (i == 0) "Today" else label, style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted, modifier = Modifier.width(96.dp))
                Spacer(Modifier.weight(1f))
                if (t.state == "off" || h.archived) {
                    Text(if (t.state == "off") "not scheduled" else formatAmount(value), style = Almanac.type.caption, color = c.faint)
                } else {
                    HabitLogControl(h, value, onSet = { vm.log(h, t.date, t.value, it) })
                }
            }
            if (i < d.recentDays.lastIndex) Divider()
        }
    }
}

@Composable
private fun StatGrid(items: List<Triple<String, String, String?>>) {
    val c = Almanac.colors
    items.chunked(2).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            row.forEach { (label, value, sub) ->
                Column(
                    Modifier.weight(1f).clip(RoundedCornerShape(18.dp)).background(c.card).padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                ) {
                    MonoLabel(label)
                    Text(value, style = Almanac.type.dataLarge, color = c.ink)
                    if (sub != null) Text(sub, style = Almanac.type.caption.copy(fontWeight = FontWeight.Normal), color = c.faint)
                }
            }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}
