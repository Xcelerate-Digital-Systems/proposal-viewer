// lib/page-operations.ts
// Barrel re-export — all page operation types and functions.
// Consumers can continue importing from '@/lib/page-operations'.

export type {
  EntityType,
  EntityConfig,
  PageType,
  UnifiedPage,
  PageUrlEntry,
  AddPageOpts,
  UpdatePageChanges,
} from './page-types';

export { getEntityConfig, rowToUnifiedPage } from './page-types';

export { getPages, getPageUrls } from './page-queries';

export {
  addPage,
  updatePage,
  deletePage,
  reorderPages,
  replacePdfPage,
  insertPdfPage,
} from './page-mutations';
