// Parse Figma URLs into file_key and optional node_id.
//
// Supported formats:
//   https://www.figma.com/file/ABC123/FileName
//   https://www.figma.com/design/ABC123/FileName
//   https://www.figma.com/design/ABC123/FileName?node-id=1-2
//   https://www.figma.com/design/ABC123/FileName/FrameName?node-id=1:2
//   https://www.figma.com/proto/ABC123/...
//   https://figma.com/file/ABC123/...

export interface FigmaUrlParts {
  fileKey: string;
  nodeId: string | null;
}

const FIGMA_URL_REGEX = /figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/;

export function parseFigmaUrl(url: string): FigmaUrlParts | null {
  const match = url.match(FIGMA_URL_REGEX);
  if (!match) return null;

  const fileKey = match[1];

  let nodeId: string | null = null;
  try {
    const parsed = new URL(url);
    const rawNodeId = parsed.searchParams.get('node-id');
    if (rawNodeId) {
      // Figma API expects colon-separated node IDs, but URLs use hyphens
      nodeId = rawNodeId.replace(/-/g, ':');
    }
  } catch {
    // Not a valid URL, but we still extracted the file key
  }

  return { fileKey, nodeId };
}
