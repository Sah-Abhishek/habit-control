package com.almanac.tracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.AppContainer
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.feature.auth.AuthScreen
import com.almanac.tracker.feature.shell.AppShell
import com.almanac.tracker.feature.shell.ShellViewModel
import com.almanac.tracker.ui.theme.AlmanacTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        // Keep the splash up until we know whether the user is signed in (no blank frame).
        var ready = false
        installSplashScreen().setKeepOnScreenCondition { !ready }
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val container = (application as AlmanacApp).container
        setContent {
            CompositionLocalProvider(LocalAppContainer provides container) { Root(container, onReady = { ready = true }) }
        }
    }
}

@Composable
private fun Root(container: AppContainer, onReady: () -> Unit) {
    // null until DataStore answers, so we never flash the sign-in screen for signed-in users.
    val signedIn by container.tokens.signedIn.collectAsState(initial = null)
    if (signedIn != null) onReady()
    when (signedIn) {
        null -> AlmanacTheme {}
        false -> AlmanacTheme { AuthScreen() }
        true -> {
            val shellVm = viewModel { ShellViewModel(container) }
            val shell by shellVm.state.collectAsStateWithLifecycle()
            AlmanacTheme(shell.theme) { AppShell(container, shellVm) }
        }
    }
}

