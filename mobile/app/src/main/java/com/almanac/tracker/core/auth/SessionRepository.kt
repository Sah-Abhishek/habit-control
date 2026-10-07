package com.almanac.tracker.core.auth

import com.almanac.tracker.core.network.AppError
import com.almanac.tracker.core.network.ApiClient
import com.almanac.tracker.core.network.await
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

@Serializable
private data class SignInBody(val email: String, val password: String)

@Serializable
private data class SignUpBody(val name: String, val email: String, val password: String)

/** Sign in / up / out against Better Auth; the token arrives in the `set-auth-token` header. */
class SessionRepository(
    private val api: ApiClient,
    private val tokens: TokenStore,
    private val onSignedOut: suspend () -> Unit,
) {
    suspend fun signIn(email: String, password: String) =
        authenticate("sign-in/email", api.json().encodeToString(SignInBody.serializer(), SignInBody(email.trim(), password)), email.trim(), signUp = false)

    suspend fun signUp(name: String, email: String, password: String) =
        authenticate("sign-up/email", api.json().encodeToString(SignUpBody.serializer(), SignUpBody(name.trim(), email.trim(), password)), email.trim(), signUp = true)

    private suspend fun authenticate(path: String, body: String, email: String, signUp: Boolean) = withContext(Dispatchers.IO) {
        authenticateBlocking(path, body, email, signUp)
    }

    private suspend fun authenticateBlocking(path: String, body: String, email: String, signUp: Boolean) {
        val request = Request.Builder()
            .url(api.authBase.resolve(path)!!)
            .post(body.toRequestBody("application/json".toMediaType()))
            .build()
        val response = try {
            api.http.newCall(request).await()
        } catch (e: IOException) {
            throw AppError.Offline(e)
        }
        response.use {
            if (it.isSuccessful) {
                val token = it.header("set-auth-token") ?: throw AppError.Unexpected()
                tokens.save(token, email)
                return
            }
            val text = runCatching { it.body.string() }.getOrDefault("")
            throw friendly(it.code, text, signUp)
        }
    }

    /** Never reveals whether an email exists on sign-in. */
    private fun friendly(status: Int, text: String, signUp: Boolean): AppError = when {
        status == 429 -> AppError.Api(429, "rate_limited", "Too many attempts. Wait a minute and try again.")
        !signUp && (status == 401 || status == 400) -> AppError.Api(status, "invalid_credentials", "That email and password don’t match. Check both and try again.")
        signUp && text.contains("USER_ALREADY_EXISTS") -> AppError.Api(status, "exists", "An account with this email already exists. Sign in instead?")
        signUp && text.contains("PASSWORD_TOO_SHORT") -> AppError.Api(status, "validation", "Use at least 10 characters.", mapOf("password" to "Use at least 10 characters."))
        signUp && text.contains("INVALID_EMAIL") -> AppError.Api(status, "validation", "Enter a valid email address.", mapOf("email" to "Enter a valid email address."))
        status >= 500 -> AppError.Api(status, "internal", "The server had a problem. Try again in a moment.")
        else -> AppError.Api(status, "unknown", if (signUp) "We couldn’t create your account right now." else "We couldn’t sign you in right now.")
    }

    /** Best effort server sign-out; local state is cleared regardless. */
    suspend fun signOut() {
        val token = tokens.token()
        if (token != null) {
            runCatching {
                val request = Request.Builder()
                    .url(api.authBase.resolve("sign-out")!!)
                    .header("Authorization", "Bearer $token")
                    .post("{}".toRequestBody("application/json".toMediaType()))
                    .build()
                api.http.newCall(request).await().close()
            }
        }
        tokens.clear()
        onSignedOut()
    }
}
