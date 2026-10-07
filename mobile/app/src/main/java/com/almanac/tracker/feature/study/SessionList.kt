package com.almanac.tracker.feature.study

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DAY: DateTimeFormatter get() = DateTimeFormatter.ofPattern("EEE d", Locale.getDefault())

/** Compact session rows: day · method/topic · focus · duration · score. */
@Composable
fun SessionList(sessions: List<SessionDto>, today: LocalDate = LocalDate.now(), onOpen: ((SessionDto) -> Unit)? = null) {
    val c = Almanac.colors
    Column {
        sessions.forEachIndexed { i, s ->
            val d = runCatching { LocalDate.parse(s.localDate) }.getOrNull()
            val day = when (d) {
                null -> "—"
                today -> "Today"
                today.minusDays(1) -> "Yday"
                else -> d.format(DAY)
            }
            val title = listOfNotNull(StudyMath.methodLabel(s.method), s.subjectName, s.topicName).joinToString(" · ").ifEmpty { "Study session" }
            Row(
                Modifier.fillMaxWidth()
                    .then(if (onOpen != null) Modifier.clickable(onClickLabel = "Edit session") { onOpen(s) } else Modifier)
                    .padding(vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(day, style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.muted, modifier = Modifier.width(48.dp))
                Column(Modifier.weight(1f)) {
                    Text(title, style = Almanac.type.small.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold), color = c.ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(StudyMath.focusLabel(s.focus)?.let { "Focus: $it" } ?: "Focus not rated", style = Almanac.type.caption, color = c.faint)
                }
                Text(StudyMath.formatDuration(s.durationSeconds ?: 0), style = Almanac.type.data.copy(fontSize = Almanac.type.small.fontSize), color = c.ink)
                Text(
                    if (s.questionsAttempted != null && s.questionsAttempted > 0) "${s.questionsCorrect ?: 0}/${s.questionsAttempted}" else "—",
                    style = Almanac.type.data.copy(fontSize = Almanac.type.caption.fontSize), color = c.moss, modifier = Modifier.width(44.dp),
                )
            }
            if (i < sessions.lastIndex) Divider()
        }
    }
}
