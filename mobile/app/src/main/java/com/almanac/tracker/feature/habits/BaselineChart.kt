package com.almanac.tracker.feature.habits

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.WeeklyAverage
import com.almanac.tracker.ui.theme.Almanac

/** Weekly averages vs baseline; the shaded band between a bar and the baseline is what was avoided. */
@Composable
fun BaselineChart(weeks: List<WeeklyAverage>, baseline: Double?, limit: Double, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val values = weeks.map { it.avg ?: 0.0 }
    val max = (listOf(1.0, baseline ?: 0.0, limit) + values).max() * 1.15
    val summary = buildString {
        append("Weekly average per day. ")
        if (baseline != null) append("Baseline ${formatAmount(baseline)}. ")
        append("Limit ${formatAmount(limit)}. ")
        weeks.lastOrNull()?.avg?.let { append("This week ${formatAmount(Math.round(it * 10) / 10.0)}.") }
    }
    Column(modifier.fillMaxWidth()) {
        Canvas(Modifier.fillMaxWidth().height(140.dp).semantics { contentDescription = summary }) {
            val n = weeks.size.coerceAtLeast(1)
            val slot = size.width / n
            val bw = (slot * 0.6f).coerceAtMost(28.dp.toPx())
            fun y(v: Double) = size.height - (v / max * size.height).toFloat()
            weeks.forEachIndexed { i, w ->
                val x = i * slot + (slot - bw) / 2
                val avg = w.avg
                if (avg == null) {
                    drawRoundRect(c.hair, Offset(x, size.height - 2), Size(bw, 2f), CornerRadius(1f))
                } else {
                    val top = y(avg)
                    if (baseline != null && avg < baseline) {
                        drawRect(c.moss.copy(alpha = 0.16f), Offset(x, y(baseline)), Size(bw, top - y(baseline)))
                    }
                    drawRoundRect(c.clay.copy(alpha = if (i == n - 1) 1f else 0.42f), Offset(x, top), Size(bw, size.height - top), CornerRadius(5.dp.toPx()))
                }
            }
            if (baseline != null) {
                drawLine(c.ink, Offset(0f, y(baseline)), Offset(size.width, y(baseline)), strokeWidth = 1.2.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f)))
            }
            drawLine(c.faint, Offset(0f, y(limit)), Offset(size.width, y(limit)), strokeWidth = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 8f)))
        }
        Row(Modifier.fillMaxWidth()) {
            Text("${weeks.size} weeks ago", style = Almanac.type.label, color = c.faint)
            Spacer(Modifier.weight(1f))
            if (baseline != null) Text("— baseline ${formatAmount(baseline)}   ", style = Almanac.type.label, color = c.ink)
            Text("·· limit ${formatAmount(limit)}", style = Almanac.type.label, color = c.faint)
        }
    }
}
