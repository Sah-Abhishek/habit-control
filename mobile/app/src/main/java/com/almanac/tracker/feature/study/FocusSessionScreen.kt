package com.almanac.tracker.feature.study

import android.os.SystemClock
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.SessionDto
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.WrapUpKey
import com.almanac.tracker.ui.components.AIcon
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.ErrorState
import com.almanac.tracker.ui.components.SkeletonCard
import com.almanac.tracker.ui.components.StatusBanner
import com.almanac.tracker.ui.components.errorBody
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.delay

/** The running focus-session timer (Figma "Mobile / Focus session (running)"). */
@Composable
fun FocusSessionScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel(key = "focus-session") { FocusSessionViewModel(container) }
    val ui by vm.ui.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    CollectNotices(vm.notices)
    LaunchedEffect(vm) {
        vm.eventFlow.collect { e ->
            when (e) {
                is FocusEvent.Finished -> nav.replace(WrapUpKey(e.id, e.longSession))
                FocusEvent.Discarded -> nav.back()
            }
        }
    }

    when (val load = ui.load) {
        Load.Loading -> Column(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp)) { SkeletonCard(4) }
        is Load.Failed -> Column(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            BackBar("Back", nav::back)
            ErrorState("Couldn’t load your session", errorBody(load.error), onRetry = vm::refresh)
        }
        is Load.Ready -> {
            val s = load.data
            if (s == null) {
                Column(Modifier.fillMaxSize().statusBarsPadding().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    BackBar("Back", nav::back)
                    Text("No session running", style = Almanac.type.display, color = Almanac.colors.ink)
                    EmptyState("Nothing is being timed right now.", "Start a session and the timer will keep going on the server, even if you close the app.") {
                        StartSessionButton(null, null)
                    }
                }
            } else {
                Running(s, ui, vm, offline = load.stale && load.error != null, onBack = nav::back)
            }
        }
    }
}

