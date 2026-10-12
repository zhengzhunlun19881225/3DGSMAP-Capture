import XCTest

final class CaptureSmokeTests: XCTestCase {
    private func screenshot(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testProjectCreationAndPersistence() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.navigationBars["我的项目"].waitForExistence(timeout: 15))
        screenshot(app, "project-list-before")
        app.buttons["新项目"].tap()
        let field = app.textFields["项目名称"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        let name = "Mac-Smoke-" + UUID().uuidString.prefix(8)
        field.typeText(String(name))
        app.buttons["创建"].tap()
        XCTAssertTrue(app.staticTexts[String(name)].waitForExistence(timeout: 10))
        screenshot(app, "created-project")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts[String(name)].waitForExistence(timeout: 15))
        app.staticTexts[String(name)].tap()
        XCTAssertTrue(app.buttons["照片采集"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["视频采集"].exists)
        screenshot(app, "restored-project-detail")
    }

    func testConnectionInputValidation() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["连接电脑"].waitForExistence(timeout: 15))
        app.buttons["连接电脑"].tap()
        XCTAssertTrue(app.buttons["检查连接并保存"].waitForExistence(timeout: 5))
        app.buttons["检查连接并保存"].tap()
        XCTAssertTrue(app.staticTexts["请输入电脑地址，例如 http://192.168.1.10:8788"].waitForExistence(timeout: 5))
        let address = app.textFields["http://192.168.1.10:8788"]
        address.tap()
        address.typeText("http://127.0.0.1:8788")
        app.buttons["检查连接并保存"].tap()
        XCTAssertTrue(app.staticTexts["请输入电脑连接密钥"].waitForExistence(timeout: 5))
        screenshot(app, "connection-validation")
        app.buttons["完成"].tap()
        XCTAssertTrue(app.navigationBars["我的项目"].waitForExistence(timeout: 5))
    }
    func testGuidedRoomCaptureAndSkippedStagesPersist() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["新项目"].waitForExistence(timeout: 15))
        app.buttons["新项目"].tap()
        let field = app.textFields["项目名称"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        let name = "Room-UI-" + UUID().uuidString.prefix(8)
        field.typeText(String(name))
        app.buttons["创建"].tap()
        app.staticTexts[String(name)].tap()
        app.buttons["视频采集"].tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        if springboard.buttons["允许"].waitForExistence(timeout: 2) { springboard.buttons["允许"].tap() }
        if springboard.buttons["Allow"].exists { springboard.buttons["Allow"].tap() }
        XCTAssertTrue(app.staticTexts["请将手机横置"].waitForExistence(timeout: 8))
        screenshot(app, "capture-portrait-rotation")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["capture.positioned"].waitForExistence(timeout: 8))
        screenshot(app, "capture-positioning")
        app.buttons["capture.positioned"].tap()
        let title = app.staticTexts["capture.guideTitle"]
        XCTAssertTrue(title.waitForExistence(timeout: 5))
        XCTAssertEqual(title.label, "第1步：环绕房间水平视角拍摄")
        screenshot(app, "capture-horizontal-tutorial")
        app.buttons["capture.continue"].tap()
        XCTAssertTrue(app.buttons["拍摄设置"].waitForExistence(timeout: 5))
        screenshot(app, "capture-horizontal-ready")
        XCUIDevice.shared.orientation = .landscapeRight
        XCTAssertTrue(app.buttons["拍摄设置"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.staticTexts["请将手机横置"].exists)
        screenshot(app, "capture-horizontal-ready-opposite")
        XCUIDevice.shared.orientation = .landscapeLeft
        app.buttons["拍摄设置"].tap()
        XCTAssertTrue(app.navigationBars["拍摄设置"].waitForExistence(timeout: 5))
        let resolution = app.segmentedControls["capture.resolution"]
        XCTAssertTrue(resolution.exists)
        XCTAssertTrue(resolution.buttons["4K"].exists)
        XCTAssertTrue(resolution.buttons["1080p"].exists)
        XCTAssertFalse(resolution.isEnabled, "Simulator has no real camera; it must not claim a successful resolution switch")
        XCTAssertFalse(app.staticTexts["capture.resolution.applied"].exists)
        screenshot(app, "capture-resolution-settings")
        XCTAssertTrue(app.sliders.firstMatch.exists)
        app.sliders.firstMatch.adjust(toNormalizedSliderPosition: 0.8)
        app.buttons["完成"].tap()
        app.buttons["capture.help"].tap()
        app.buttons["capture.skip"].tap()
        XCTAssertEqual(title.label, "第2步：环绕房间仰视拍摄")
        screenshot(app, "capture-upper-tutorial")
        app.buttons["capture.continue"].tap()
        screenshot(app, "capture-upper-ready")
        app.buttons["capture.help"].tap()
        app.buttons["capture.skip"].tap()
        XCTAssertEqual(title.label, "第3步：环绕房间俯视拍摄")
        screenshot(app, "capture-lower-tutorial")
        app.buttons["capture.skip"].tap()
        XCTAssertEqual(title.label, "第4步：环绕物体补拍细节")
        screenshot(app, "capture-detail-tutorial")
        app.buttons["capture.continue"].tap()
        XCTAssertTrue(app.buttons["capture.help"].waitForExistence(timeout: 5))
        screenshot(app, "capture-detail-ready")
        app.buttons["capture.help"].tap()
        app.buttons["capture.skip"].tap()
        XCTAssertTrue(app.staticTexts["采集已保存"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["0 个素材已保存在手机"].exists)
        screenshot(app, "capture-completed-skips")
        app.buttons["capture.review"].tap()
        XCTAssertTrue(app.staticTexts["本批次没有已保存素材"].waitForExistence(timeout: 5))
        for _ in 0..<4 {
            if app.buttons["上传此批次并训练"].exists { break }
            app.swipeUp()
        }
        XCTAssertTrue(app.buttons["上传此批次并训练"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["上传此批次并训练"].isEnabled)
        app.buttons["完成"].tap()
        app.buttons["返回项目"].tap()
        XCUIDevice.shared.orientation = .portrait
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts[String(name)].waitForExistence(timeout: 10))
        app.staticTexts[String(name)].tap()
        XCTAssertTrue(app.staticTexts["0 个素材 · 跳过 4 个阶段"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["继续未完成的视频采集"].exists)
    }

    func testSwipeDeleteRequiresConfirmationAndPersists() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.buttons["新项目"].waitForExistence(timeout: 15))
        app.buttons["新项目"].tap()
        let field = app.textFields["项目名称"]
        XCTAssertTrue(field.waitForExistence(timeout: 5))
        field.tap()
        let name = "Delete-UI-" + UUID().uuidString.prefix(8)
        field.typeText(String(name))
        app.buttons["创建"].tap()
        app.staticTexts[String(name)].tap()
        for _ in 0..<2 {
            app.buttons["照片采集"].tap()
            XCTAssertTrue(app.buttons["退出采集"].waitForExistence(timeout: 8))
            app.buttons["退出采集"].tap()
            XCTAssertTrue(app.buttons["照片采集"].waitForExistence(timeout: 8))
        }
        let rows = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "capture.session."))
        XCTAssertEqual(rows.count, 2)
        let targetID = rows.element(boundBy: 0).identifier
        let keptID = rows.element(boundBy: 1).identifier
        app.buttons[targetID].swipeLeft()
        XCTAssertTrue(app.buttons["删除"].waitForExistence(timeout: 5))
        XCTAssertEqual(rows.count, 2, "Swiping alone must not delete a batch")
        screenshot(app, "delete-swipe-button")
        app.buttons["删除"].tap()
        let alert = app.alerts["删除采集记录？"]
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        screenshot(app, "delete-confirmation")
        alert.buttons["取消"].tap()
        XCTAssertTrue(app.buttons[targetID].exists)
        XCTAssertEqual(rows.count, 2)
        app.buttons[targetID].swipeLeft()
        app.buttons["删除"].tap()
        XCTAssertTrue(alert.waitForExistence(timeout: 5))
        alert.buttons["删除"].tap()
        XCTAssertTrue(app.buttons[keptID].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons[targetID].exists)
        XCTAssertEqual(rows.count, 1)
        screenshot(app, "delete-completed")
        app.terminate()
        app.launch()
        XCTAssertTrue(app.staticTexts[String(name)].waitForExistence(timeout: 10))
        app.staticTexts[String(name)].tap()
        XCTAssertTrue(app.buttons[keptID].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons[targetID].exists)
        XCTAssertEqual(rows.count, 1)
    }

}
