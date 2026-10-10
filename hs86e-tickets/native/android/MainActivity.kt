package com.hs86e.tickets

import android.os.Bundle
import com.getcapacitor.BridgeActivity

/**
 * Replaces the generated android/app/src/main/java/com/hs86e/tickets/MainActivity.kt
 * so the local ScreenShield plugin (FLAG_SECURE) is registered before the
 * Capacitor bridge initializes.
 */
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ScreenShieldPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
