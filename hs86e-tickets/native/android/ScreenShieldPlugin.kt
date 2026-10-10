package com.hs86e.tickets

import android.view.WindowManager
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * RSG-ENG-SEC-006 Phase 3 — Android screen shield.
 *
 * Sets FLAG_SECURE on the activity window: the OS then blocks screenshots,
 * screen recordings, and non-secure display casting for the whole app.
 * The flag is applied on plugin load (app start) and can be re-asserted
 * from JS via enableSecureFlag().
 *
 * Drop-in location: android/app/src/main/java/com/hs86e/tickets/
 */
@CapacitorPlugin(name = "ScreenShield")
class ScreenShieldPlugin : Plugin() {

    override fun load() {
        applySecureFlag()
    }

    @PluginMethod
    fun enableSecureFlag(call: PluginCall) {
        applySecureFlag()
        call.resolve()
    }

    private fun applySecureFlag() {
        activity.runOnUiThread {
            activity.window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
    }
}
