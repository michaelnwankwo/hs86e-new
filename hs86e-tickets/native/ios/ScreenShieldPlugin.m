#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Objective-C bridge metadata for the Swift ScreenShield plugin
// (RSG-ENG-SEC-006 Phase 3). Add alongside ScreenShieldPlugin.swift to the
// Xcode App target.

CAP_PLUGIN(ScreenShieldPlugin, "ScreenShield",
           CAP_PLUGIN_METHOD(enableSecureFlag, CAPPluginReturnPromise);
)
