package com.almanac.tracker.feature.plan

import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.TopicPick
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

/** Pure helpers for the Plan feature — unit tested, no Android dependencies. */
object PlanLogic {

    /** Pace label is always text (never colour alone). */
    fun paceLabel(pace: String?): String? = when (pace) {
        "ahead" -> "Ahead"
        "on_pace" -> "On pace"
        "behind" -> "Behind"
        else -> null
    }

    fun percent(ratio: Double?): String = ratio?.takeIf { it.isFinite() }?.let { "${(it.coerceIn(0.0, 1.0) * 100).roundToInt()}%" } ?: "—"

    fun daysLeftText(daysLeft: Int?): String? = when {
        daysLeft == null -> null
        daysLeft < 0 -> "${-daysLeft} days past target"
        daysLeft == 0 -> "Target is today"
        daysLeft == 1 -> "1 day left"
        else -> "$daysLeft days left"
    }

    private val SHORT: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM", Locale.getDefault())
    private val LONG: DateTimeFormatter get() = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.getDefault())

    fun parse(date: String?): LocalDate? = date?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

    /** "7 Oct" for this year, "26 Feb 2027" otherwise; raw string if unparsable. */
    fun formatDate(date: String?, today: LocalDate = LocalDate.now()): String? {
        val d = parse(date) ?: return date
        return d.format(if (d.year == today.year) SHORT else LONG)
    }

    /** Goal form validation; keys match API field names. */
    fun validateGoal(title: String, startDate: String?, targetDate: String?): Map<String, String> = buildMap {
        if (title.isBlank()) put("title", "Give the goal a name")
        if (title.length > 120) put("title", "Keep it under 120 characters")
        val start = parse(startDate)
        if (start == null) put("startDate", "Pick a start date")
        val target = targetDate?.takeIf { it.isNotBlank() }?.let { parse(it) }
        if (targetDate != null && targetDate.isNotBlank() && target == null) put("targetDate", "Pick a valid date")
        if (start != null && target != null && target.isBefore(start)) put("targetDate", "Target can’t be before the start")
    }

    fun validateMilestone(title: String, progress: Int): Map<String, String> = buildMap {
        if (title.isBlank()) put("title", "Give the milestone a name")
        if (title.length > 120) put("title", "Keep it under 120 characters")
        if (progress !in 0..100) put("progress", "Progress is 0–100")
    }

    fun validateTask(title: String, estimate: String): Map<String, String> = buildMap {
        if (title.isBlank()) put("title", "Give the task a title")
        if (title.length > 200) put("title", "Keep it under 200 characters")
        if (estimate.isNotBlank()) {
            val n = estimate.trim().toIntOrNull()
            if (n == null || n <= 0 || n > 24 * 60) put("estimateMinutes", "Enter minutes between 1 and 1440")
        }
    }

    /** Topics shown for a subject choice; no subject → none (topic needs a subject). */
    fun topicsFor(subjectId: String?, topics: List<TopicPick>): List<TopicPick> =
        if (subjectId == null) emptyList() else topics.filter { it.subjectId == subjectId }

    /** Keeps the topic only if it still belongs to the chosen subject. */
    fun reconcileTopic(subjectId: String?, topicId: String?, topics: List<TopicPick>): String? =
        topicId?.takeIf { id -> topics.any { it.id == id && it.subjectId == subjectId } }

    private val PRIORITY_RANK = mapOf("critical" to 0, "high" to 1, "medium" to 2, "low" to 3)

    /** Open first; overdue first; then by priority, due date, title. Done last, newest first. */
    fun sortTasks(tasks: List<TaskRowDto>): List<TaskRowDto> {
        val (done, open) = tasks.partition { it.done }
        val openSorted = open.sortedWith(
            compareBy<TaskRowDto>({ !it.overdue }, { PRIORITY_RANK[it.priority] ?: 2 }, { it.dueDate ?: "9999-12-31" }, { it.title.lowercase() }),
        )
        return openSorted + done.sortedByDescending { it.completedAt ?: "" }
    }

    data class TaskGroup(val title: String, val tasks: List<TaskRowDto>)

    /** Grouping for the Tasks screen. */
    fun groupTasks(tasks: List<TaskRowDto>, filter: String, today: LocalDate = LocalDate.now()): List<TaskGroup> {
        val sorted = sortTasks(tasks)
        return when (filter) {
            "today" -> listOf(
                TaskGroup("Overdue", sorted.filter { !it.done && it.overdue }),
                TaskGroup("Today", sorted.filter { !it.done && !it.overdue }),
                TaskGroup("Done today", sorted.filter { it.done }),
            )
            "upcoming" -> sorted.groupBy { t ->
                val d = parse(t.dueDate)
                when {
                    d == null -> "Later"
                    !d.isAfter(today.plusDays(1)) -> "Tomorrow"
                    !d.isAfter(today.plusDays(7)) -> "This week"
                    else -> "Later"
                }
            }.let { m -> listOf("Tomorrow", "This week", "Later").mapNotNull { k -> m[k]?.let { TaskGroup(k, it) } } }
            else -> listOf(TaskGroup("", sorted))
        }.filter { it.tasks.isNotEmpty() }
    }

    fun taskContext(t: TaskRowDto): String? =
        listOfNotNull(t.goalTitle, t.subjectName, t.topicName).joinToString(" · ").ifEmpty { null }

    fun minutesText(m: Int?): String? = when {
        m == null || m <= 0 -> null
        m < 60 -> "${m}m"
        m % 60 == 0 -> "${m / 60}h"
        else -> "${m / 60}h ${m % 60}m"
    }

    /** Index of the "current" milestone: first not completed; null when all done / none. */
    fun currentMilestoneIndex(completed: List<Boolean>): Int? = completed.indexOfFirst { !it }.takeIf { it >= 0 }
}