@Composable
private fun Running(s: SessionDto, ui: FocusUi, vm: FocusSessionViewModel, offline: Boolean, onBack: () -> Unit) {
    val c = Almanac.colors
    val ink = c.inverseInk
    // Keep the screen awake while the timer is visible.
    val view = LocalView.current
    DisposableEffect(view) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }
    var now by androidx.compose.runtime.remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    LaunchedEffect(ui.timer) {
        while (true) {
            now = SystemClock.elapsedRealtime()
            delay(1000)
        }
    }
    val timer = ui.timer
    val elapsed = timer?.let { StudyMath.elapsedNow(it.baseElapsed, it.anchorMs, now, it.paused) } ?: 0
    val (blockIndex, blockProgress) = StudyMath.block(elapsed)
    val paused = timer?.paused == true
    var confirmDiscard by rememberSaveable { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().background(c.inverse).verticalScroll(rememberScrollState()).statusBarsPadding().navigationBarsPadding().padding(horizontal = 24.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onBack) { AIcon(AlmanacIcon.Back, "Back", ink, 20.dp) }
            AIcon(AlmanacIcon.Book, null, c.ochre, 16.dp)
            Text(
                listOfNotNull(s.subjectName, s.topicName).joinToString(" · ").ifEmpty { "Study session" },
                style = Almanac.type.bodyStrong, color = ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f),
            )
        }
        if (offline) {
            StatusBanner("Offline — the clock is estimated. Pause, finish and answers need a connection.", AlmanacIcon.CloudOff, inverse = false)
        }

        // Ring + elapsed clock
        Box(Modifier.widthIn(max = 280.dp).fillMaxWidth().aspectRatio(1f), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val stroke = 8.dp.toPx()
                val inset = stroke / 2
                val arcSize = Size(size.width - stroke, size.height - stroke)
                drawArc(ink.copy(alpha = 0.14f), 0f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
                drawArc(c.ochre, -90f, 360f * blockProgress, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (paused) "PAUSED" else "ELAPSED", style = Almanac.type.label, color = if (paused) c.ochre else ink.copy(alpha = 0.7f))
                val minutes = elapsed / 60
                Text(
                    StudyMath.formatTimer(elapsed),
                    style = Almanac.type.bigNumber.copy(fontSize = 72.sp, lineHeight = 76.sp),
                    color = ink,
                    // Announce per minute, not per second.
                    modifier = Modifier.clearAndSetSemantics {
                        contentDescription = "$minutes minute${if (minutes == 1L) "" else "s"} elapsed${if (paused) ", paused" else ""}"
                        liveRegion = LiveRegionMode.Polite
                    },
                )
                Text(
                    if (blockIndex == 1) "of 50-min block" else "50-min block $blockIndex",
                    style = Almanac.type.small, color = ink.copy(alpha = 0.6f),
                )
            }
        }

        // Method chips
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("lecture", "reading", "practice", "problem_solving", "revision", "mock_test").forEach { m ->
                val on = ui.method == m
                Text(
                    StudyMath.methodLabel(m) ?: m,
                    style = Almanac.type.small.copy(fontWeight = FontWeight.Medium),
                    color = if (on) c.inverse else ink,
                    modifier = Modifier.clip(CircleShape)
                        .then(if (on) Modifier.background(ink) else Modifier.border(1.dp, ink.copy(alpha = 0.3f), CircleShape))
                        .selectable(on, role = Role.RadioButton) { vm.setMethod(m) }
                        .heightIn(min = 40.dp)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                )
            }
        }

        // Tally
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            TallyCard(true, ui.correct, "Got it right", Modifier.weight(1f), vm)
            TallyCard(false, ui.attempted - ui.correct, "Missed", Modifier.weight(1f), vm)
        }
        Text(
            "Tap while you practise — accuracy fills itself in. Counts are saved as you go.",
            style = Almanac.type.caption, color = ink.copy(alpha = 0.55f), textAlign = TextAlign.Center,
        )

        Spacer(Modifier.size(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Surface(
                onClick = vm::togglePause, enabled = !ui.busy, shape = RoundedCornerShape(18.dp), color = c.inverse,
                border = androidx.compose.foundation.BorderStroke(1.dp, ink.copy(alpha = 0.35f)), modifier = Modifier.weight(1f).heightIn(min = 56.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                    AIcon(if (paused) AlmanacIcon.Play else AlmanacIcon.Pause, null, ink, 18.dp)
                    Text(if (paused) "Resume" else "Pause", style = Almanac.type.button, color = ink)
                }
            }
            Surface(
                onClick = vm::finish, enabled = !ui.busy, shape = RoundedCornerShape(18.dp), color = c.ochre,
                modifier = Modifier.weight(1f).heightIn(min = 56.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                    AIcon(AlmanacIcon.Stop, null, c.inverse, 18.dp)
                    Text(if (ui.busy) "Saving…" else "Finish", style = Almanac.type.button, color = c.inverse)
                }
            }
        }
        TextButton(onClick = { confirmDiscard = true }, enabled = !ui.busy) {
            Text("Discard this session", style = Almanac.type.small, color = ink.copy(alpha = 0.6f))
        }
    }

    if (confirmDiscard) {
        AlertDialog(
            onDismissRequest = { confirmDiscard = false },
            title = { Text("Discard this session?") },
            text = { Text("The ${StudyMath.formatDuration(elapsed)} won’t be counted. Use Finish if you want to keep it.") },
            confirmButton = { TextButton({ confirmDiscard = false; vm.discard() }) { Text("Discard", color = c.clay) } },
            dismissButton = { TextButton({ confirmDiscard = false }) { Text("Keep going") } },
        )
    }
}

@Composable
private fun TallyCard(correct: Boolean, count: Int, label: String, modifier: Modifier, vm: FocusSessionViewModel) {
    val c = Almanac.colors
    val ink = c.inverseInk
    Column(
        modifier.clip(RoundedCornerShape(20.dp)).background(ink.copy(alpha = 0.06f)).border(1.dp, ink.copy(alpha = 0.14f), RoundedCornerShape(20.dp))
            .clickable(onClickLabel = if (correct) "Add a correct answer" else "Add a missed answer", role = Role.Button) { vm.tally(correct) }
            .semantics(mergeDescendants = true) { contentDescription = "$label: $count. Tap to add one." }
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(44.dp).clip(CircleShape).background(if (correct) c.moss else c.clay), contentAlignment = Alignment.Center) {
            AIcon(if (correct) AlmanacIcon.Check else AlmanacIcon.Close, null, c.inverse, 22.dp)
        }
        Text("$count", style = Almanac.type.dataLarge.copy(fontSize = 22.sp), color = ink)
        Text(label, style = Almanac.type.caption, color = ink.copy(alpha = 0.6f))
        TextButton(onClick = { vm.tally(correct, undo = true) }, enabled = count > 0) {
            Text("−1", style = Almanac.type.caption, color = ink.copy(alpha = if (count > 0) 0.7f else 0.25f))
        }
    }
}
