/**
 * Reads an image file and returns a resized data URL so uploaded photos stay
 * small enough to store in the database (and don't blow up the API body size).
 */
export function readImageAsDataUrl(
  file: File,
  maxDimension = 1920,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();

      img.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.width, img.height),
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Keep PNG for small/transparent images (e.g. avatars), JPEG otherwise
        const outputType =
          file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(outputType, 0.82));
      };

      img.onerror = () => reject(new Error("Could not read image."));
      img.src = dataUrl;
    };

    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
