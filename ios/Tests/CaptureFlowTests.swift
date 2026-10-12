import Foundation

@main
struct CaptureFlowTests {
    static func main() {
        // Regression: both horizontal holding directions must agree with the
        // rear camera's native orientation. The former values were reversed.
        assert(CaptureOrientation.landscapeRight.cameraRotationDegrees == 0)
        assert(CaptureOrientation.landscapeLeft.cameraRotationDegrees == 180)
        assert(CaptureOrientation.portrait.cameraRotationDegrees == 90)
        assert(CaptureOrientation.portraitUpsideDown.cameraRotationDegrees == 270)
        var flow = CaptureFlow()
        assert(CaptureStage.captureOrder == [.middle, .upper, .lower, .detail])
        assert(!flow.beginCapture(), "Cannot record through the positioning overlay")
        flow.screen = .ready
        assert(flow.beginCapture())
        assert(!flow.beginCapture(), "Rapid taps must not start a second recording")
        assert(!flow.request(.next), "Next must wait for the recording to save")
        assert(flow.stage == .middle && flow.capturedStage == .middle)
        assert(!flow.request(.exit), "A pending transition must not be replaced by a rapid tap")
        assert(flow.pendingAction == .next)
        assert(flow.mediaSaved(success: true) == .next)
        flow.advance()
        assert(flow.stage == .upper && flow.screen == .tutorial)
        assert(flow.capturedStage == .middle, "The saved clip belongs to its original stage")
        flow.screen = .ready
        assert(flow.beginCapture())
        assert(!flow.request(.next))
        assert(flow.mediaSaved(success: false) == nil)
        assert(flow.stage == .upper && !flow.inFlight && !flow.saving, "A save failure must retain the current stage")
        assert(flow.beginCapture(), "Capture can be retried after a failure")
        assert(!flow.request(.exit))
        assert(flow.mediaSaved(success: true) == .exit)
        flow.stage = .detail
        flow.screen = .ready
        assert(flow.beginCapture())
        assert(!flow.request(.finish))
        assert(flow.stage.next == nil)
        assert(flow.mediaSaved(success: true) == .finish)
        assert(flow.request(.finish), "A completed clip can be finalized without recording again")
        let legacyJSON = """
        {"id":"00000000-0000-0000-0000-000000000001","projectId":"00000000-0000-0000-0000-000000000002","mode":"video","createdAt":0,"media":[],"skippedStages":["upper"]}
        """
        let decoder = JSONDecoder()
        let legacy = try! decoder.decode(CaptureSessionRecord.self, from: Data(legacyJSON.utf8))
        assert(legacy.activeStage == nil && legacy.skippedStages == [.upper], "Old projects must remain readable")
        var resumed = legacy
        resumed.activeStage = .lower
        let restored = try! decoder.decode(CaptureSessionRecord.self, from: JSONEncoder().encode(resumed))
        assert(restored.activeStage == .lower, "Current stage survives a reload")
        print("PASS: all four camera orientations, stage order, duplicate taps, deferred transitions, stage ownership, save failure, retry, finish and exit")
    }
}
