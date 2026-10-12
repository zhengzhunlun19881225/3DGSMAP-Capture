import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

/// Normalize EXIF orientation, crop to 16:9 and downsample native camera pixels.
/// A smaller source is rejected instead of being enlarged into a nominal 4K file.
enum PhotoResolutionEncoder {
    static func encode(_ data: Data, resolution: CaptureResolution) throws -> Data {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              var properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
              let rawWidth = properties[kCGImagePropertyPixelWidth as String] as? Int,
              let rawHeight = properties[kCGImagePropertyPixelHeight as String] as? Int,
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: max(rawWidth, rawHeight)
              ] as CFDictionary) else { throw failure("无法读取相机照片") }
        let portrait = image.width < image.height
        let width = portrait ? resolution.height : resolution.width
        let height = portrait ? resolution.width : resolution.height
        guard image.width >= width, image.height >= height else {
            throw failure("相机照片像素不足，无法保存为 \(resolution.title)，请切换 1080p 后重试")
        }
        let scale = min(Double(image.width) / Double(width), Double(image.height) / Double(height))
        let cropWidth = Double(width) * scale, cropHeight = Double(height) * scale
        let rect = CGRect(x: (Double(image.width) - cropWidth) / 2,
                          y: (Double(image.height) - cropHeight) / 2, width: cropWidth, height: cropHeight)
        guard let cropped = image.cropping(to: rect.integral),
              let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                      bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                      bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
            throw failure("无法处理照片分辨率")
        }
        context.interpolationQuality = .high
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let result = context.makeImage() else { throw failure("无法生成照片") }
        properties[kCGImagePropertyOrientation as String] = 1
        properties[kCGImagePropertyPixelWidth as String] = width
        properties[kCGImagePropertyPixelHeight as String] = height
        var exif = properties[kCGImagePropertyExifDictionary as String] as? [String: Any] ?? [:]
        exif[kCGImagePropertyExifPixelXDimension as String] = width
        exif[kCGImagePropertyExifPixelYDimension as String] = height
        properties[kCGImagePropertyExifDictionary as String] = exif
        var tiff = properties[kCGImagePropertyTIFFDictionary as String] as? [String: Any] ?? [:]
        tiff[kCGImagePropertyTIFFOrientation as String] = 1
        properties[kCGImagePropertyTIFFDictionary as String] = tiff
        properties[kCGImageDestinationLossyCompressionQuality as String] = 0.95
        let output = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(output, UTType.jpeg.identifier as CFString, 1, nil) else {
            throw failure("无法创建 JPEG 文件")
        }
        CGImageDestinationAddImage(destination, result, properties as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw failure("JPEG 写入失败") }
        return output as Data
    }

    private static func failure(_ message: String) -> NSError {
        NSError(domain: "CaptureResolution", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }
}
