import Foundation

@main
enum HighlightExposureTests {
    static func main() {
        let suite = "HighlightModeTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        precondition(HighlightProtectionMode.load(from: defaults) == .off)
        defaults.set(true, forKey: HighlightProtectionMode.legacyPreferenceKey)
        precondition(HighlightProtectionMode.load(from: defaults) == .autoExposure)
        HighlightProtectionMode.systemHDR.save(to: defaults)
        precondition(!defaults.bool(forKey: HighlightProtectionMode.legacyPreferenceKey))
        defaults.set(true, forKey: HighlightProtectionMode.legacyPreferenceKey)
        precondition(HighlightProtectionMode.load(from: defaults) == .systemHDR)
        precondition(HighlightProtectionMode.load(from: defaults, captureMode: .photo) == .off)
        precondition(HighlightProtectionMode.load(from: defaults) == .systemHDR)
        HighlightProtectionMode.autoExposure.save(to: defaults)
        precondition(HighlightProtectionMode.load(from: defaults) == .autoExposure)
        HighlightProtectionMode.off.save(to: defaults)
        precondition(HighlightProtectionMode.load(from: defaults) == .off)
        print("PASS: exclusive modes, legacy migration, photo isolation, persistence")
        var controller = HighlightExposureController()
        let normal = [UInt8](repeating: 160, count: 1000)
        let clipped = [UInt8](repeating: 255, count: 1000)
        let band = [UInt8](repeating: 225, count: 1000)
        precondition(controller.update(luminance: normal, minimumBias: -8) == 0, "Normal light must not be darkened")
        let sparseHighlights = [UInt8](repeating: 160, count: 990) + [UInt8](repeating: 255, count: 10)
        precondition(controller.update(luminance: sparseHighlights, minimumBias: -8) == 0, "Tiny lamps/reflections must not darken the scene")
        let window = [UInt8](repeating: 160, count: 900) + [UInt8](repeating: 255, count: 100)
        let first = controller.update(luminance: window, minimumBias: -8)
        precondition(first < 0 && first >= -0.21, "A bright window should smoothly lower exposure")
        precondition(controller.update(luminance: band, minimumBias: -8) == first, "Dead band must hold exposure to prevent pumping")
        precondition(controller.update(luminance: [], minimumBias: -8) == first, "Missing samples must not change exposure")
        for _ in 0..<100 { _ = controller.update(luminance: clipped, minimumBias: -8) }
        precondition(abs(controller.bias + 1.5) < 0.001, "Persistent clipping must have a bounded correction")
        let recovery = controller.update(luminance: normal, minimumBias: -8)
        precondition(recovery > -1.5 && recovery <= -1.39, "Recovery must be slower than reduction")
        for _ in 0..<100 { _ = controller.update(luminance: normal, minimumBias: -8) }
        precondition(controller.bias == 0, "Normal/dim scenes must recover to unbiased automatic exposure")
        for _ in 0..<100 { _ = controller.update(luminance: clipped, minimumBias: -0.5) }
        precondition(controller.bias == -0.5, "Respect camera bias limits")
        controller.reset()
        precondition(controller.bias == 0, "Turning off/resetting must clear correction")
        precondition(controller.update(luminance: clipped, minimumBias: 0) == 0, "No negative-bias support must never boost exposure")
        print("PASS: normal light, sparse highlights, bright windows, dead band, missing frames, correction limit, slow recovery, hardware limits, reset")
    }
}
