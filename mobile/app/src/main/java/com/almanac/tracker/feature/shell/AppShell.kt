package com.almanac.tracker.feature.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.feature.calendar.CalendarScreen
import com.almanac.tracker.feature.calendar.DayScreen
import com.almanac.tracker.feature.habits.HabitDetailScreen
import com.almanac.tracker.feature.habits.HabitsScreen
import com.almanac.tracker.feature.insights.InsightsScreen
import com.almanac.tracker.feature.insights.WeeklyReviewScreen
import com.almanac.tracker.feature.plan.GoalDetailScreen
import com.almanac.tracker.feature.plan.PlanScreen
import com.almanac.tracker.feature.plan.TasksScreen
import com.almanac.tracker.feature.quicklog.QuickLogSheet
import com.almanac.tracker.feature.settings.OnboardingScreen
import com.almanac.tracker.feature.settings.SettingsScreen
import com.almanac.tracker.feature.settings.shouldShowOnboarding
import com.almanac.tracker.feature.study.FocusSessionScreen
import com.almanac.tracker.feature.study.SubjectScreen
import com.almanac.tracker.feature.study.WrapUpScreen
import com.almanac.tracker.feature.today.TodayScreen
import com.almanac.tracker.navigation.CalendarKey
import com.almanac.tracker.navigation.DayKey
import com.almanac.tracker.navigation.GoalDetailKey
import com.almanac.tracker.navigation.HabitDetailKey
import com.almanac.tracker.navigation.HabitsKey
import com.almanac.tracker.navigation.InsightsKey
import com.almanac.tracker.navigation.LocalNavigator
import com.almanac.tracker.navigation.Navigator
import com.almanac.tracker.navigation.OnboardingKey
import com.almanac.tracker.navigation.PlanKey
import com.almanac.tracker.navigation.SessionKey
import com.almanac.tracker.navigation.SettingsKey
import com.almanac.tracker.navigation.SubjectKey
import com.almanac.tracker.navigation.TabKeys
import com.almanac.tracker.navigation.TasksKey
import com.almanac.tracker.navigation.TodayKey
import com.almanac.tracker.navigation.WeeklyReviewKey
import com.almanac.tracker.navigation.WrapUpKey
import com.almanac.tracker.ui.components.AlmanacIcon
import com.almanac.tracker.ui.components.LocalMessenger
import com.almanac.tracker.ui.components.Messenger
import com.almanac.tracker.ui.components.StatusBanner
import com.almanac.tracker.ui.theme.Almanac

private class StackNavigator(private val stack: NavBackStack<NavKey>, private val openSheet: () -> Unit) : Navigator {
    override fun go(key: NavKey) {
        if (stack.lastOrNull() != key) stack.add(key)
    }
    override fun back() {
        if (stack.size > 1) stack.removeLastOrNull()
    }
    override fun tab(key: NavKey) {
        stack.clear()
        stack.add(key)
    }
    override fun replace(key: NavKey) {
        if (stack.isNotEmpty()) stack.removeLastOrNull()
        stack.add(key)
    }
    override fun openQuickLog() = openSheet()
}

@Composable
fun AppShell(container: AppContainer, shellVm: ShellViewModel = viewModel { ShellViewModel(container) }) {
    val shell by shellVm.state.collectAsStateWithLifecycle()
    val backStack = rememberNavBackStack(TodayKey)
    var quickLogOpen by rememberSaveable { mutableStateOf(false) }
    val navigator = remember(backStack) { StackNavigator(backStack) { quickLogOpen = true } }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val messenger = remember(snackbar) { Messenger(snackbar, scope) }
    val top = backStack.lastOrNull() ?: TodayKey
    val showTabs = top in TabKeys

    // New accounts start in onboarding once per app session; every step there is skippable.
    var onboardingShown by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(shell.me) {
        if (!onboardingShown && shouldShowOnboarding(shell.me)) {
            onboardingShown = true
            navigator.tab(OnboardingKey)
        }
    }

    CompositionLocalProvider(LocalNavigator provides navigator, LocalMessenger provides messenger) {
        Scaffold(
            containerColor = Almanac.colors.page,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = { if (showTabs) TabBar(top, onTab = navigator::tab, onQuickLog = navigator::openQuickLog) },
        ) { padding ->
            Column(Modifier.fillMaxSize().background(Almanac.colors.page).padding(bottom = padding.calculateBottomPadding())) {
                Banners(shell, onDismissFailures = shellVm::dismissFailures)
                Box(Modifier.weight(1f)) {
                    NavDisplay(
                        backStack = backStack,
                        onBack = { navigator.back() },
                        entryDecorators = listOf(rememberSaveableStateHolderNavEntryDecorator(), rememberViewModelStoreNavEntryDecorator()),
                        entryProvider = entryProvider {
                            entry<TodayKey> { TodayScreen() }
                            entry<PlanKey> { PlanScreen() }
                            entry<HabitsKey> { HabitsScreen() }
                            entry<InsightsKey> { InsightsScreen() }
                            entry<HabitDetailKey> { HabitDetailScreen(it.id) }
                            entry<GoalDetailKey> { GoalDetailScreen(it.id) }
                            entry<SubjectKey> { SubjectScreen(it.id) }
                            entry<TasksKey> { TasksScreen() }
                            entry<SessionKey> { FocusSessionScreen() }
                            entry<WrapUpKey> { WrapUpScreen(it.sessionId, it.longSession) }
                            entry<CalendarKey> { CalendarScreen(it.month) }
                            entry<DayKey> { DayScreen(it.date) }
                            entry<WeeklyReviewKey> { WeeklyReviewScreen(it.week) }
                            entry<SettingsKey> { SettingsScreen() }
                            entry<OnboardingKey> { OnboardingScreen() }
                        },
                    )
                }
            }
            if (quickLogOpen) QuickLogSheet(onDismiss = { quickLogOpen = false })
        }
    }
}

@Composable
private fun Banners(shell: ShellState, onDismissFailures: () -> Unit) {
    val modifier = Modifier.statusBarsPadding().padding(horizontal = 16.dp).padding(top = 8.dp)
    when {
        !shell.online -> StatusBanner(
            if (shell.pendingChanges > 0) "Offline · ${shell.pendingChanges} change${if (shell.pendingChanges == 1) "" else "s"} saved on this phone. They’ll sync on their own."
            else "You’re offline. You can still log habits and check-ins; they’ll sync later.",
            AlmanacIcon.CloudOff, modifier,
        )
        shell.failures.isNotEmpty() -> StatusBanner(
            "${shell.failures.size} offline change${if (shell.failures.size == 1) "" else "s"} couldn’t be saved: ${shell.failures.last().label} — ${shell.failures.last().message}",
            AlmanacIcon.Alert, modifier, inverse = false, action = "Dismiss" to onDismissFailures,
        )
        shell.pendingChanges > 0 -> StatusBanner("Syncing ${shell.pendingChanges} change${if (shell.pendingChanges == 1) "" else "s"}…", AlmanacIcon.Refresh, modifier, inverse = false)
    }
}
