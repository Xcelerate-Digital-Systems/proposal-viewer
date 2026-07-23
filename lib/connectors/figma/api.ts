// Figma REST API client for fetching file structures and rendering frames.

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export interface FigmaPage {
  id: string;
  name: string;
  frames: FigmaFrame[];
}

export interface FigmaFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
}

export interface FigmaFileInfo {
  name: string;
  lastModified: string;
  version: string;
  pages: FigmaPage[];
}

export interface FigmaRenderedImage {
  nodeId: string;
  imageUrl: string;
}

async function figmaFetch(path: string, token: string): Promise<Response> {
  const res = await fetch(`${FIGMA_API_BASE}${path}`, {
    headers: { 'X-FIGMA-TOKEN': token },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Figma API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/** Fetch file structure — pages and their top-level frames. */
export async function getFileStructure(
  fileKey: string,
  token: string,
): Promise<FigmaFileInfo> {
  const res = await figmaFetch(`/files/${fileKey}?depth=2`, token);
  const data = await res.json();

  const pages: FigmaPage[] = [];
  const document = data.document;

  if (document?.children) {
    for (const page of document.children) {
      if (page.type !== 'CANVAS') continue;

      const frames: FigmaFrame[] = [];
      if (page.children) {
        for (const child of page.children) {
          if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
            frames.push({
              id: child.id,
              name: child.name,
              width: Math.round(child.absoluteBoundingBox?.width ?? 0),
              height: Math.round(child.absoluteBoundingBox?.height ?? 0),
            });
          }
        }
      }

      pages.push({ id: page.id, name: page.name, frames });
    }
  }

  return {
    name: data.name,
    lastModified: data.lastModified,
    version: data.version,
    pages,
  };
}

/** Render specific frames as PNG images. Returns temporary URLs (expire ~30 days). */
export async function renderFrames(
  fileKey: string,
  nodeIds: string[],
  token: string,
  scale: number = 2,
): Promise<FigmaRenderedImage[]> {
  const ids = nodeIds.join(',');
  const res = await figmaFetch(
    `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=${scale}`,
    token,
  );
  const data = await res.json();

  const images: FigmaRenderedImage[] = [];
  if (data.images) {
    for (const [nodeId, imageUrl] of Object.entries(data.images)) {
      if (typeof imageUrl === 'string' && imageUrl) {
        images.push({ nodeId, imageUrl });
      }
    }
  }

  return images;
}

/** Fetch thumbnail images for frames (lower resolution, faster). */
export async function getFrameThumbnails(
  fileKey: string,
  nodeIds: string[],
  token: string,
): Promise<FigmaRenderedImage[]> {
  return renderFrames(fileKey, nodeIds, token, 0.5);
}

/** Validate a Figma personal access token by fetching /me. */
export async function validateToken(token: string): Promise<{
  valid: boolean;
  userId?: string;
  email?: string;
  handle?: string;
}> {
  try {
    const res = await figmaFetch('/me', token);
    const data = await res.json();
    return {
      valid: true,
      userId: data.id,
      email: data.email,
      handle: data.handle,
    };
  } catch {
    return { valid: false };
  }
}
