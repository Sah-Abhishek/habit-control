package com.almanac.tracker.feature.today

import android.os.SystemClock
import com.almanac.tracker.ui.components.currentLocale
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.DueRevisionDto
import com.almanac.tracker.core.model.ObservationDto
import com.almanac.tracker.core.model.PrimaryGoalDto
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.core.model.SleepDto
import com.almanac.tracker.core.model.TimelineBlockDto
import com.almanac.tracker.core.model.WeekDayDto
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.Dot
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.ScaleRow
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

/** 24h ring: sleep (dusk), study (ochre), running session (ochre, faint), now marker. */
@Composable
fun DayDial(blocks: List<TimelineBlockDto>, nowHour: Double, studySeconds: Long, targetSeconds: Long, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val desc = buildString {
        append("Today so far: ${TodayMath.formatDuration(studySeconds)} studied")
        if (targetSeconds > 0) append(" of ${TodayMath.formatDuration(targetSeconds)}")
        blocks.firstOrNull { it.kind == "sleep" }?.let { append(", slept ${TodayMath.formatDuration(((TodayMath.sweep(it.startHour, it.endHour) / 360f) * 86400).toLong())}") }
    }
    Box(modifier.size(168.dp).semantics { contentDescription = desc }, contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(168.dp)) {
            val stroke = 14.dp.toPx()
            val inset = stroke / 2 + 6.dp.toPx()
            val arcSize = Size(size.width - inset * 2, size.height - inset * 2)
            val topLeft = Offset(inset, inset)
            drawArc(c.hair, 0f, 360f, false, topLeft, arcSize, style = Stroke(stroke))
            for (b in blocks) {
                val color = when (b.kind) {
                    "sleep" -> c.dusk
                    "running" -> c.ochre.copy(alpha = 0.45f)
                    else -> c.ochre
                }
                drawArc(color, TodayMath.angleForHour(b.startHour), TodayMath.sweep(b.startHour, b.endHour).coerceAtLeast(2f), false, topLeft, arcSize, style = Stroke(stroke))
            }
            val r = arcSize.width / 2
            val center = Offset(size.width / 2, size.height / 2)
            val a = Math.toRadians(TodayMath.angleForHour(nowHour).toDouble())
            val p = Offset(center.x + (r * cos(a)).toFloat(), center.y + (r * sin(a)).toFloat())
            drawCircle(c.card, 9.dp.toPx(), p)
            drawCircle(c.ink, 6.dp.toPx(), p)
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(TodayMath.formatDuration(studySeconds), style = Almanac.type.headline, color = c.ink)
            Text(if (targetSeconds > 0) "of ${TodayMath.formatDuration(targetSeconds)} studied" else "studied", style = Almanac.type.caption, color = c.muted)
        }
    }
}

@Composable
fun DialLegendRow(color: Color, label: String, value: String, sub: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Dot(color)
            MonoLabel(label, Almanac.colors.muted)
        }
        Text(value, style = Almanac.type.data, color = Almanac.colors.ink, maxLines = 1)
        if (sub != null) Text(sub, style = Almanac.type.caption, color = Almanac.colors.faint, maxLines = 1)
    }
}

/** Live "Session running" strip; ticks locally from the server's elapsed seconds. */
@Composable
fun RunningSessionStrip(session: SessionDto, receivedAt: Long, onOpen: () -> Unit) {
    val c = Almanac.colors
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    val paused = session.pausedAt != null
    LaunchedEffect(paused) {
        while (!paused) {
            now = SystemClock.elapsedRealtime()
            delay(1000)
        }
    }
    val elapsed = (session.elapsedSeconds ?: 0) + if (paused) 0 else ((now - receivedAt) / 1000).coerceAtLeast(0)
    val what = listOfNotNull(session.subjectName, session.topicName).joinToString(" · ").ifEmpty { "Study session" }
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.inverse)
            .clickable(onClickLabel = "Open session", role = Role.Button, onClick = onOpen)
            .heightIn(min = 52.dp).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        AIcon(if (paused) AlmanacIcon.Pause else AlmanacIcon.Play, null, c.ochre, 18.dp)
        Column(Modifier.weight(1f)) {
            Text(if (paused) "Session paused" else "Session running", style = Almanac.type.caption, color = c.inverseInk.copy(alpha = 0.7f))
            Text(what, style = Almanac.type.bodyStrong, color = c.inverseInk, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(TodayMath.formatTimer(elapsed), style = Almanac.type.dataLarge, color = c.inverseInk)
        AIcon(AlmanacIcon.Forward, null, c.inverseInk, 16.dp)
    }
}

