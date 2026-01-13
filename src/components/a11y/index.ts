/**
 * Accessibility Components - BitChat In Browser
 *
 * WCAG 2.1 AA compliant accessibility components:
 * - SkipLinks: Skip navigation for keyboard users
 * - Announcer: Live region for screen reader announcements
 *
 * @module components/a11y
 */

export {
  SkipLinks,
  SKIP_LINK_TARGETS,
  prepareSkipLinkTarget,
} from './SkipLinks';

export {
  AnnouncerProvider,
  StandaloneAnnouncer,
  useAnnouncer,
  AnnouncementMessages,
  type Announcement,
  type AnnouncementPriority,
  type AnnouncerContextValue,
} from './Announcer';
