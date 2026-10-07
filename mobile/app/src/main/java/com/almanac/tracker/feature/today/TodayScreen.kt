package com.almanac.tracker.feature.today

import androidx.compose.foundation.layout.Arrangement
import com.almanac.tracker.ui.components.currentLocale
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.TodayResponse
import com.almanac.tracker.feature.habits.HabitRow
import com.almanac.tracker.feature.plan.TaskEditorSheet
import com.almanac.tracker.feature.plan.TaskRow
import com.almanac.tracker.feature.study.StartSessionButton
import com.almanac.tracker.navigation.CalendarKey
import com.almanac.tracker.navigation.GoalDetailKey
import com.almanac.tracker.navigation.HabitDetailKey
import com.almanac.tracker.navigation.HabitsKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.PlanKey
import com.almanac.tracker.navigation.SessionKey
import com.almanac.tracker.navigation.SettingsKey
import com.almanac.tracker.navigation.TasksKey
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.theme.Almanac
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun TodayScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { TodayViewModel(container) }
    val load by vm.load.collectAsStateWithLifecycle()
    CollectNotices(vm.notices)
    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        LoadContent(load, onRetry = { vm.refresh() }, skeleton = { Header(null); SkeletonCard(5); SkeletonCard(3); SkeletonCard(4) }) { data ->
            TodayContent(data, vm)
        }
    }
}

@Composable
private fun Header(data: TodayResponse?) {
    val nav = LocalNavigator.current
    val c = Almanac.colors
    val eyebrow = data?.let {
        val locale = currentLocale()
        val d = runCatching { LocalDate.parse(it.today).format(DateTimeFormatter.ofPattern("EEE · d MMM", locale)) }.getOrDefault(it.today)
        d + (it.goalDay?.let { g -> " · Day ${g.day} of ${g.total}" } ?: "")
    }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (eyebrow != null) MonoLabel(eyebrow)
            Text(TodayMath.greeting(data?.greeting ?: "morning"), style = Almanac.type.display, color = c.ink, modifier = Modifier.semantics { heading() })
        }
        HeaderIcon(AlmanacIcon.Calendar, "Calendar") { nav.go(CalendarKey()) }
        HeaderIcon(AlmanacIcon.Settings, "Settings") { nav.go(SettingsKey) }
    }
}