@Composable
fun RevisionsRow(items: List<DueRevisionDto>, onDone: (DueRevisionDto) -> Unit, onSnooze: (DueRevisionDto) -> Unit) {
    val c = Almanac.colors
    LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        items(items, key = { it.id }) { r ->
            Column(
                Modifier.width(176.dp).clip(RoundedCornerShape(16.dp)).background(c.card).border(1.dp, c.hair, RoundedCornerShape(16.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                MonoLabel("Rev ${r.step}" + when { r.overdueDays > 0 -> " · ${r.overdueDays}d late"; else -> " · today" }, if (r.overdueDays > 0) c.clay else c.ochre)
                Text(r.topicName, style = Almanac.type.bodyStrong, color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(r.subjectName, style = Almanac.type.caption, color = c.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        Modifier.clip(RoundedCornerShape(10.dp)).background(c.mossSoft).clickable(role = Role.Button) { onDone(r) }
                            .heightIn(min = 40.dp).padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        AIcon(AlmanacIcon.Check, null, c.moss, 14.dp)
                        Text("Done", style = Almanac.type.caption.copy(fontWeight = FontWeight.SemiBold), color = c.moss)
                    }
                    Text(
                        "Tomorrow",
                        style = Almanac.type.caption.copy(fontWeight = FontWeight.Medium), color = c.muted,
                        modifier = Modifier.clip(RoundedCornerShape(10.dp)).clickable(onClickLabel = "Snooze ${r.topicName} to tomorrow", role = Role.Button) { onSnooze(r) }
                            .heightIn(min = 40.dp).padding(horizontal = 8.dp, vertical = 11.dp),
                    )
                }
            }
        }
    }
}

@Composable
fun GoalCard(goal: PrimaryGoalDto, onOpen: () -> Unit) {
    val c = Almanac.colors
    AlmanacCard(Modifier.clickable(onClickLabel = "Open goal", role = Role.Button, onClick = onOpen)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MonoLabel("Main goal")
            Spacer(Modifier.weight(1f))
            when (goal.status) {
                "ahead" -> Pill("Ahead", Tone.Moss)
                "on_pace" -> Pill("On pace", Tone.Moss)
                "behind" -> Pill("Behind", Tone.Clay)
                else -> {}
            }
        }
        Row(verticalAlignment = Alignment.Bottom) {
            Text(goal.title, style = Almanac.type.title, color = c.ink, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(TodayMath.percent(goal.progress), style = Almanac.type.dataLarge, color = c.ink)
        }
        RouteLine(goal)
        val parts = buildList {
            goal.daysLeft?.let { add(if (it >= 0) "$it days left" else "${-it} days past target") }
            goal.expected?.let { add("plan says ${TodayMath.percent(it)} by today") }
            goal.estFinish?.let { add("est. finish ${prettyDate(it)}") }
        }
        if (parts.isNotEmpty()) Text(parts.joinToString(" · "), style = Almanac.type.caption, color = c.muted)
    }
}

/** Milestones as stations on a line; filled up to overall progress. */
@Composable
private fun RouteLine(goal: PrimaryGoalDto) {
    val c = Almanac.colors
    val n = goal.milestones.size
    Canvas(Modifier.fillMaxWidth().height(22.dp).semantics { contentDescription = "${goal.milestones.count { it.completed }} of $n milestones complete" }) {
        val y = size.height / 2
        val w = size.width
        drawLine(c.line, Offset(0f, y), Offset(w, y), 2.dp.toPx())
        drawLine(c.moss, Offset(0f, y), Offset(w * goal.progress.toFloat().coerceIn(0f, 1f), y), 2.dp.toPx())
        goal.milestones.forEachIndexed { i, m ->
            val x = if (n <= 1) w / 2 else 5.dp.toPx() + (w - 10.dp.toPx()) * i / (n - 1)
            val reached = m.completed || m.progress >= 100
            drawCircle(if (reached) c.moss else c.card, 5.dp.toPx(), Offset(x, y))
            drawCircle(if (reached) c.moss else c.line, 5.dp.toPx(), Offset(x, y), style = Stroke(2.dp.toPx()))
        }
        val you = Offset((w * goal.progress.toFloat()).coerceIn(8.dp.toPx(), w - 8.dp.toPx()), y)
        drawCircle(c.card, 8.dp.toPx(), you)
        drawCircle(c.ochre, 6.dp.toPx(), you)
    }
}

@Composable
fun WeekCard(week: List<WeekDayDto>, targetSeconds: Long, today: String) {
    val c = Almanac.colors
    val total = week.sumOf { it.seconds }
    val max = maxOf(targetSeconds, week.maxOfOrNull { it.seconds } ?: 0L, 1L)
    AlmanacCard {
        SectionHeader("This week", meta = "${TodayMath.formatClock(total)} / ${TodayMath.formatClock(targetSeconds * 7)}", metaColor = c.muted)
        Row(Modifier.fillMaxWidth().height(96.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            for (d in week) {
                val locale = currentLocale()
                val label = runCatching { LocalDate.parse(d.date).dayOfWeek.getDisplayName(TextStyle.NARROW, locale) }.getOrDefault("·")
                Column(Modifier.weight(1f).fillMaxHeight(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(
                        Modifier.weight(1f).fillMaxWidth().clip(RoundedCornerShape(8.dp))
                            .then(if (d.future) Modifier else Modifier.background(c.sunken))
                            .semantics { contentDescription = "${d.date}: ${if (d.future) "upcoming" else TodayMath.formatDuration(d.seconds)}" },
                        contentAlignment = Alignment.BottomCenter,
                    ) {
                        if (d.future) {
                            Canvas(Modifier.matchParentSize()) {
                                drawRoundRect(c.line, style = Stroke(1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f))), cornerRadius = androidx.compose.ui.geometry.CornerRadius(8.dp.toPx()))
                            }
                        } else if (d.seconds > 0) {
                            Box(Modifier.fillMaxWidth().fillMaxHeight((d.seconds.toFloat() / max).coerceIn(0.04f, 1f)).background(if (d.date == today) c.ochre else c.ochre.copy(alpha = 0.6f)))
                        }
                    }
                    Text(label, style = Almanac.type.label, color = if (d.date == today) c.ink else c.faint)
                }
            }
        }
    }
}

@Composable
fun ObservationCard(o: ObservationDto) {
    val c = Almanac.colors
    AlmanacCard(color = c.duskSoft) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AIcon(AlmanacIcon.Spark, null, c.dusk, 16.dp)
            MonoLabel(if (o.earlySignal) "Early signal" else "Observation", c.dusk)
        }
        Text(o.text, style = Almanac.type.title, color = c.ink)
        Text("Based on ${o.n} days · a pattern, not a cause.", style = Almanac.type.caption, color = c.muted)
    }
}

