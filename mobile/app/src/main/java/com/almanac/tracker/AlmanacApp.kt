package com.almanac.tracker

import android.app.Application
import com.almanac.tracker.core.AppContainer

class AlmanacApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.startSync()
    }
}
