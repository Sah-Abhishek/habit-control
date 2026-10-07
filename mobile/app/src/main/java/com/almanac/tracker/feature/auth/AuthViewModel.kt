package com.almanac.tracker.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.almanac.tracker.core.auth.SessionRepository
import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.toAppError
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class AuthMode { SignIn, SignUp }

data class AuthState(val pending: Boolean = false, val formError: String? = null, val fieldErrors: Map<String, String> = emptyMap())

class AuthViewModel(private val session: SessionRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    fun clearErrors() = _state.update { AuthState() }

    fun submit(mode: AuthMode, name: String, email: String, password: String) {
        if (_state.value.pending) return // double-tap guard
        val errors = validate(mode, name, email, password)
        if (errors.isNotEmpty()) {
            _state.value = AuthState(fieldErrors = errors)
            return
        }
        _state.value = AuthState(pending = true)
        viewModelScope.launch {
            try {
                if (mode == AuthMode.SignUp) session.signUp(name, email, password) else session.signIn(email, password)
                // Success flips TokenStore.signedIn → the root swaps to the app.
                _state.value = AuthState()
            } catch (t: Throwable) {
                val e = t.toAppError()
                _state.value = AuthState(formError = e.message, fieldErrors = (e as? AppError.Api)?.fieldErrors.orEmpty())
            }
        }
    }

    companion object {
        private val EMAIL = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

        fun validate(mode: AuthMode, name: String, email: String, password: String): Map<String, String> = buildMap {
            if (mode == AuthMode.SignUp && name.isBlank()) put("name", "What should we call you?")
            if (!EMAIL.matches(email.trim())) put("email", "Enter a valid email address.")
            if (mode == AuthMode.SignUp && password.length < 10) put("password", "Use at least 10 characters.")
            if (mode == AuthMode.SignIn && password.isEmpty()) put("password", "Enter your password.")
        }
    }
}
