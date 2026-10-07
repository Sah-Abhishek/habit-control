package com.almanac.tracker.feature.study

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.model.IdTitle
import com.almanac.tracker.core.model.SubjectSummaryDto
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.EmptyState
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.LocalMessenger
import com.almanac.tracker.ui.components.ProgressBar
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/** Subjects card for the Plan tab: progress, hours and topics per subject. */
@Composable
fun SubjectsSection(subjects: List<SubjectSummaryDto>, onOpen: (String) -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    val c = Almanac.colors
    val active = subjects.filterNot { it.archived }
    AlmanacCard(modifier) {
        SectionHeader("Subjects", meta = if (active.isEmpty()) null else "${active.size}") {
            TextButton(onClick = onAdd) { Text("Add", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.moss) }
        }
        if (active.isEmpty()) {
            EmptyState(
                "No subjects yet.",
                "Add the subjects you’re studying, then break them into topics. Progress and revisions build from there.",
            ) { AlmanacButton("Add your first subject", onAdd, icon = AlmanacIcon.Plus, small = true) }
        } else {
            Column {
                active.forEachIndexed { i, s ->
                    SubjectRow(s, onClick = { onOpen(s.id) })
                    if (i < active.lastIndex) Divider()
                }
            }
        }
    }
}

@Composable
private fun SubjectRow(s: SubjectSummaryDto, onClick: () -> Unit) {
    val c = Almanac.colors
    val pct = (s.progress * 100).roundToInt()
    Column(
        Modifier.fillMaxWidth().clickable(onClickLabel = "Open ${s.name}", role = Role.Button, onClick = onClick).padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(s.name, style = Almanac.type.bodyStrong, color = c.ink, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("$pct%", style = Almanac.type.data, color = if (pct >= 60) c.moss else c.ink)
        }
        ProgressBar(s.progress.toFloat(), color = if (s.progress >= 0.6) c.moss else if (s.progress > 0) c.ochre else c.line, label = "${s.name} $pct percent")
        Text(
            buildString {
                append("${s.completedTopics}/${s.topicCount} topics done · ${StudyMath.formatDuration(s.studySeconds)} logged")
                if (s.weight != null) append(" · ${s.weight}% of marks")
            },
            style = Almanac.type.caption, color = c.muted,
        )
    }
}

/** Create or edit a subject: name, linked goal, exam weight. Saves itself and reports via the snackbar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubjectEditorSheet(existing: SubjectSummaryDto?, onDismiss: () -> Unit) {
    val container = LocalAppContainer.current
    val repo = remember(container) { StudyRepository(container) }
    val messenger = LocalMessenger.current
    val scope = rememberCoroutineScope()
    val c = Almanac.colors
    var name by rememberSaveable { mutableStateOf(existing?.name ?: "") }
    var weight by rememberSaveable { mutableStateOf(existing?.weight?.toString() ?: "") }
    var goalId by rememberSaveable { mutableStateOf(existing?.goalId) }
    var goals by remember { mutableStateOf<List<IdTitle>>(emptyList()) }
    var goalMenu by remember { mutableStateOf(false) }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var pending by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { goals = runCatching { repo.goalOptions() }.getOrDefault(emptyList()) }

    fun submit() {
        if (pending) return
        val w = weight.trim().takeIf { it.isNotEmpty() }?.toIntOrNull()
        val local = buildMap {
            if (name.isBlank()) put("name", "Give the subject a name")
            if (weight.isNotBlank() && (w == null || w !in 0..100)) put("weight", "Use a number from 0 to 100")
        }
        errors = local
        if (local.isNotEmpty()) return
        pending = true
        scope.launch {
            try {
                if (existing == null) repo.createSubject(name, goalId, w) else repo.updateSubject(existing.id, name, goalId, w)
                messenger.show(if (existing == null) "“${name.trim()}” added" else "Subject updated")
                onDismiss()
            } catch (t: Throwable) {
                val e = t.toAppError()
                errors = (e as? AppError.Api)?.fieldErrors?.takeIf { it.isNotEmpty() } ?: mapOf("_form" to e.message)
            } finally {
                pending = false
            }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = c.page) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(if (existing == null) "New subject" else "Edit subject", style = Almanac.type.headline, color = c.ink)
            FormError(errors["_form"])
            LabeledField("Name", name, { name = it.take(80) }, error = errors["name"], placeholder = "e.g. Operating Systems")
            LabeledField(
                "Share of exam marks (%)", weight, { s -> weight = s.filter(Char::isDigit).take(3) }, optional = true,
                hint = "Powers “effort vs weight” in Insights.", error = errors["weight"],
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            )
            if (goals.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Supports a goal  ·  optional", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.ink)
                    AlmanacButton(goals.firstOrNull { it.id == goalId }?.title ?: "None", { goalMenu = true }, kind = ButtonKind.Secondary, small = true)
                    DropdownMenu(goalMenu, { goalMenu = false }) {
                        DropdownMenuItem({ Text("None") }, { goalId = null; goalMenu = false })
                        goals.forEach { g -> DropdownMenuItem({ Text(g.title) }, { goalId = g.id; goalMenu = false }) }
                    }
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                AlmanacButton("Cancel", onDismiss, kind = ButtonKind.Ghost)
                AlmanacButton(if (existing == null) "Add subject" else "Save", ::submit, pending = pending)
            }
        }
    }
}
