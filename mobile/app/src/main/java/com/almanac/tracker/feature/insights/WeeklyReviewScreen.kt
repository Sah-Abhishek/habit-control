package com.almanac.tracker.feature.insights

import androidx.compose.foundation.Canvas
import com.almanac.tracker.ui.components.currentLocale
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.WeeklyReviewResponse
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

private val RANGE_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())

@Composable
fun WeeklyReviewScreen(week: String?) {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "review-${week ?: "last"}") { WeeklyReviewViewModel(container, week) }
    val load by vm.load.collectAsStateWithLifecycle()
    val adding by vm.adding.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    val c = Almanac.colors
    CollectNotices(vm.notices)

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Insights", nav::back) {
            IconButton(onClick = { vm.shift(-1) }) { AIcon(AlmanacIcon.Back, "Previous week", c.ink) }
            IconButton(onClick = { vm.shift(1) }) { AIcon(AlmanacIcon.Forward, "Next week", c.ink) }
        }
        LoadContent(load, onRetry = { vm.refresh() }) { r -> Review(r, adding, vm::addSuggestionToPlan) }
    }
}

private fun fmt(date: String) = runCatching { LocalDate.parse(date).format(RANGE_FMT) }.getOrDefault(date)

@Composable
private fun Review(r: WeeklyReviewResponse, adding: Boolean, onAdd: (String) -> Unit) {
    val c = Almanac.colors
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        MonoLabel("Week ${r.weekNumber} · ${fmt(r.weekStart)} – ${fmt(r.weekEnd)}", c.ochre)
        Text("Your week, in review.", style = Almanac.type.display, color = c.ink)
    }

    AlmanacCard {
        MonoLabel("Study")
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(formatDuration(r.study.seconds), style = Almanac.type.bigNumber, color = c.ink)
            if (r.study.targetSeconds > 0) Text("/ ${formatHours(r.study.targetSeconds)} target", style = Almanac.type.small, color = c.muted, modifier = Modifier.padding(bottom = 6.dp))
            Box(Modifier.weight(1f))
            r.study.changePct?.let {
                Text("${if (it >= 0) "↑" else "↓"} ${(abs(it) * 100).roundToInt()}%", style = Almanac.type.data, color = if (it >= 0) c.moss else c.clay, modifier = Modifier.padding(bottom = 6.dp))
            }
        }
        if (r.study.targetSeconds > 0) ProgressBar((r.study.seconds.toFloat() / r.study.targetSeconds), color = c.ochre, height = 8, label = "Study vs weekly target")
        DayBars(r)
    }

    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Tile("Consistency", "${r.consistency.daysStudied} / ${r.consistency.days}", "days studied", c.moss, Modifier.weight(1f))
        Tile("Habits", r.habits.avgPerDay?.let { "${formatOne(it)} / ${formatOne(r.habits.scheduledPerDay)}" } ?: "—", "avg per day", c.ink, Modifier.weight(1f))
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Tile(
            "Sleep", r.sleep.avgHours?.let { formatDuration((it * 3600).toLong()) } ?: "—",
            r.sleep.changeMinutes?.let { "avg · ${if (it >= 0) "↑" else "↓"} ${abs(it).roundToInt()}m" } ?: "average", c.dusk, Modifier.weight(1f),
        )
        Tile("Mood · Energy", "${formatOne(r.mood)} · ${formatOne(r.energy)}", "out of 10", c.ink, Modifier.weight(1f))
    }

    if (r.subjects.isNotEmpty()) {
        val palette = listOf(c.moss, c.ochre, c.dusk, c.clay, c.faint)
        AlmanacCard {
            Text("Where the hours went", style = Almanac.type.bodyStrong, color = c.ink)
            ShareBar(r.subjects.mapIndexed { i, s -> s.share to palette[i % palette.size] })
            r.subjects.forEachIndexed { i, s ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(palette[i % palette.size]))
                    Text(s.name, style = Almanac.type.small, color = c.ink, modifier = Modifier.weight(1f))
                    Text(formatDuration(s.seconds), style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted)
                }
            }
        }
    }

    Section("What went well", c.moss, c.mossSoft, AlmanacIcon.Up, r.wentWell, "Log a few sessions and habits — wins show up here.")
    Section("Needs attention", c.clay, c.claySoft, AlmanacIcon.Alert, r.needsAttention, "Nothing flagged this week.")

    r.suggestion?.let { s ->
        AlmanacCard(color = c.inverse) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AIcon(AlmanacIcon.Spark, null, c.ochre, 16.dp)
                MonoLabel("Try next week", c.inverseInk)
            }
            Text(s, style = Almanac.type.title, color = c.inverseInk)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                AlmanacButton("Add to my plan", { onAdd(s) }, kind = ButtonKind.Accent, pending = adding, small = true)
            }
        }
    }
    Text(
        "Numbers come straight from your logs. Observations are patterns, not causes or medical advice.",
        style = Almanac.type.caption, color = c.faint,
    )
}

