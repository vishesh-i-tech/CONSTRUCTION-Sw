/**
 * Compresses an image file or base64 data URL to a max dimension of 1280px
 * and file size <= 200KB to protect IndexedDB quota and avoid mobile memory pressure.
 */
export async function compressImage(
  source: File | string,
  maxDimension = 1280,
  maxSizeBytes = 200 * 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const process = () => {
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        if (typeof source === 'string') return resolve(source);
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = reject;
        reader.readAsDataURL(source as File);
        return;
      }

      // Downscale if greater than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (typeof source === 'string') return resolve(source);
        return resolve('');
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively adjust JPEG quality to fit under maxSizeBytes
      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Estimate byte size from base64 string
      let approxBytes = Math.round((dataUrl.length * 3) / 4);

      while (approxBytes > maxSizeBytes && quality > 0.35) {
        quality -= 0.15;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        approxBytes = Math.round((dataUrl.length * 3) / 4);
      }

      resolve(dataUrl);
    };

    img.onload = process;
    img.onerror = () => {
      if (typeof source === 'string') {
        resolve(source);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = reject;
        reader.readAsDataURL(source as File);
      }
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = (e.target?.result as string) || '';
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}
