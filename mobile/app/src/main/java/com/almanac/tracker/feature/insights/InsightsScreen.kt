package com.almanac.tracker.feature.insights

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.InsightsResponse
import com.almanac.tracker.navigation.CalendarKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.WeeklyReviewKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.PageTitle
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.components.Trail
import com.almanac.tracker.ui.theme.Almanac
import kotlin.math.roundToInt

@Composable
fun InsightsScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { InsightsViewModel(container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val range by vm.range.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    val c = Almanac.colors

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        PageTitle("What’s working, and what isn’t.", eyebrow = "Insights · ${range.long}")
        Segmented(InsightRange.entries.map { it to it.label }, range, vm::select)
        // Entry points that always work, even with no data.
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            EntryTile("Weekly review", "Your last week, summarised", AlmanacIcon.Spark, Modifier.weight(1f)) { nav.go(WeeklyReviewKey()) }
            EntryTile("Calendar", "Day by day", AlmanacIcon.Calendar, Modifier.weight(1f)) { nav.go(CalendarKey()) }
        }
        LoadContent(load, onRetry = { vm.refresh() }) { data -> InsightsContent(data) }
    }
}

@Composable
private fun EntryTile(title: String, sub: String, icon: AlmanacIcon, modifier: Modifier, onClick: () -> Unit) {
    val c = Almanac.colors
    Column(
        modifier.clip(RoundedCornerShape(18.dp)).background(c.inverse).clickable(onClick = onClick).semantics { role = Role.Button }.padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        AIcon(icon, null, c.ochre, 18.dp)
        Text(title, style = Almanac.type.bodyStrong, color = c.inverseInk)
        Text(sub, style = Almanac.type.caption, color = c.inverseInk.copy(alpha = 0.7f), maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun Kpi(label: String, value: String, sub: String, subColor: androidx.compose.ui.graphics.Color, modifier: Modifier) {
    val c = Almanac.colors
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(c.card).padding(14.dp).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        MonoLabel(label)
        Text(value, style = Almanac.type.title.copy(fontSize = Almanac.type.headline.fontSize), color = c.ink, maxLines = 1)
        Text(sub, style = Almanac.type.caption, color = subColor, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun InsightsContent(d: InsightsResponse) {
    val c = Almanac.colors
    val k = d.kpis
    val nothing = k.studySeconds == 0L && d.habitThreads.isEmpty() && d.wellbeing.none { it.mood != null || it.sleepHours != null }
    if (nothing) {
        com.almanac.tracker.ui.components.EmptyState(
            "Insights appear as you log",
            "Study sessions, habits and check-ins fill these charts in. Patterns need about two weeks of data before we point any out.",
        )
        return
    }
    val change = k.prevStudySeconds?.takeIf { it > 0 }?.let { (k.studySeconds - it).toDouble() / it }
    val rows = listOf(
        listOf(
            Triple("Study", formatHours(k.studySeconds), (change?.let { "${if (it >= 0) "↑" else "↓"} ${(kotlin.math.abs(it) * 100).roundToInt()}% vs prev" } ?: "no earlier period") to if ((change ?: 0.0) >= 0) c.moss else c.clay),
            Triple("Avg / day", formatDuration(k.avgDailySeconds), "target ${formatDuration(k.targetSeconds)}" to c.ochre),
        ),
        listOf(
            Triple("Consistency", formatPercent(if (k.consistency.total > 0) k.consistency.days.toDouble() / k.consistency.total else null), "${k.consistency.days} of ${k.consistency.total} days" to c.moss),
            Triple("Focus", k.avgFocus?.let { "${formatOne(it)} / 5" } ?: "—", "${k.focusSessions} rated sessions" to c.muted),
        ),
        listOf(
            Triple("Accuracy", formatPercent(k.accuracy), "${k.correct} of ${k.attempted} questions" to c.muted),
            Triple("Revisions", formatPercent(if (k.revisions.due > 0) k.revisions.done.toDouble() / k.revisions.due else null), "${k.revisions.done} of ${k.revisions.due} due" to c.muted),
        ),
    )
    rows.forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            row.forEach { (label, value, sub) -> Kpi(label, value, sub.first, sub.second, Modifier.weight(1f)) }
        }
    }

    AlmanacCard {
        SectionHeader("Study hours per week")
        if (d.weekly.isEmpty() || d.weekly.all { it.seconds == 0L }) {
            Text("No study sessions in this range yet. Start one from Today or the + button.", style = Almanac.type.small, color = c.muted)
        } else {
            WeeklyHoursChart(d.weekly, d.weeklyTargetSeconds)
        }
    }

    AlmanacCard {
        SectionHeader("Habit threads")
        Text("A gap is a missed day — the thread continues.", style = Almanac.type.caption, color = c.faint)
        if (d.habitThreads.isEmpty()) Text("Create a habit to see its thread here.", style = Almanac.type.small, color = c.muted)
        d.habitThreads.forEach { t ->
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t.name, style = Almanac.type.small, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val arrow = when (t.trend) { "up" -> " ↗"; "down" -> " ↘"; "flat" -> " →"; else -> "" }
                    Text(formatPercent(t.rate) + arrow, style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted)
                }
                // Up to the last 60 days so ticks stay readable on a phone.
                Trail(t.ticks.takeLast(60), t.kind, tickWidth = 3, gap = 2, maxHeight = 16)
            }
        }
    }

    AlmanacCard {
        SectionHeader("Effort vs exam weight")
        val weighted = d.effort.filter { it.weightShare != null }
        if (weighted.isEmpty()) {
            Text("Set an exam weight on your subjects (Plan → subject) to compare where your time goes with what the exam rewards.", style = Almanac.type.small, color = c.muted)
        } else {
            Text("Bar: your share of study time · grey: share of marks", style = Almanac.type.caption, color = c.faint)
            weighted.forEach { e ->
                Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.semantics(mergeDescendants = true) {}) {
                    Row {
                        Text(e.name, style = Almanac.type.small, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1)
                        Text("${formatPercent(e.timeShare)} time · ${formatPercent(e.weightShare)} marks${if (e.underInvested) " · under" else ""}", style = Almanac.type.label, color = if (e.underInvested) c.clay else c.muted)
                    }
                    ShareBar(listOf(e.timeShare.coerceAtMost(1.0) to if (e.underInvested) c.clay else c.moss))
                    ShareBar(listOf((e.weightShare ?: 0.0).coerceAtMost(1.0) to c.faint.copy(alpha = 0.6f)))
                }
            }
        }
    }

    AlmanacCard {
        SectionHeader("When you focus best")
        FocusByHour(d.focusByHour)
        val best = d.focusByHour.filter { it.sessions >= 3 && it.avgFocus != null }.maxByOrNull { it.avgFocus!! }
        Text(
            best?.let { "Sessions starting around ${"%02d".format(it.hour)}:00 average ${formatOne(it.avgFocus)}/5 focus. Hours with fewer than 3 sessions are faint." }
                ?: "Rate your focus when you finish sessions; patterns show after a few in the same hour.",
            style = Almanac.type.caption, color = c.muted,
        )
    }

    AlmanacCard {
        SectionHeader("Sleep, mood & energy")
        if (d.wellbeing.count { it.sleepHours != null || it.mood != null || it.energy != null } < 2) {
            Text("Log sleep and a quick check-in on Today to see these lines.", style = Almanac.type.small, color = c.muted)
        } else {
            WellbeingChart(d.wellbeing)
        }
    }

    AlmanacCard(color = c.duskSoft) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            AIcon(AlmanacIcon.Spark, null, c.dusk, 16.dp)
            MonoLabel("Observations · not causes", c.dusk)
        }
        if (d.observations.isEmpty()) {
            Text("Nothing stands out yet. We only point out patterns with at least 14 days of paired data.", style = Almanac.type.small, color = c.ink)
        }
        d.observations.forEach { o ->
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(o.text, style = Almanac.type.title.copy(fontSize = Almanac.type.body.fontSize * 1.15f), color = c.ink)
                Text("Based on ${o.n} days${if (o.earlySignal) " · early signal" else ""} · a pattern, not a cause", style = Almanac.type.caption, color = c.muted)
            }
        }
    }
    Spacer(Modifier.padding(4.dp))
}
