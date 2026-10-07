package com.almanac.tracker.feature.calendar

import com.almanac.tracker.ui.components.currentLocale
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.CalendarDayDto
import com.almanac.tracker.core.model.CalendarResponse
import com.almanac.tracker.feature.insights.formatDuration
import com.almanac.tracker.navigation.DayKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.Dot
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun CalendarScreen(month: String?) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "calendar-${month ?: "now"}") { CalendarViewModel(container, month) }
    val load by vm.load.collectAsStateWithLifecycle()
    val current by vm.month.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    val c = Almanac.colors

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Back", nav::back) {
            IconButton(onClick = { vm.shift(-1) }, enabled = current != null) { AIcon(AlmanacIcon.Back, "Previous month", c.ink) }
            IconButton(onClick = { vm.shift(1) }, enabled = current != null) { AIcon(AlmanacIcon.Forward, "Next month", c.ink) }
        }
        val m = current
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(m?.month?.getDisplayName(TextStyle.FULL, currentLocale()) ?: "Calendar", style = Almanac.type.display, color = c.ink)
            if (m != null) Text("${m.year}", style = Almanac.type.display, color = c.faint)
        }
        LoadContent(load, onRetry = { vm.refresh() }, skeleton = { SkeletonCard(6) }) { data ->
            val ym = m ?: parseMonth(data.month) ?: YearMonth.now()
            MonthGrid(data, ym) { nav.go(DayKey(it.toString())) }
            if (data.month != LocalDate.parse(data.today).let { YearMonth.from(it).toString() }) {
                com.almanac.tracker.ui.components.AlmanacButton(
                    "Back to this month", { vm.goTo(YearMonth.from(LocalDate.parse(data.today))) },
                    kind = com.almanac.tracker.ui.components.ButtonKind.Secondary, small = true,
                )
            }
            MonthSummary(data)
        }
    }
}

@Composable
private fun MonthGrid(data: CalendarResponse, month: YearMonth, onOpen: (LocalDate) -> Unit) {
    val c = Almanac.colors
    val byDate = data.days.associateBy { it.date }
    val today = runCatching { LocalDate.parse(data.today) }.getOrNull()
    AlmanacCard(padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 16.dp)) {
        Row(Modifier.fillMaxWidth().clearAndSetSemantics { }) {
            weekdayHeaders(data.weekStartsOn).forEach { h ->
                Text(h, style = Almanac.type.label, color = c.faint, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
        buildMonthGrid(month, data.weekStartsOn).forEach { week ->
            Row(Modifier.fillMaxWidth()) {
                week.forEach { date ->
                    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                        if (date != null) DayCell(date, byDate[date.toString()], date == today, onOpen)
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) { listOf(0.25f, 0.6f, 1f).forEach { Dot(c.moss.copy(alpha = it), 10) } }
            Text("fuller day", style = Almanac.type.caption, color = c.muted)
            Dot(c.ochre, 6)
            Text("study target", style = Almanac.type.caption, color = c.muted)
            Box(Modifier.width(10.dp).height(2.dp).background(c.clay))
            Text("over limit", style = Almanac.type.caption, color = c.muted)
        }
    }
}

private val DESC_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEEE d MMMM", Locale.getDefault())

/** Text description so state is never conveyed by color alone. */
fun describeDay(date: LocalDate, d: CalendarDayDto?, isToday: Boolean): String = buildString {
    append(date.format(DESC_FMT))
    if (isToday) append(", today")
    when {
        d == null || d.future -> append(", upcoming")
        d.beforeAccount -> append(", before you joined")
        d.score == null -> append(", nothing tracked")
        else -> {
            append(", ${(d.score * 100).toInt()}% of your plan")
            if (d.studySeconds > 0) append(", studied ${formatDuration(d.studySeconds)}")
            if (d.studyTargetHit) append(", study target hit")
            if (d.habitsScheduled > 0) append(", habits ${d.habitsOnTrack} of ${d.habitsScheduled}")
            if (d.reduceOver) append(", went over a limit")
        }
    }
}

@Composable
private fun DayCell(date: LocalDate, d: CalendarDayDto?, isToday: Boolean, onOpen: (LocalDate) -> Unit) {
    val c = Almanac.colors
    val future = d?.future ?: true
    val muted = d?.beforeAccount == true
    val score = d?.score
    val fill = when {
        score == null || future || muted -> null
        else -> c.moss.copy(alpha = (0.15f + score.toFloat() * 0.85f).coerceIn(0.15f, 1f))
    }
    val textColor = when {
        muted -> c.faint
        score != null && score > 0.55 -> c.mossOn
        else -> c.ink
    }
    Column(
        Modifier
            .padding(vertical = 3.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable(enabled = !future, onClick = { onOpen(date) })
            .semantics(mergeDescendants = true) {
                contentDescription = describeDay(date, d, isToday)
                role = Role.Button
            }
            .padding(2.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            Modifier
                .size(38.dp)
                .aspectRatio(1f)
                .then(if (isToday) Modifier.border(2.dp, c.ink, CircleShape) else Modifier)
                .padding(if (isToday) 3.dp else 0.dp)
                .clip(CircleShape)
                .then(if (fill != null) Modifier.background(fill) else Modifier.border(1.dp, if (muted) c.hair else c.hair, CircleShape)),
            contentAlignment = Alignment.Center,
        ) {
            Text("${date.dayOfMonth}", style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = textColor)
        }
        Row(Modifier.height(6.dp).padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
            if (d?.studyTargetHit == true) Dot(c.ochre, 4)
            if (d?.reduceOver == true) Box(Modifier.width(8.dp).height(2.dp).background(c.clay))
        }
    }
}

@Composable
private fun MonthSummary(data: CalendarResponse) {
    val c = Almanac.colors
    val tracked = data.days.filter { !it.future && !it.beforeAccount && it.score != null }
    if (tracked.isEmpty()) {
        com.almanac.tracker.ui.components.EmptyState(
            "Nothing tracked this month yet",
            "Days fill in as you log study sessions, habits and tasks. Tap any past day to see or fix what happened.",
        )
        return
    }
    val studied = tracked.sumOf { it.studySeconds }
    AlmanacCard {
        MonoLabel("This month so far")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Stat("Study", formatDuration(studied), Modifier.weight(1f))
            Stat("Target hit", "${tracked.count { it.studyTargetHit }} days", Modifier.weight(1f))
            Stat("Tasks done", "${tracked.sumOf { it.tasksCompleted }}", Modifier.weight(1f))
        }
        Text("Tap a day for details. Lighter circles are lighter days — not failures.", style = Almanac.type.caption, color = c.faint)
    }
}

@Composable
internal fun Stat(label: String, value: String, modifier: Modifier = Modifier, valueColor: androidx.compose.ui.graphics.Color = Almanac.colors.ink) {
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(Almanac.colors.sunken).padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        MonoLabel(label)
        Text(value, style = Almanac.type.data, color = valueColor, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

