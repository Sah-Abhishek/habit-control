package com.almanac.tracker.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.almanac.tracker.core.LocalAppContainer
import com.almanac.tracker.ui.components.AlmanacButton
import com.almanac.tracker.ui.components.FormError
import com.almanac.tracker.ui.components.LabeledField
import com.almanac.tracker.ui.theme.Almanac

@Composable
fun AuthScreen() {
    val container = LocalAppContainer.current
    val vm = viewModel { AuthViewModel(container.session) }
    val state by vm.state.collectAsStateWithLifecycle()
    var mode by rememberSaveable { mutableStateOf(AuthMode.SignIn) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    val focus = LocalFocusManager.current
    val c = Almanac.colors
    val submit = { focus.clearFocus(); vm.submit(mode, name, email, password) }

    Box(Modifier.fillMaxSize().background(c.page).systemBarsPadding().imePadding()) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.size(36.dp).clip(RoundedCornerShape(11.dp)).background(c.inverse), contentAlignment = Alignment.Center) {
                    Text("a", style = Almanac.type.title, color = c.inverseInk)
                }
                Text("Almanac", style = Almanac.type.headline, color = c.ink)
            }
            Text(if (mode == AuthMode.SignUp) "Start your almanac." else "Welcome back.", style = Almanac.type.display, color = c.ink)
            Text(
                if (mode == AuthMode.SignUp) "Your data is private to your account. You can export or delete it any time." else "Sign in to pick up where you left off.",
                style = Almanac.type.small, color = c.muted,
            )
            FormError(state.formError)
            if (mode == AuthMode.SignUp) {
                LabeledField(
                    "Name", name, { name = it.take(80) }, error = state.fieldErrors["name"],
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                    keyboardActions = KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) }),
                    modifier = Modifier.semantics { contentType = ContentType.PersonFullName },
                )
            }
            LabeledField(
                "Email", email, { email = it.take(254) }, error = state.fieldErrors["email"],
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                keyboardActions = KeyboardActions(onNext = { focus.moveFocus(FocusDirection.Down) }),
                modifier = Modifier.semantics { contentType = ContentType.EmailAddress + ContentType.Username },
            )
            LabeledField(
                "Password", password, { password = it.take(128) }, error = state.fieldErrors["password"],
                hint = if (mode == AuthMode.SignUp) "At least 10 characters." else null,
                visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { submit() }),
                modifier = Modifier.semantics { contentType = if (mode == AuthMode.SignUp) ContentType.NewPassword else ContentType.Password },
                trailing = {
                    TextButton(onClick = { showPassword = !showPassword }) {
                        Text(if (showPassword) "Hide" else "Show", style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.moss)
                    }
                },
            )
            AlmanacButton(
                if (mode == AuthMode.SignUp) "Create account" else "Sign in",
                onClick = submit,
                pending = state.pending,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            )
            TextButton(
                onClick = { mode = if (mode == AuthMode.SignIn) AuthMode.SignUp else AuthMode.SignIn; vm.clearErrors() },
                modifier = Modifier.align(Alignment.CenterHorizontally),
            ) {
                Text(
                    if (mode == AuthMode.SignIn) "New here? Create an account" else "Already have an account? Sign in",
                    style = Almanac.type.small.copy(fontWeight = FontWeight.SemiBold), color = c.moss,
                )
            }
        }
    }
}
