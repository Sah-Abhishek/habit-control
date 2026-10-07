import java.util.Properties

plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
  alias(libs.plugins.kotlin.serialization)
}

// Per-machine settings live in local.properties (never committed):
//   almanac.apiBaseUrl=http://localhost:3000/api/v1/   (with `adb reverse tcp:3000 tcp:3000`)
val local = Properties().apply {
  rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}
fun setting(key: String, default: String = ""): String =
  (local.getProperty(key) ?: providers.gradleProperty(key).orNull ?: default).trim()

android {
  namespace = "com.almanac.tracker"
  // Current AndroidX needs compileSdk 37; targetSdk (runtime behaviour) stays at 36.
  compileSdk = 37
  defaultConfig {
    applicationId = "com.almanac.tracker"
    minSdk = 26
    targetSdk = 36
    versionCode = 1
    versionName = "0.1.0"

    val apiBaseUrl = setting("almanac.apiBaseUrl", "http://localhost:3000/api/v1/")
    require(apiBaseUrl.endsWith("/api/v1/")) { "almanac.apiBaseUrl must end with /api/v1/" }
    buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }

  buildTypes {
    release {
      isMinifyEnabled = true
      isShrinkResources = true
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = true
    aidl = false
    buildConfig = true
    shaders = false
  }
  packaging {
    resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
  }
  testOptions {
    unitTests.isReturnDefaultValues = true
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  implementation(platform(libs.androidx.compose.bom))

  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.core.splashscreen)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.lifecycle.process)
  implementation(libs.androidx.activity.compose)
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)
  implementation(libs.androidx.datastore.preferences)
  implementation(libs.androidx.work.runtime.ktx)

  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  debugImplementation(libs.androidx.compose.ui.tooling)

  implementation(libs.androidx.navigation3.ui)
  implementation(libs.androidx.navigation3.runtime)
  implementation(libs.androidx.lifecycle.viewmodel.navigation3)

  implementation(libs.okhttp)
  implementation(libs.kotlinx.serialization.json)
  implementation(libs.kotlinx.coroutines.android)

  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)
  testImplementation(libs.okhttp.mockwebserver)
}
