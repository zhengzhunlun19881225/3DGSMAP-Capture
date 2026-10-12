"""Generate a small dependency-free Xcode iOS App project using only stdlib."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parent


def uid(name):
    return hashlib.sha256(name.encode()).hexdigest()[:24].upper()


def generate():
    files = sorted((ROOT / 'GSMapCapture').glob('*.swift'))
    objects = []
    def add(name, text):
        objects.append(f'\t\t{uid(name)} = {{ {text} }};')
    for file in files:
        add(file.name, f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {file.name}; sourceTree = "<group>";')
        add('build-' + file.name, f'isa = PBXBuildFile; fileRef = {uid(file.name)};')
    add('Info.plist', 'isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>";')
    add('source-group', 'isa = PBXGroup; path = GSMapCapture; sourceTree = "<group>"; children = (' + ','.join(uid(f.name) for f in files) + ',' + uid('Info.plist') + ');')
    add('product', 'isa = PBXFileReference; explicitFileType = wrapper.application; path = GSMapCapture.app; sourceTree = BUILT_PRODUCTS_DIR;')
    add('product-group', f'isa = PBXGroup; name = Products; sourceTree = "<group>"; children = ({uid("product")});')
    add('main-group', f'isa = PBXGroup; sourceTree = "<group>"; children = ({uid("source-group")},{uid("product-group")});')
    add('sources', 'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (' + ','.join(uid('build-' + f.name) for f in files) + '); runOnlyForDeploymentPostprocessing = 0;')
    add('resources', 'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
    add('frameworks', 'isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
    target_configs, project_configs = [], []
    for config in ('Debug', 'Release'):
        add('project-' + config, f'isa = XCBuildConfiguration; name = {config}; buildSettings = {{ SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0; SWIFT_OPTIMIZATION_LEVEL = "' + ('-Onone' if config == 'Debug' else '-O') + '"; };')
        project_configs.append(uid('project-' + config))
        add('target-' + config, f'isa = XCBuildConfiguration; name = {config}; buildSettings = {{ PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.example.GSMapCapture; INFOPLIST_FILE = GSMapCapture/Info.plist; GENERATE_INFOPLIST_FILE = NO; CODE_SIGN_STYLE = Automatic; TARGETED_DEVICE_FAMILY = 1; SWIFT_VERSION = 5.0; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SUPPORTED_PLATFORMS = "iphoneos iphonesimulator"; ENABLE_USER_SCRIPT_SANDBOXING = YES; }};')
        target_configs.append(uid('target-' + config))
    add('project-configs', 'isa = XCConfigurationList; buildConfigurations = (' + ','.join(project_configs) + '); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
    add('target-configs', 'isa = XCConfigurationList; buildConfigurations = (' + ','.join(target_configs) + '); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
    add('target', f'isa = PBXNativeTarget; name = GSMapCapture; productName = GSMapCapture; productReference = {uid("product")}; productType = "com.apple.product-type.application"; buildConfigurationList = {uid("target-configs")}; buildPhases = ({uid("sources")},{uid("frameworks")},{uid("resources")}); buildRules = (); dependencies = ();')
    add('project', f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 1600; }}; buildConfigurationList = {uid("project-configs")}; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh_CN; knownRegions = (zh_CN,en,Base); mainGroup = {uid("main-group")}; productRefGroup = {uid("product-group")}; projectDirPath = ""; projectRoot = ""; targets = ({uid("target")});')
    output = ROOT / 'GSMapCapture.xcodeproj'
    output.mkdir(exist_ok=True)
    (output / 'project.pbxproj').write_text('// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {};\n\tobjectVersion = 56;\n\tobjects = {\n' + '\n'.join(objects) + f'\n\t}};\n\trootObject = {uid("project")};\n}}\n', encoding='utf-8')
    print(output)


if __name__ == '__main__':
    generate()
