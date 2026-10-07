package com.almanac.tracker.core.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

private val Context.authStore by preferencesDataStore(name = "auth")

/**
 * Stores the session token encrypted with an AES-GCM key that lives in the Android
 * Keystore (never exportable). If the key is lost (e.g. device restore) the token
 * simply fails to decrypt and the user signs in again.
 */
class TokenStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("token")
    private val emailKey = stringPreferencesKey("email")
    private val mutex = Mutex()
    @Volatile private var cached: String? = null
    @Volatile private var loaded = false

    val signedIn: Flow<Boolean> = context.authStore.data.map { it[tokenKey] != null }
    val email: Flow<String?> = context.authStore.data.map { it[emailKey] }

    suspend fun token(): String? = mutex.withLock {
        if (!loaded) {
            cached = context.authStore.data.first()[tokenKey]?.let { decrypt(it) }
            loaded = true
        }
        cached
    }

    suspend fun save(token: String, email: String) = mutex.withLock {
        val encrypted = encrypt(token)
        context.authStore.edit {
            it[tokenKey] = encrypted
            it[emailKey] = email
        }
        cached = token
        loaded = true
    }

    suspend fun clear() = mutex.withLock {
        context.authStore.edit { it.remove(tokenKey) }
        cached = null
        loaded = true
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    private fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
        val out = cipher.iv + cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    private fun decrypt(stored: String): String? = runCatching {
        val bytes = Base64.decode(stored, Base64.NO_WRAP)
        val iv = bytes.copyOfRange(0, IV_BYTES)
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        String(cipher.doFinal(bytes.copyOfRange(IV_BYTES, bytes.size)), Charsets.UTF_8)
    }.getOrNull()

    private companion object {
        const val ALIAS = "almanac_session_key"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val IV_BYTES = 12
    }
}
