package com.almanac.tracker.feature.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.core.data.CollectNotices
import com.almanac.tracker.core.data.Load
import com.almanac.tracker.core.model.MeResponse
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.AlmanacCard
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.BackBar
import com.almanac.tracker.ui.components.ButtonKind
import com.almanac.tracker.ui.components.Divider
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.components.LoadContent
import com.almanac.tracker.ui.components.MonoLabel
import com.almanac.tracker.ui.components.PageTitle
import com.almanac.tracker.ui.components.RefreshablePage
import com.almanac.tracker.ui.components.SectionHeader
import com.almanac.tracker.ui.components.Segmented
import com.almanac.tracker.ui.theme.Almanac
import kotlinx.coroutines.launch
import java.time.ZoneId

private val WEEK_DAYS = listOf(1 to "Monday", 6 to "Saturday", 0 to "Sunday")

@Composable
fun SettingsScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { SettingsViewModel(container) }
    val load by vm.load.collectAsStateWithLifecycle()
    val nav = LocalNavigator.current
    CollectNotices(vm.notices)

    RefreshablePage(refreshing = (load as? Load.Ready)?.refreshing == true, onRefresh = { vm.refresh() }) {
        BackBar("Back", nav::back)
        PageTitle("Settings")
        LoadContent(load, onRetry = { vm.refresh() }) { me -> SettingsContent(me, vm) }
    }
}

@Composable
private fun SettingsContent(me: MeResponse, vm: SettingsViewModel) {
    val c = Almanac.colors
    val s = me.settings
    val scope = rememberCoroutineScope()
    val saving by vm.saving.collectAsStateWithLifecycle()
    var tzPicker by rememberSaveable { mutableStateOf(false) }
    var deleting by rememberSaveable { mutableStateOf(false) }
    var targetError by rememberSaveable { mutableStateOf<String?>(null) }
    var intervalsError by rememberSaveable { mutableStateOf<String?>(null) }
    val phoneZone = remember { ZoneId.systemDefault().id }

    AlmanacCard {
        SectionHeader("Profile")
        MonoLabel("Name")
        Text(me.user.name, style = Almanac.type.body, color = c.ink)
        MonoLabel("Email")
        Text(me.user.email, style = Almanac.type.body, color = c.ink)
        Text("Change your name or password on the website (Settings → Profile).", style = Almanac.type.caption, color = c.faint)
    }

    AlmanacCard {
        SectionHeader("Preferences")
        MonoLabel("Appearance")
        Segmented(listOf("system" to "Match phone", "light" to "Light", "dark" to "Dark"), s.theme, { theme ->
            scope.launch { vm.patch("theme", SettingsPatch(theme = theme), success = null) }
        })
        Divider()
        MonoLabel("Timezone")
        Text(s.timezone, style = Almanac.type.bodyStrong, color = c.ink)
        Text("Decides when your day starts and ends. Past logs keep the day they were made.", style = Almanac.type.caption, color = c.faint)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            AlmanacButton("Change", { tzPicker = true }, kind = ButtonKind.Secondary, small = true)
            if (phoneZone != s.timezone) {
                AlmanacButton("Use this phone’s ($phoneZone)", { scope.launch { vm.patch("tz", SettingsPatch(timezone = phoneZone)) } }, kind = ButtonKind.Ghost, small = true, pending = saving == "tz")
            }
        }
        Divider()
        MonoLabel("Week starts on")
        Segmented(WEEK_DAYS.map { it.first to it.second }, s.weekStartsOn, { d -> scope.launch { vm.patch("week", SettingsPatch(weekStartsOn = d)) } })
        Divider()
        var hours by rememberSaveable(s.dailyStudyTargetMin) { mutableStateOf((s.dailyStudyTargetMin / 60).toString()) }
        var minutes by rememberSaveable(s.dailyStudyTargetMin) { mutableStateOf((s.dailyStudyTargetMin % 60).toString()) }
        MonoLabel("Daily study target")
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Bottom) {
            LabeledField("Hours", hours, { hours = it.filter(Char::isDigit).take(2) }, Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
            LabeledField("Minutes", minutes, { minutes = it.filter(Char::isDigit).take(2) }, Modifier.weight(1f), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
        }
        targetError?.let { Text(it, style = Almanac.type.caption, color = c.clay) }
        AlmanacButton("Save target", {
            parseTargetMinutes(hours, minutes).fold(
                onSuccess = { total -> targetError = null; scope.launch { targetError = vm.patch("target", SettingsPatch(dailyStudyTargetMin = total)) } },
                onFailure = { targetError = it.message },
            )
        }, kind = ButtonKind.Secondary, small = true, pending = saving == "target")
        Text("Used for Today’s progress and weekly targets. Set 0 to hide targets.", style = Almanac.type.caption, color = c.faint)
        Divider()
        var intervals by rememberSaveable(s.revisionScheduleDays) { mutableStateOf(s.revisionScheduleDays.joinToString(", ")) }
        LabeledField(
            "Revision schedule (days after finishing a topic)", intervals, { intervals = it.take(60) },
            error = intervalsError, hint = "e.g. 1, 3, 7, 21, 45 — applies to topics you complete from now on.",
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        )
        AlmanacButton("Save schedule", {
            val parsed = parseIntervals(intervals)
            val error = if (parsed == null) "Use numbers separated by commas." else validateIntervals(parsed)
            intervalsError = error
            if (error == null && parsed != null) scope.launch { intervalsError = vm.patch("intervals", SettingsPatch(revisionScheduleDays = parsed)) }
        }, kind = ButtonKind.Secondary, small = true, pending = saving == "intervals")
        Divider()
        Row(
            Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(role = Role.Switch) { scope.launch { vm.patch("quiet", SettingsPatch(quietMode = !s.quietMode)) } },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("Quiet mode", style = Almanac.type.bodyStrong, color = c.ink)
                Text("Reminders are coming soon; quiet mode will silence them when they arrive.", style = Almanac.type.caption, color = c.muted)
            }
            Switch(s.quietMode, null, colors = SwitchDefaults.colors(checkedTrackColor = c.moss))
        }
    }

    AlmanacCard(color = c.duskSoft) {
        SectionHeader("Your data")
        Text(
            "Everything you log is stored in your account on the Almanac server and on this phone for offline use. It’s never sold or shared. " +
                "Signing out removes it from this phone. Export everything from the website (Settings → Export).",
            style = Almanac.type.small, color = c.ink,
        )
    }

    AlmanacButton("Sign out", { vm.signOut() }, kind = ButtonKind.Secondary, icon = AlmanacIcon.Logout, modifier = Modifier.fillMaxWidth())

    AlmanacCard {
        SectionHeader("Danger zone", metaColor = c.clay)
        Text("Delete your account and all of its data permanently. This can’t be undone.", style = Almanac.type.small, color = c.muted)
        AlmanacButton("Delete account…", { deleting = true }, kind = ButtonKind.Danger, small = true)
    }

    if (tzPicker) TimezonePicker(current = s.timezone, onDismiss = { tzPicker = false }) { tz ->
        tzPicker = false
        scope.launch { vm.patch("tz", SettingsPatch(timezone = tz)) }
    }
    if (deleting) DeleteAccountDialog(me.user.email, vm) { deleting = false }
}

