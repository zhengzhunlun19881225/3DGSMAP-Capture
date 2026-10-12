import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

@main
struct PhotoResolutionTests {
    static func source(width: Int = 4032, height: Int = 3024, orientation: Int = 1) -> Data {
        let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        let colors: [(CGFloat, CGFloat, CGFloat)] = [(1,0,0), (0,1,0), (0,0,1), (1,1,0)]
        for (index, color) in colors.enumerated() {
            context.setFillColor(red: color.0, green: color.1, blue: color.2, alpha: 1)
            context.fill(CGRect(x: (index % 2) * width / 2, y: (index / 2) * height / 2, width: width / 2, height: height / 2))
        }
        let data = NSMutableData()
        let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil)!
        CGImageDestinationAddImage(destination, context.makeImage()!, [
            kCGImagePropertyOrientation: orientation,
            kCGImagePropertyExifDictionary: [kCGImagePropertyExifDateTimeOriginal: "2026:10:12 09:00:00", kCGImagePropertyExifExposureTime: 0.01]
        ] as CFDictionary)
        assert(CGImageDestinationFinalize(destination))
        return data as Data
    }
    static func properties(_ data: Data) -> [String: Any] {
        CGImageSourceCopyPropertiesAtIndex(CGImageSourceCreateWithData(data as CFData, nil)!, 0, nil)! as! [String: Any]
    }
    static func check(_ data: Data, width: Int, height: Int) {
        let props = properties(data)
        assert(props[kCGImagePropertyPixelWidth as String] as? Int == width)
        assert(props[kCGImagePropertyPixelHeight as String] as? Int == height)
        assert(props[kCGImagePropertyOrientation as String] as? Int == 1)
        let exif = props[kCGImagePropertyExifDictionary as String] as! [String: Any]
        assert(exif[kCGImagePropertyExifPixelXDimension as String] as? Int == width)
        assert(exif[kCGImagePropertyExifPixelYDimension as String] as? Int == height)
        assert(exif[kCGImagePropertyExifDateTimeOriginal as String] as? String == "2026:10:12 09:00:00")
        assert(exif[kCGImagePropertyExifExposureTime as String] as? Double == 0.01)
    }
    static func corners(_ data: Data) -> [[UInt8]] {
        let image = CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithData(data as CFData, nil)!, 0, nil)!
        let context = CGContext(data: nil, width: 10, height: 10, bitsPerComponent: 8, bytesPerRow: 40,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: 10, height: 10))
        let bytes = context.data!.assumingMemoryBound(to: UInt8.self)
        return [11, 88].map { pixel in (0..<3).map { bytes[pixel * 4 + $0] } }
    }
    static func main() throws {
        let native = source()
        let fullHD = try PhotoResolutionEncoder.encode(native, resolution: .fullHD)
        let ultraHD = try PhotoResolutionEncoder.encode(native, resolution: .ultraHD)
        check(fullHD, width: 1920, height: 1080)
        check(ultraHD, width: 3840, height: 2160)
        let reversed = try PhotoResolutionEncoder.encode(source(orientation: 3), resolution: .fullHD)
        check(reversed, width: 1920, height: 1080)
        let normalColors = corners(fullHD), reversedColors = corners(reversed)
        for channel in 0..<3 {
            assert(abs(Int(normalColors[0][channel]) - Int(reversedColors[1][channel])) < 12)
            assert(abs(Int(normalColors[1][channel]) - Int(reversedColors[0][channel])) < 12)
        }
        for orientation in [6, 8] {
            check(try PhotoResolutionEncoder.encode(source(orientation: orientation), resolution: .ultraHD), width: 2160, height: 3840)
        }
        do {
            _ = try PhotoResolutionEncoder.encode(source(width: 1920, height: 1080), resolution: .ultraHD)
            fatalError("A 1080p source must never be enlarged into a nominal 4K photo")
        } catch { assert((error as NSError).domain == "CaptureResolution") }
        do {
            _ = try PhotoResolutionEncoder.encode(Data("invalid".utf8), resolution: .fullHD)
            fatalError("Invalid photo must be rejected")
        } catch { assert((error as NSError).domain == "CaptureResolution") }
        print("PASS: actual JPEG dimensions in 4K/1080p, EXIF 1/3/6/8 pixel orientation, exposure metadata, no upscaling, invalid input")
    }
}
