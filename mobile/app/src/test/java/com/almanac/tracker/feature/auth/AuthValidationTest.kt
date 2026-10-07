package com.almanac.tracker.feature.auth

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthValidationTest {
    @Test fun signUpRequiresNameValidEmailAndLongPassword() {
        val errors = AuthViewModel.validate(AuthMode.SignUp, " ", "not-an-email", "short")
        assertEquals(setOf("name", "email", "password"), errors.keys)
    }

    @Test fun signInOnlyNeedsEmailAndAnyPassword() {
        assertTrue(AuthViewModel.validate(AuthMode.SignIn, "", "a@b.co", "x").isEmpty())
        assertEquals(setOf("password"), AuthViewModel.validate(AuthMode.SignIn, "", "a@b.co", "").keys)
    }

    @Test fun emailIsTrimmedBeforeValidation() {
        assertTrue(AuthViewModel.validate(AuthMode.SignIn, "", "  a@b.co  ", "pw").isEmpty())
    }
}
