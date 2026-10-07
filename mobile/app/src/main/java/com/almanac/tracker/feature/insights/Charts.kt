package com.almanac.tracker.feature.insights

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.FocusHourDto
import com.almanac.tracker.core.model.WeeklyHoursDto
import com.almanac.tracker.core.model.WellbeingDto
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val WEEK_FMT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())

/** Study hours per week with the weekly target as a dashed line; the current (partial) week is faint. */
@Composable
fun WeeklyHoursChart(weeks: List<WeeklyHoursDto>, targetSeconds: Long, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val hours = weeks.map { it.seconds / 3600.0 }
    val target = targetSeconds / 3600.0
    val max = niceMax(hours, target.takeIf { it > 0 })
    val hit = weeks.count { !it.partial && targetSeconds > 0 && it.seconds >= targetSeconds }
    val summary = "Study hours per week for ${weeks.size} weeks. " +
        (if (targetSeconds > 0) "Target ${formatHours(targetSeconds)} a week; met in $hit weeks. " else "") +
        weeks.joinToString("; ") { "week of ${it.weekStart}: ${formatHours(it.seconds)}${if (it.partial) " so far" else ""}" }
    Column(modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(150.dp).semantics { contentDescription = summary }) {
            val n = weeks.size.coerceAtLeast(1)
            val slot = size.width / n
            val bw = (slot * 0.62f).coerceAtMost(30.dp.toPx())
            weeks.forEachIndexed { i, w ->
                val h = scale(w.seconds / 3600.0, max) * size.height
                val x = i * slot + (slot - bw) / 2
                val color = if (w.partial) c.ochre.copy(alpha = 0.35f) else c.ochre.copy(alpha = if (targetSeconds > 0 && w.seconds >= targetSeconds) 1f else 0.75f)
                drawRoundRect(color, Offset(x, size.height - h), Size(bw, h.coerceAtLeast(2f)), CornerRadius(5.dp.toPx()))
                if (w.partial) {
                    drawRoundRect(c.ochre, Offset(x, size.height - h), Size(bw, h.coerceAtLeast(2f)), CornerRadius(5.dp.toPx()), style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f))))
                }
            }
            if (target > 0) {
                val y = size.height - scale(target, max) * size.height
                drawLine(c.moss, Offset(0f, y), Offset(size.width, y), strokeWidth = 1.5.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(14f, 9f)))
            }
        }
        Row(Modifier.fillMaxWidth().clearAndSetSemantics { }) {
            Text(weeks.firstOrNull()?.weekStart?.let { runCatching { LocalDate.parse(it).format(WEEK_FMT) }.getOrNull() } ?: "", style = Almanac.type.label, color = c.faint)
            Spacer(Modifier.weight(1f))
            if (targetSeconds > 0) Text("— — target ${formatHours(targetSeconds)}", style = Almanac.type.label, color = c.moss)
            Spacer(Modifier.weight(1f))
            Text("this week", style = Almanac.type.label, color = c.faint)
        }
    }
}

/** 24 cells; solid when there are ≥3 sessions starting in that hour, faint otherwise. */
@Composable
fun FocusByHour(hours: List<FocusHourDto>, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val byHour = hours.associateBy { it.hour }
    val best = hours.filter { it.sessions >= 3 && it.avgFocus != null }.maxByOrNull { it.avgFocus!! }
    val summary = if (best == null) "Not enough sessions yet to show your best hours."
    else "Average focus by start hour. Best: ${"%02d".format(best.hour)}:00 with ${formatOne(best.avgFocus)} out of 5 over ${best.sessions} sessions."
    Column(modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = summary }) {
        Row(Modifier.fillMaxWidth().height(30.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            for (h in 0..23) {
                val e = byHour[h]
                val focus = e?.avgFocus
                val color = when {
                    focus == null || e.sessions == 0 -> c.sunken
                    e.sessions < 3 -> c.ochre.copy(alpha = 0.18f)
                    else -> c.ochre.copy(alpha = (0.2f + (focus.toFloat() - 1f) / 4f * 0.8f).coerceIn(0.2f, 1f))
                }
                Box(Modifier.weight(1f).height(30.dp).clip(RoundedCornerShape(4.dp)).background(color))
            }
        }
        Row(Modifier.fillMaxWidth().clearAndSetSemantics { }) {
            listOf("00", "06", "12", "18", "23").forEachIndexed { i, l ->
                if (i > 0) Spacer(Modifier.weight(1f))
                Text(l, style = Almanac.type.label, color = c.faint)
            }
        }
    }
}

/** Sleep hours (scaled 4–10h), mood and energy (1–10) as three lines. */
@Composable
fun WellbeingChart(points: List<WellbeingDto>, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    fun avg(sel: (WellbeingDto) -> Double?) = points.mapNotNull(sel).takeIf { it.isNotEmpty() }?.average()
    val summary = "Averages over the period: sleep ${formatOne(avg { it.sleepHours })} hours, mood ${formatOne(avg { it.mood })}, energy ${formatOne(avg { it.energy })} out of 10."
    Column(modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.clearAndSetSemantics { }) {
            Legend(c.dusk, "Sleep ${formatOne(avg { it.sleepHours })}h")
            Legend(c.moss, "Mood ${formatOne(avg { it.mood })}")
            Legend(c.ochre, "Energy ${formatOne(avg { it.energy })}")
        }
        Canvas(Modifier.fillMaxWidth().height(110.dp).semantics { contentDescription = summary }) {
            val n = points.size
            if (n < 2) return@Canvas
            fun line(color: Color, value: (WellbeingDto) -> Double?, lo: Double, hi: Double) {
                val path = Path()
                var started = false
                points.forEachIndexed { i, p ->
                    val v = value(p)
                    if (v == null) { started = false; return@forEachIndexed }
                    val x = i * size.width / (n - 1)
                    val y = size.height - (((v - lo) / (hi - lo)).coerceIn(0.0, 1.0) * size.height).toFloat()
                    if (!started) { path.moveTo(x, y); started = true } else path.lineTo(x, y)
                }
                drawPath(path, color, style = Stroke(2.dp.toPx()))
            }
            line(c.dusk, { it.sleepHours }, 4.0, 10.0)
            line(c.moss, { it.mood }, 1.0, 10.0)
            line(c.ochre, { it.energy }, 1.0, 10.0)
        }
    }
}

@Composable
fun Legend(color: Color, label: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Box(Modifier.width(14.dp).height(3.dp).background(color))
        Text(label, style = Almanac.type.caption, color = Almanac.colors.muted)
    }
}

/** Horizontal bar of shares (0..1) in the given colors. */
@Composable
fun ShareBar(shares: List<Pair<Double, Color>>, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(7.dp)).background(Almanac.colors.sunken).clearAndSetSemantics { }) {
        shares.filter { it.first > 0 }.forEach { (share, color) ->
            Box(Modifier.weight(share.toFloat().coerceAtLeast(0.001f)).height(14.dp).background(color))
        }
        val rest = 1.0 - shares.sumOf { it.first }
        if (rest > 0.001) Spacer(Modifier.weight(rest.toFloat()))
    }
}