@Composable
private fun TodayContent(d: TodayResponse, vm: TodayViewModel) {
    val nav = LocalNavigator.current
    val c = Almanac.colors
    val overrides by vm.overrides.collectAsStateWithLifecycle()
    val habitValues by vm.logger.overrides.collectAsStateWithLifecycle()
    val receivedAt by vm.receivedAt.collectAsStateWithLifecycle()
    val focusSaving by vm.focusSaving.collectAsStateWithLifecycle()
    var focusSheet by rememberSaveable { mutableStateOf(false) }
    var checkInSheet by rememberSaveable { mutableStateOf(false) }
    var addTask by rememberSaveable { mutableStateOf(false) }

    val habits = d.habits.filter { it.today.scheduled }
    fun habitValue(id: String, server: Double) = habitValues["$id@${d.today}"] ?: server
    val habitsDone = habits.count { h ->
        val v = habitValue(h.id, h.today.value)
        if (h.isReduce) v <= h.target else v >= h.target && v > 0
    }
    val tasks = d.tasks.map { t -> overrides.taskDone[t.id]?.let { done -> t.copy(completedAt = if (done) (t.completedAt ?: "now") else null) } ?: t }
    val tasksDone = tasks.count { it.done }
    val revisions = d.revisionsDue.filterNot { it.id in overrides.hiddenRevisions }
    val mood = if ("mood" in overrides.checkIn) overrides.checkIn["mood"] else d.checkIn.mood
    val energy = if ("energy" in overrides.checkIn) overrides.checkIn["energy"] else d.checkIn.energy
    val dayOne = d.habits.isEmpty() && d.goal == null && d.tasks.isEmpty() && d.study.todaySeconds == 0L && d.timeline.isEmpty()

    Header(d)
    d.runningSession?.let { RunningSessionStrip(it, receivedAt) { nav.go(SessionKey) } }

    // At a glance
    if (dayOne) {
        AlmanacCard {
            Text("Your day draws itself here", style = Almanac.type.title, color = c.ink)
            Text("Start a session or tick a habit and the dial fills in — no setup needed.", style = Almanac.type.small, color = c.muted)
        }
    } else {
        AlmanacCard {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                DayDial(d.timeline, d.nowHour, d.study.todaySeconds, d.study.targetSeconds)
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    DialLegendRow(c.ochre, "Study", "${TodayMath.formatClock(d.study.todaySeconds)} / ${TodayMath.formatClock(d.study.targetSeconds)}")
                    DialLegendRow(c.moss, "Habits", "$habitsDone / ${habits.size}")
                    DialLegendRow(c.ink, "Tasks", "$tasksDone / ${tasks.size}")
                    d.checkIn.sleep?.let { DialLegendRow(c.dusk, "Slept", TodayMath.formatClock((it.hours * 3600).toLong()), it.quality?.let { q -> "quality $q/10" }) }
                }
            }
            TodayMath.planProgress(d.study.todaySeconds, d.study.targetSeconds, habitsDone, habits.size, tasksDone, tasks.size)?.let { PlanBar(it) }
        }
    }

    // Today's one thing
    AlmanacCard(color = c.inverse) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MonoLabel("Today’s one thing", c.inverseInk)
            Spacer(Modifier.weight(1f))
            TextButton(onClick = { focusSheet = true }) { Text(if (d.focus.label == null) "Choose" else "Change", style = Almanac.type.small, color = c.inverseInk) }
        }
        if (d.focus.label != null) {
            Text(d.focus.label, style = Almanac.type.headline, color = c.inverseInk, maxLines = 3, overflow = TextOverflow.Ellipsis)
            d.focus.feeds?.let { Text("Feeds → $it", style = Almanac.type.caption, color = c.inverseInk.copy(alpha = 0.72f)) }
        } else {
            Text("What matters most today?", style = Almanac.type.title, color = c.inverseInk)
            Text("Pick one topic or task. Everything else is a bonus.", style = Almanac.type.small, color = c.inverseInk.copy(alpha = 0.72f))
        }
        if (d.runningSession == null) StartSessionButton(subjectId = null, topicId = d.focus.topicId)
    }

    // Revisions
    if (revisions.isNotEmpty()) {
        SectionHeader("Revisions due", meta = "${revisions.size}", metaColor = c.ochre)
        RevisionsRow(revisions, onDone = vm::completeRevision, onSnooze = vm::snoozeRevision)
    }

    // Habits
    if (habits.isEmpty()) {
        EmptyState("You haven’t created any habits yet.", "Start with one or two you already half-do.") {
            AlmanacButton("Create your first habit", { nav.tab(HabitsKey) }, icon = AlmanacIcon.Plus, small = true)
        }
    } else {
        AlmanacCard {
            SectionHeader("Habits", meta = "$habitsDone of ${habits.size}")
            habits.forEachIndexed { i, h ->
                HabitRow(h, habitValue(h.id, h.today.value), onSet = { vm.logHabit(h, d.today, it) }, onOpen = { nav.go(HabitDetailKey(h.id)) })
                if (i < habits.lastIndex) Divider()
            }
        }
    }

    // Tasks
    AlmanacCard {
        SectionHeader("Tasks", meta = if (tasks.isEmpty()) null else "$tasksDone of ${tasks.size}") {
            TextButton(onClick = { addTask = true }) { Text("+ Add", style = Almanac.type.small, color = c.moss) }
        }
        if (tasks.isEmpty()) {
            Text("Nothing due today. Add a task, or check upcoming ones.", style = Almanac.type.small, color = c.muted)
            AlmanacButton("All tasks", { nav.go(TasksKey) }, kind = ButtonKind.Secondary, small = true)
        } else {
            tasks.forEachIndexed { i, t ->
                TaskRow(t, onToggle = { done -> d.tasks.firstOrNull { it.id == t.id }?.let { vm.toggleTask(it, done) } })
                if (i < tasks.lastIndex) Divider()
            }
        }
    }

    CheckInCard(mood, energy, d.checkIn.sleep, onScale = { k, v -> vm.setScale(d.today, k, v) }, onEdit = { checkInSheet = true })

    // Goal
    if (d.goal != null) {
        GoalCard(d.goal) { nav.go(GoalDetailKey(d.goal.id)) }
    } else {
        EmptyState("No main goal yet", "Set a goal and today’s work will show how it adds up.") {
            AlmanacButton("Set a goal", { nav.tab(PlanKey) }, icon = AlmanacIcon.Plan, small = true)
        }
    }

    if (d.week.isNotEmpty()) WeekCard(d.week, d.study.targetSeconds, d.today)
    d.observation?.let { ObservationCard(it) }

    if (focusSheet) FocusSheet(d.focus, vm.days, focusSaving, onSave = { t, x -> vm.setFocus(d.today, t, x) { focusSheet = false } }, onDismiss = { focusSheet = false })
    if (checkInSheet) CheckInSheet(d.today) { checkInSheet = false }
    if (addTask) TaskEditorSheet(null, onDismiss = { addTask = false })
}