@Composable
fun CheckInCard(mood: Int?, energy: Int?, sleep: SleepDto?, onScale: (String, Int?) -> Unit, onEdit: () -> Unit) {
    val c = Almanac.colors
    AlmanacCard {
        SectionHeader("Quick check-in", meta = "optional", metaColor = c.faint)
        ScaleWithLabel("Energy", AlmanacIcon.Bolt, c.ochre, energy) { onScale("energy", it) }
        ScaleWithLabel("Mood", AlmanacIcon.Smile, c.dusk, mood) { onScale("mood", it) }
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.sunken)
                .clickable(onClickLabel = "Edit sleep and check-in", role = Role.Button, onClick = onEdit)
                .heightIn(min = 48.dp).padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            AIcon(AlmanacIcon.Moon, null, c.dusk, 16.dp)
            Text(
                if (sleep != null) "Slept ${TodayMath.formatDuration((sleep.hours * 3600).roundToInt().toLong())} · ${sleep.bed}–${sleep.wake}" + (sleep.quality?.let { " · quality $it/10" } ?: "")
                else "Log last night’s sleep",
                style = Almanac.type.small, color = c.ink, modifier = Modifier.weight(1f),
            )
            Text("Edit", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.moss)
        }
    }
}

@Composable
private fun ScaleWithLabel(label: String, icon: AlmanacIcon, tint: Color, value: Int?, onSelect: (Int?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            AIcon(icon, null, tint, 14.dp)
            Text(label, style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = Almanac.colors.ink)
            Text(if (value == null) "· not yet" else "· $value / 10", style = Almanac.type.caption, color = Almanac.colors.faint)
        }
        ScaleRow(label, value, onSelect)
    }
}

@Composable
fun HeaderIcon(icon: AlmanacIcon, description: String, onClick: () -> Unit) {
    val c = Almanac.colors
    IconButton(onClick = onClick, modifier = Modifier.size(48.dp)) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(14.dp)).background(c.card).border(1.dp, c.hair, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            AIcon(icon, description, c.ink, 20.dp)
        }
    }
}

@Composable
fun PlanBar(ratio: Double) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        ProgressBar(ratio.toFloat(), Modifier.weight(1f), label = "${TodayMath.percent(ratio)} of today’s plan")
        Text("${TodayMath.percent(ratio)} of today’s plan", style = Almanac.type.caption.copy(fontWeight = FontWeight.Medium), color = Almanac.colors.muted)
    }
}

fun prettyDate(iso: String): String = runCatching {
    val d = LocalDate.parse(iso)
    "${d.dayOfMonth} ${d.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())}" + if (d.year != LocalDate.now().year) " ${d.year}" else ""
}.getOrDefault(iso)

