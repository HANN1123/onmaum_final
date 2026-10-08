/** Document Picture-in-Picture 지원 여부 (Chrome/Edge 116+). */
export function isDocumentPipSupported(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}
