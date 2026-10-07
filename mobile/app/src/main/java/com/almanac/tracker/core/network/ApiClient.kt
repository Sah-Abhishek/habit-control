package com.almanac.tracker.core.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.serializer
import okhttp3.Call
import okhttp3.Callback
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

val AppJson = Json {
    ignoreUnknownKeys = true // tolerate new server fields
    explicitNulls = false
    encodeDefaults = true
    coerceInputValues = true
}

private val JSON_TYPE = "application/json; charset=utf-8".toMediaType()

/**
 * Thin typed client for /api/v1. Adds the bearer token, maps error envelopes to
 * [AppError], and reports 401s through [onUnauthorized] so the app can sign out.
 */
class ApiClient(
    baseUrl: String,
    private val tokenProvider: suspend () -> String?,
    private val onUnauthorized: suspend () -> Unit,
    private val json: Json = AppJson,
    httpClient: OkHttpClient? = null,
) {
    val base: HttpUrl = baseUrl.toHttpUrl()

    /** /api/auth/ — sibling of /api/v1/. */
    val authBase: HttpUrl = base.resolve("../auth/")!!

    val http: OkHttpClient = httpClient ?: OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .callTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend inline fun <reified T> get(path: String, query: Map<String, String?> = emptyMap()): T =
        request("GET", path, query, null, serializer<T>())

    suspend inline fun <reified B, reified T> post(path: String, body: B): T =
        request("POST", path, emptyMap(), json().encodeToString(serializer<B>(), body), serializer<T>())

    suspend inline fun <reified B, reified T> put(path: String, body: B): T =
        request("PUT", path, emptyMap(), json().encodeToString(serializer<B>(), body), serializer<T>())

    suspend inline fun <reified B, reified T> patch(path: String, body: B): T =
        request("PATCH", path, emptyMap(), json().encodeToString(serializer<B>(), body), serializer<T>())

    suspend fun delete(path: String, body: String? = null) {
        requestRaw("DELETE", path, emptyMap(), body)
    }

    fun json(): Json = json

    suspend fun <T> request(method: String, path: String, query: Map<String, String?>, body: String?, deserializer: KSerializer<T>): T {
        val (response, text) = requestRaw(method, path, query, body)
        response.use {
            return try {
                json.decodeFromString(deserializer, text.ifEmpty { "null" })
            } catch (e: SerializationException) {
                throw AppError.Unexpected(e)
            } catch (e: IllegalArgumentException) {
                throw AppError.Unexpected(e)
            }
        }
    }

    /** Executes and returns the successful response and its body text; throws [AppError] otherwise. */
    suspend fun requestRaw(method: String, path: String, query: Map<String, String?>, body: String?): Pair<Response, String> {
        val url = base.resolve(path.removePrefix("/"))!!.newBuilder().apply {
            query.forEach { (k, v) -> if (v != null) addQueryParameter(k, v) }
        }.build()
        val token = tokenProvider() ?: run {
            onUnauthorized()
            throw AppError.Unauthorized()
        }
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/json")
            .method(method, body?.toRequestBody(JSON_TYPE) ?: if (method in setOf("POST", "PUT", "PATCH")) "{}".toRequestBody(JSON_TYPE) else null)
            .build()
        // The body is read synchronously, so the whole exchange must stay off the main
        // thread (Android throws NetworkOnMainThreadException otherwise).
        val (response, text) = withContext(Dispatchers.IO) {
            val response = try {
                http.newCall(request).await()
            } catch (e: IOException) {
                throw AppError.Offline(e)
            }
            val text = try {
                response.body.string()
            } catch (e: IOException) {
                response.close()
                throw AppError.Offline(e)
            }
            response to text
        }
        if (response.isSuccessful) return response to text
        response.close()
        if (response.code == 401) {
            onUnauthorized()
            throw AppError.Unauthorized()
        }
        throw parseError(response.code, text)
    }

    fun parseError(status: Int, text: String): AppError.Api {
        val body = runCatching { json.decodeFromString(ErrorEnvelope.serializer(), text).error }.getOrNull()
        return if (body != null) {
            AppError.Api(status, body.code, body.message, body.fieldErrors.orEmpty())
        } else {
            AppError.Api(status, if (status >= 500) "internal" else "unknown", if (status >= 500) "The server had a problem. Try again in a moment." else "That didn’t work (HTTP $status).")
        }
    }
}

suspend fun Call.await(): Response = suspendCancellableCoroutine { cont ->
    enqueue(object : Callback {
        override fun onResponse(call: Call, response: Response) = cont.resume(response)
        override fun onFailure(call: Call, e: IOException) {
            if (!cont.isCancelled) cont.resumeWithException(e)
        }
    })
    cont.invokeOnCancellation { runCatching { cancel() } }
}