@Composable
private fun TimezonePicker(current: String, onDismiss: () -> Unit, onPick: (String) -> Unit) {
    val c = Almanac.colors
    var query by rememberSaveable { mutableStateOf("") }
    val all = remember { ZoneId.getAvailableZoneIds().filter { '/' in it && !it.startsWith("Etc/") && !it.startsWith("SystemV/") }.sorted() }
    val shown = remember(query) { all.filter { it.contains(query.trim().replace(' ', '_'), ignoreCase = true) }.take(200) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Timezone") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                LabeledField("Search", query, { query = it.take(40) }, placeholder = "e.g. Kolkata, London")
                LazyColumn(Modifier.heightIn(max = 320.dp)) {
                    items(shown, key = { it }) { tz ->
                        Text(
                            tz.replace('_', ' '),
                            style = if (tz == current) Almanac.type.bodyStrong else Almanac.type.body,
                            color = if (tz == current) c.moss else c.ink,
                            modifier = Modifier.fillMaxWidth().clickable { onPick(tz) }.padding(vertical = 10.dp),
                        )
                    }
                }
                if (shown.isEmpty()) Text("No match. Try a city name.", style = Almanac.type.caption, color = c.faint)
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun DeleteAccountDialog(email: String, vm: SettingsViewModel, onDismiss: () -> Unit) {
    val c = Almanac.colors
    val scope = rememberCoroutineScope()
    var typed by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    var pending by rememberSaveable { mutableStateOf(false) }
    val matches = typed.trim().equals(email.trim(), ignoreCase = true) && password.isNotEmpty()
    AlertDialog(
        onDismissRequest = { if (!pending) onDismiss() },
        title = { Text("Delete your account?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("This permanently deletes every goal, habit, session and check-in. Type your email and password to confirm.", style = Almanac.type.small, color = c.muted)
                FormError(error)
                LabeledField("Email", typed, { typed = it.take(254) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
                LabeledField("Password", password, { password = it.take(128) }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
            }
        },
        confirmButton = {
            TextButton(enabled = matches && !pending, onClick = {
                pending = true
                scope.launch {
                    error = vm.deleteAccount(typed, password)
                    pending = false
                    if (error == null) onDismiss()
                }
            }) { Text(if (pending) "Deleting…" else "Delete forever", color = if (matches) c.clay else c.faint) }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !pending) { Text("Cancel") } },
    )
}
