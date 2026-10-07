package com.almanac.tracker.core

import com.almanac.tracker.core.network.ApiClient
import com.almanac.tracker.core.network.AppError
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.Serializable
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

class ApiClientTest {
    private val server = MockWebServer()
    private var unauthorizedCalls = 0

    @Serializable data class Pong(val ok: Boolean)

    @Before fun start() = server.start()
    @After fun stop() = server.close()

    private fun client(token: String? = "tok") =
        ApiClient(server.url("/api/v1/").toString(), tokenProvider = { token }, onUnauthorized = { unauthorizedCalls++ })

    @Test fun sendsBearerTokenAndParsesBody() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"ok":true,"extra":"ignored"}""").build())
        val pong: Pong = client().get("ping")
        assertTrue(pong.ok)
        val req = server.takeRequest()
        assertEquals("Bearer tok", req.headers["Authorization"])
        assertEquals("/api/v1/ping", req.url.encodedPath)
    }

    @Test fun mapsErrorEnvelopeToApiError() = runTest {
        server.enqueue(MockResponse.Builder().code(400).body("""{"error":{"code":"validation","message":"Check fields","fieldErrors":{"name":"Required"}}}""").build())
        try {
            client().get<Pong>("ping")
            fail("expected error")
        } catch (e: AppError.Api) {
            assertEquals(400, e.status)
            assertEquals("validation", e.code)
            assertEquals("Required", e.fieldErrors["name"])
        }
    }

    @Test fun unauthorizedTriggersSignOut() = runTest {
        server.enqueue(MockResponse.Builder().code(401).body("""{"error":{"code":"unauthorized","message":"no"}}""").build())
        try {
            client().get<Pong>("ping")
            fail("expected error")
        } catch (e: AppError.Unauthorized) {
            assertEquals(1, unauthorizedCalls)
        }
    }

    @Test fun missingTokenNeverHitsTheNetwork() = runTest {
        try {
            client(token = null).get<Pong>("ping")
            fail("expected error")
        } catch (e: AppError.Unauthorized) {
            assertEquals(0, server.requestCount)
        }
    }

    @Test fun nonJsonServerErrorStillGivesFriendlyMessage() = runTest {
        server.enqueue(MockResponse.Builder().code(502).body("<html>bad gateway</html>").build())
        try {
            client().get<Pong>("ping")
            fail("expected error")
        } catch (e: AppError.Api) {
            assertEquals(502, e.status)
            assertTrue(e.message.contains("server"))
        }
    }

    @Test fun malformedSuccessBodyIsUnexpected() = runTest {
        server.enqueue(MockResponse.Builder().body("""{"nope":1}""").build())
        try {
            client().get<Pong>("ping")
            fail("expected error")
        } catch (e: AppError.Unexpected) {
            // ok
        }
    }
}
