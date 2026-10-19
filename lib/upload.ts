// Uploads a file to a Storage signed upload URL with a plain PUT. Uses XMLHttpRequest because
// fetch cannot report upload progress.
export function putFile(url: string, file: Blob, onProgress: (fraction: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "image/jpeg");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("upload network error"));
    xhr.ontimeout = () => reject(new Error("upload timeout"));
    xhr.timeout = 120_000;
    xhr.send(file);
  });
}
