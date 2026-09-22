import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    fputs("Usage: remove_bg <input_jpg> <output_png>\n", stderr)
    exit(1)
}

let inputPath = args[1]
let outputPath = args[2]

let inputURL = URL(fileURLWithPath: inputPath)
let handler = VNImageRequestHandler(url: inputURL, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()

do {
    try handler.perform([request])
    guard let result = request.results?.first else {
        fputs("No foreground found\n", stderr)
        exit(2)
    }
    
    let maskedPixelBuffer = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: false
    )
    
    let ciImage = CIImage(cvPixelBuffer: maskedPixelBuffer)
    let context = CIContext(options: [CIContextOption.useSoftwareRenderer: false])
    guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
        fputs("Failed to create CGImage\n", stderr)
        exit(3)
    }
    
    let rep = NSBitmapImageRep(cgImage: cgImage)
    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        fputs("Failed to encode PNG\n", stderr)
        exit(4)
    }
    
    try pngData.write(to: URL(fileURLWithPath: outputPath))
    exit(0)
} catch {
    fputs("Error: \(error.localizedDescription)\n", stderr)
    exit(5)
}
