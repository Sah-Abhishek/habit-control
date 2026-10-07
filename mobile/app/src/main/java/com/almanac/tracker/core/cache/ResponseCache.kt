package com.almanac.tracker.core.cache

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

/**
 * Last-known-good JSON for screens, so the app opens instantly and works read-only
 * offline. Stored in app-private storage and wiped on sign-out.
 */
class ResponseCache(context: Context) {
    private val dir = File(context.filesDir, "response-cache-v1").apply { mkdirs() }

    private fun file(key: String): File {
        val hash = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) }
        return File(dir, "$hash.json")
    }

    suspend fun read(key: String): String? = withContext(Dispatchers.IO) {
        file(key).takeIf { it.exists() }?.runCatching { readText() }?.getOrNull()
    }

    suspend fun write(key: String, json: String) = withContext(Dispatchers.IO) {
        val target = file(key)
        val tmp = File(dir, "${target.name}.tmp")
        runCatching {
            tmp.writeText(json)
            tmp.renameTo(target) // atomic replace: never leaves a half-written file
        }
        Unit
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        dir.listFiles()?.forEach { it.delete() }
        Unit
    }
}
