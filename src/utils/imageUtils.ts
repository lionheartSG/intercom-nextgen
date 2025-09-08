/**
 * Image compression and processing utilities
 */

export interface ImageCompressionOptions {
  maxWidth?: number;
  quality?: number;
}

/**
 * Compresses and resizes an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns Promise that resolves to base64 data URL
 */
export const compressImage = (
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> => {
  const { maxWidth = 200, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    if (!ctx) {
      reject(new Error("Could not get canvas context"));
      return;
    }

    img.onload = () => {
      try {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = (width * maxWidth) / height;
            height = maxWidth;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Clear canvas with transparent background
        ctx.clearRect(0, 0, width, height);

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Use PNG for better quality and transparency support
        const compressedDataUrl = canvas.toDataURL("image/png", quality);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Validates an image file
 * @param file - The file to validate
 * @param maxSizeInMB - Maximum file size in MB
 * @returns Validation result with error message if invalid
 */
export const validateImageFile = (
  file: File,
  maxSizeInMB: number = 2
): { isValid: boolean; error?: string } => {
  // Validate file type
  if (!file.type.startsWith("image/")) {
    return {
      isValid: false,
      error: "Please select a valid image file",
    };
  }

  // Validate file size
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      error: `File size must be less than ${maxSizeInMB}MB`,
    };
  }

  return { isValid: true };
};

/**
 * Handles image upload with validation and compression
 * @param event - File input change event
 * @param onSuccess - Callback with compressed image data URL
 * @param onError - Callback with error message
 * @param options - Compression options
 */
export const handleImageUpload = (
  event: React.ChangeEvent<HTMLInputElement>,
  onSuccess: (dataUrl: string) => void,
  onError: (error: string) => void,
  options: ImageCompressionOptions = {}
) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file
  const validation = validateImageFile(file, 2);
  if (!validation.isValid) {
    onError(validation.error!);
    return;
  }

  // Compress and process image
  compressImage(file, options)
    .then((compressedDataUrl) => {
      onSuccess(compressedDataUrl);
    })
    .catch((error) => {
      console.error("Error compressing image:", error);
      onError("Error processing image. Please try again.");
    });
};