@Composable
private fun DayBars(r: WeeklyReviewResponse) {
    val c = Almanac.colors
    val days = r.study.byDay
    if (days.isEmpty()) return
    val max = niceMax(days.map { it.seconds / 3600.0 })
    val summary = days.joinToString("; ") { "${runCatching { LocalDate.parse(it.date).dayOfWeek.name.lowercase().replaceFirstChar(Char::uppercase) }.getOrDefault(it.date)}: ${formatDuration(it.seconds)}" }
    Column {
        Canvas(Modifier.fillMaxWidth().height(70.dp).semantics { contentDescription = "Study per day. $summary" }) {
            val slot = size.width / days.size
            val bw = (slot * 0.7f).coerceAtMost(34.dp.toPx())
            days.forEachIndexed { i, d ->
                val x = i * slot + (slot - bw) / 2
                drawRoundRect(c.sunken, Offset(x, 0f), Size(bw, size.height), CornerRadius(8.dp.toPx()))
                val h = scale(d.seconds / 3600.0, max) * size.height
                if (h > 0) drawRoundRect(c.ochre.copy(alpha = 0.85f), Offset(x, size.height - h), Size(bw, h), CornerRadius(8.dp.toPx()))
            }
        }
        Row(Modifier.fillMaxWidth()) {
            days.forEach { d ->
                val locale = currentLocale()
                val letter = runCatching { LocalDate.parse(d.date).dayOfWeek.getDisplayName(java.time.format.TextStyle.NARROW, locale) }.getOrDefault("")
                Text(letter, style = Almanac.type.label, color = if (d.seconds == 0L) c.clay else c.muted, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}

@Composable
private fun Tile(label: String, value: String, sub: String, valueColor: Color, modifier: Modifier) {
    val c = Almanac.colors
    Column(modifier.clip(RoundedCornerShape(18.dp)).background(c.card).padding(14.dp).semantics(mergeDescendants = true) {}, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        MonoLabel(label)
        Text(value, style = Almanac.type.dataLarge, color = valueColor, maxLines = 1)
        Text(sub, style = Almanac.type.caption, color = c.faint, maxLines = 1)
    }
}

@Composable
private fun Section(title: String, tone: Color, soft: Color, icon: AlmanacIcon, items: List<String>, empty: String) {
    val c = Almanac.colors
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(24.dp).clip(RoundedCornerShape(8.dp)).background(soft), contentAlignment = Alignment.Center) { AIcon(icon, null, tone, 14.dp) }
            Text(title, style = Almanac.type.title, color = c.ink)
        }
        if (items.isEmpty()) Text(empty, style = Almanac.type.small, color = c.muted)
        items.forEach { t ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.padding(top = 8.dp).size(5.dp).clip(CircleShape).background(tone))
                Text(t, style = Almanac.type.body, color = c.ink)
            }
        }
    }
}
