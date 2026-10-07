package com.almanac.tracker.feature.plan

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.MilestoneDto
import com.almanac.tracker.ui.components.Pill
import com.almanac.tracker.ui.components.Tone
import com.almanac.tracker.ui.theme.Almanac

@Composable
fun PacePill(pace: String?) {
    val label = PlanLogic.paceLabel(pace) ?: return
    Pill(label, when (pace) { "behind" -> Tone.Clay; "ahead" -> Tone.Moss; else -> Tone.Moss })
}

/** Progress bar with a marker where steady work "should" be today. */
@Composable
fun PaceBar(progress: Double, expected: Double?, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val desc = "Progress ${PlanLogic.percent(progress)}" + (expected?.let { ", plan expects ${PlanLogic.percent(it)} by today" } ?: "")
    Canvas(modifier.fillMaxWidth().height(28.dp).semantics { contentDescription = desc }) {
        val trackH = 10.dp.toPx()
        val top = (size.height - trackH) / 2
        drawRoundRect(c.sunken, Offset(0f, top), Size(size.width, trackH), CornerRadius(trackH / 2))
        val w = (progress.coerceIn(0.0, 1.0) * size.width).toFloat()
        if (w > 0) drawRoundRect(c.moss, Offset(0f, top), Size(w.coerceAtLeast(trackH), trackH), CornerRadius(trackH / 2))
        expected?.let {
            val x = (it.coerceIn(0.0, 1.0) * size.width).toFloat()
            drawRect(c.ink, Offset(x - 1.dp.toPx(), 0f), Size(2.dp.toPx(), size.height))
        }
    }
}

/** Horizontal "route": milestones as stations, the current one highlighted (Plan hero). */
@Composable
fun HorizontalRoute(milestones: List<Pair<Boolean, Int>>, progress: Double, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    if (milestones.isEmpty()) return
    val current = PlanLogic.currentMilestoneIndex(milestones.map { it.first })
    Canvas(modifier.fillMaxWidth().height(22.dp).semantics { contentDescription = "${milestones.count { it.first }} of ${milestones.size} milestones complete" }) {
        val cy = size.height / 2
        val r = 5.dp.toPx()
        val n = milestones.size
        val step = if (n > 1) (size.width - 2 * r) / (n - 1) else 0f
        drawLine(c.line, Offset(r, cy), Offset(size.width - r, cy), strokeWidth = 2.dp.toPx())
        drawLine(c.moss, Offset(r, cy), Offset(r + (size.width - 2 * r) * progress.coerceIn(0.0, 1.0).toFloat(), cy), strokeWidth = 2.dp.toPx())
        milestones.forEachIndexed { i, (done, _) ->
            val x = r + i * step
            when {
                i == current -> {
                    drawCircle(c.ochre, 8.dp.toPx(), Offset(x, cy))
                    drawCircle(c.card, 8.dp.toPx(), Offset(x, cy), style = Stroke(3.dp.toPx()))
                }
                done -> drawCircle(c.moss, r, Offset(x, cy))
                else -> {
                    drawCircle(c.card, r, Offset(x, cy))
                    drawCircle(c.line, r, Offset(x, cy), style = Stroke(2.dp.toPx()))
                }
            }
        }
    }
}

/** Vertical milestone route from the Figma goal detail. */
@Composable
fun VerticalRoute(milestones: List<MilestoneDto>, onOpen: (MilestoneDto) -> Unit) {
    val c = Almanac.colors
    val current = PlanLogic.currentMilestoneIndex(milestones.map { it.completed })
    Column {
        milestones.forEachIndexed { i, m ->
            val isCurrent = i == current
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .clickable(onClickLabel = "Edit ${m.title}") { onOpen(m) }
                    .semantics(mergeDescendants = true) {
                        contentDescription = "${m.title}, ${m.progress} percent" + (if (m.completed) ", complete" else if (isCurrent) ", current milestone" else "") +
                            (m.targetDate?.let { ", by ${PlanLogic.formatDate(it)}" } ?: "")
                    },
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Column(Modifier.width(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Spacer(Modifier.height(4.dp))
                    val dot = if (isCurrent) 16.dp else 12.dp
                    Box(
                        Modifier.size(dot).clip(CircleShape).background(
                            when {
                                isCurrent -> c.ochre
                                m.completed || m.progress > 0 -> c.moss
                                else -> c.line
                            },
                        ).padding(if (!m.completed && !isCurrent && m.progress == 0) 2.dp else 0.dp),
                    ) {
                        if (!m.completed && !isCurrent && m.progress == 0) Box(Modifier.size(dot).clip(CircleShape).background(c.card))
                    }
                    if (i < milestones.lastIndex) {
                        Box(Modifier.width(2.dp).heightIn(min = 44.dp).height(if (isCurrent) 56.dp else 44.dp).background(if (m.completed) c.moss else c.line))
                    }
                }
                Column(Modifier.weight(1f).padding(bottom = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            m.title, style = Almanac.type.bodyStrong, color = if (m.completed) c.muted else c.ink,
                            modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis,
                        )
                        Text("${m.progress}%", style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = if (isCurrent) c.ochre else c.muted)
                    }
                    val meta = listOfNotNull(
                        if (m.completed) "Complete" else if (isCurrent) "Current" else null,
                        m.targetDate?.let { "by ${PlanLogic.formatDate(it)}" },
                    ).joinToString(" · ")
                    if (meta.isNotEmpty()) Text(meta, style = Almanac.type.caption, color = if (isCurrent) c.ochre else c.faint)
                }
            }
        }
    }
}
