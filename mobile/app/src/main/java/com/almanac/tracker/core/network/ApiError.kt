package com.almanac.tracker.core.network

import kotlinx.serialization.Serializable

@Serializable
internal data class ErrorEnvelope(val error: ErrorBody)

@Serializable
internal data class ErrorBody(
    val code: String = "internal",
    val message: String = "Something went wrong.",
    val fieldErrors: Map<String, String>? = null,
)

/** Failures the UI can explain. `message` is written for people and safe to show. */
sealed class AppError(override val message: String) : Exception(message) {
    /** Server answered with an error envelope (4xx / 5xx). */
    class Api(val status: Int, val code: String, message: String, val fieldErrors: Map<String, String> = emptyMap()) : AppError(message)

    /** No connection, DNS failure, timeout — the request may not have reached the server. */
    class Offline(cause: Throwable? = null) : AppError("You’re offline. We’ll keep what you can do here and sync when you’re back.") {
        init { if (cause != null) initCause(cause) }
    }

    /** The token is missing, expired or revoked. */
    class Unauthorized : AppError("Your session ended. Please sign in again.")

    /** The response didn't match what this app version expects. */
    class Unexpected(cause: Throwable? = null) : AppError("Something unexpected came back from the server. Try again, or update the app.") {
        init { if (cause != null) initCause(cause) }
    }
}

/** True for failures worth retrying later (network or 5xx), false for client mistakes. */
val AppError.isRetryable: Boolean
    get() = this is AppError.Offline || (this is AppError.Api && status >= 500)

fun Throwable.toAppError(): AppError = when (this) {
    is AppError -> this
    is java.io.IOException -> AppError.Offline(this)
    else -> AppError.Unexpected(this)
}
