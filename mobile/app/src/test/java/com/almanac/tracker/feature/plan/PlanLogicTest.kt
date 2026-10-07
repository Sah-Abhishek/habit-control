package com.almanac.tracker.feature.plan

import com.almanac.tracker.core.model.TaskRowDto
import com.almanac.tracker.core.model.TopicPick
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class PlanLogicTest {
    private val today = LocalDate.parse("2026-10-07")

    @Test fun paceLabelsAreText() {
        assertEquals("On pace", PlanLogic.paceLabel("on_pace"))
        assertEquals("Behind", PlanLogic.paceLabel("behind"))
        assertEquals("Ahead", PlanLogic.paceLabel("ahead"))
        assertNull(PlanLogic.paceLabel(null))
        assertNull(PlanLogic.paceLabel("weird"))
    }

    @Test fun percentClampsAndHandlesNull() {
        assertEquals("42%", PlanLogic.percent(0.42))
        assertEquals("100%", PlanLogic.percent(1.4))
        assertEquals("—", PlanLogic.percent(null))
        assertEquals("—", PlanLogic.percent(Double.NaN))
    }

    @Test fun daysLeft() {
        assertEquals("142 days left", PlanLogic.daysLeftText(142))
        assertEquals("1 day left", PlanLogic.daysLeftText(1))
        assertEquals("Target is today", PlanLogic.daysLeftText(0))
        assertEquals("3 days past target", PlanLogic.daysLeftText(-3))
        assertNull(PlanLogic.daysLeftText(null))
    }

    @Test fun goalValidationRejectsTargetBeforeStart() {
        assertEquals(emptyMap<String, String>(), PlanLogic.validateGoal("GATE", "2026-03-01", "2027-02-26"))
        assertTrue("targetDate" in PlanLogic.validateGoal("GATE", "2026-03-01", "2026-02-01"))
        assertTrue("title" in PlanLogic.validateGoal("  ", "2026-03-01", null))
        assertTrue("startDate" in PlanLogic.validateGoal("x", null, null))
        assertTrue("targetDate" in PlanLogic.validateGoal("x", "2026-03-01", "2026-02-30"))
        assertEquals(emptyMap<String, String>(), PlanLogic.validateGoal("x", "2026-03-01", ""))
    }

    @Test fun taskValidation() {
        assertEquals(emptyMap<String, String>(), PlanLogic.validateTask("Read", ""))
        assertTrue("estimateMinutes" in PlanLogic.validateTask("Read", "0"))
        assertTrue("estimateMinutes" in PlanLogic.validateTask("Read", "abc"))
        assertTrue("title" in PlanLogic.validateTask("", "30"))
    }

    @Test fun topicsFollowSubject() {
        val topics = listOf(TopicPick("t1", "SQL", "s1"), TopicPick("t2", "Paging", "s2"))
        assertEquals(listOf("t1"), PlanLogic.topicsFor("s1", topics).map { it.id })
        assertEquals(emptyList<TopicPick>(), PlanLogic.topicsFor(null, topics))
        assertEquals("t1", PlanLogic.reconcileTopic("s1", "t1", topics))
        assertNull(PlanLogic.reconcileTopic("s2", "t1", topics))
        assertNull(PlanLogic.reconcileTopic(null, "t1", topics))
    }

    private fun task(id: String, priority: String = "medium", due: String? = null, overdue: Boolean = false, done: String? = null) =
        TaskRowDto(id = id, title = id, priority = priority, dueDate = due, overdue = overdue, completedAt = done)

    @Test fun sortsOverdueThenPriorityThenDoneLast() {
        val sorted = PlanLogic.sortTasks(
            listOf(task("done", done = "2026-10-07T08:00:00Z"), task("low", "low"), task("crit", "critical"), task("late", "low", overdue = true)),
        )
        assertEquals(listOf("late", "crit", "low", "done"), sorted.map { it.id })
    }

    @Test fun groupsTodayAndUpcoming() {
        val groups = PlanLogic.groupTasks(listOf(task("a", overdue = true), task("b"), task("c", done = "x")), "today", today)
        assertEquals(listOf("Overdue", "Today", "Done today"), groups.map { it.title })
        val up = PlanLogic.groupTasks(listOf(task("t", due = "2026-10-08"), task("w", due = "2026-10-12"), task("l", due = "2026-11-30")), "upcoming", today)
        assertEquals(listOf("Tomorrow", "This week", "Later"), up.map { it.title })
    }

    @Test fun minutesAndContext() {
        assertEquals("45m", PlanLogic.minutesText(45))
        assertEquals("2h", PlanLogic.minutesText(120))
        assertEquals("1h 30m", PlanLogic.minutesText(90))
        assertNull(PlanLogic.minutesText(null))
        assertEquals("GATE · DBMS", PlanLogic.taskContext(TaskRowDto(id = "1", title = "x", goalTitle = "GATE", subjectName = "DBMS")))
    }

    @Test fun currentMilestone() {
        assertEquals(1, PlanLogic.currentMilestoneIndex(listOf(true, false, false)))
        assertNull(PlanLogic.currentMilestoneIndex(listOf(true, true)))
        assertNull(PlanLogic.currentMilestoneIndex(emptyList()))
    }
}
