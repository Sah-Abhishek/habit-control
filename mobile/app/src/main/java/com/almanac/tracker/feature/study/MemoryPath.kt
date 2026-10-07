package com.almanac.tracker.feature.study

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.TopicRevisionDto
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val SHORT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())

/** A topic's spaced revisions as stations on a line: done · due · upcoming. */
@Composable
fun MemoryPath(revisions: List<TopicRevisionDto>, today: LocalDate = LocalDate.now(), modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val sorted = revisions.sortedBy { it.step }
    val summary = sorted.joinToString("; ") { r ->
        "Revision ${r.step} ${StudyMath.revisionState(r.dueDate, r.completedAt, r.skippedAt, today).name.lowercase()} ${r.dueDate}"
    }
    Row(modifier.fillMaxWidth().semantics { contentDescription = "Revision path: $summary" }, verticalAlignment = Alignment.Top) {
        sorted.forEachIndexed { i, r ->
            val state = StudyMath.revisionState(r.dueDate, r.completedAt, r.skippedAt, today)
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val size = if (state == StudyMath.RevState.Due) 22.dp else 16.dp
                Box(Modifier.height(22.dp), contentAlignment = Alignment.Center) {
                    Box(
                        Modifier.size(size).clip(CircleShape).then(
                            when (state) {
                                StudyMath.RevState.Done -> Modifier.background(c.moss)
                                StudyMath.RevState.Due -> Modifier.background(c.ochre).border(3.dp, c.card, CircleShape)
                                StudyMath.RevState.Skipped -> Modifier.background(c.line)
                                StudyMath.RevState.Upcoming -> Modifier.border(1.5.dp, c.line, CircleShape)
                            },
                        ),
                    )
                }
                Text("R${r.step}", style = Almanac.type.label, color = if (state == StudyMath.RevState.Due) c.ochre else c.muted)
                Text(
                    runCatching { LocalDate.parse(r.dueDate).format(SHORT) }.getOrDefault(r.dueDate),
                    style = Almanac.type.caption, color = c.faint,
                )
            }
            if (i < sorted.lastIndex) {
                Box(
                    Modifier.weight(1f).padding(top = 10.dp).height(2.dp)
                        .background(if (StudyMath.revisionState(r.dueDate, r.completedAt, r.skippedAt, today) == StudyMath.RevState.Done) c.moss else c.line),
                )
            }
        }
    }
}
