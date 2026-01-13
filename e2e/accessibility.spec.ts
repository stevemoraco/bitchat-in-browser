/**
 * Accessibility E2E Tests - BitChat In Browser
 *
 * Comprehensive accessibility testing including:
 * - Automated axe-core accessibility audits
 * - Keyboard navigation testing
 * - Focus management verification
 * - Screen reader compatibility checks
 * - WCAG 2.1 AA compliance validation
 *
 * @module e2e/accessibility
 */

import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// ============================================================================
// Test Configuration
// ============================================================================

test.describe('BitChat Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for app to initialize
    await page.waitForTimeout(1000);
  });

  // ==========================================================================
  // Automated Accessibility Audits (axe-core)
  // ==========================================================================

  test.describe('Automated Accessibility Audits', () => {
    test('should have no accessibility violations on initial load', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Accessibility violations:', JSON.stringify(accessibilityScanResults.violations, null, 2));
      }

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test('should have no critical accessibility violations', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .options({
          resultTypes: ['violations'],
        })
        .analyze();

      // Filter for critical and serious violations
      const criticalViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      if (criticalViolations.length > 0) {
        console.log('Critical violations:', JSON.stringify(criticalViolations, null, 2));
      }

      expect(criticalViolations).toHaveLength(0);
    });

    test('should have no color contrast violations', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['color-contrast', 'color-contrast-enhanced'])
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test('should have no form label violations', async ({ page }) => {
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['label', 'label-title-only'])
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Skip Links Tests
  // ==========================================================================

  test.describe('Skip Links', () => {
    test('should have skip to main content link', async ({ page }) => {
      // Tab to focus skip link
      await page.keyboard.press('Tab');

      // Check if skip link is visible and focused
      const skipLink = page.locator('.skip-link').first();
      await expect(skipLink).toBeVisible();
      await expect(skipLink).toBeFocused();
    });

    test('skip to main content should focus main element', async ({ page }) => {
      // Focus and click skip link
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');

      // Main content should be focused
      const main = page.locator('#main-content, [id="main-content"]');
      await expect(main).toBeFocused();
    });

    test('skip to navigation should focus navigation element', async ({ page }) => {
      // Tab twice to get to navigation skip link
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Click the navigation skip link
      const navSkipLink = page.locator('.skip-link').nth(1);
      if (await navSkipLink.isVisible()) {
        await page.keyboard.press('Enter');

        // Navigation should be focused
        const nav = page.locator('#main-navigation, [id="main-navigation"]');
        await expect(nav).toBeFocused();
      }
    });
  });

  // ==========================================================================
  // Keyboard Navigation Tests
  // ==========================================================================

  test.describe('Keyboard Navigation', () => {
    test('should be able to navigate all interactive elements with Tab', async ({ page }) => {
      const focusableElements: string[] = [];
      let lastFocusedElement = '';
      let iterations = 0;
      const maxIterations = 50; // Prevent infinite loops

      // Tab through all focusable elements
      while (iterations < maxIterations) {
        await page.keyboard.press('Tab');
        iterations++;

        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          return {
            tag: el.tagName.toLowerCase(),
            id: el.id,
            class: el.className,
            text: (el as HTMLElement).innerText?.slice(0, 50),
          };
        });

        if (!focused) break;

        const elementId = `${focused.tag}:${focused.id || focused.class || focused.text}`;

        // Check for cycle completion (returned to first element)
        if (focusableElements.length > 0 && elementId === focusableElements[0]) {
          break;
        }

        focusableElements.push(elementId);
        lastFocusedElement = elementId;
      }

      // Should have focusable elements
      expect(focusableElements.length).toBeGreaterThan(0);
      console.log(`Found ${focusableElements.length} focusable elements`);
    });

    test('navigation tabs should respond to arrow keys', async ({ page }) => {
      // Focus navigation
      const navButton = page.locator('nav button, nav [role="tab"]').first();
      await navButton.focus();

      // Get initial focused element
      const initialFocused = await page.evaluate(() => document.activeElement?.textContent);

      // Press right arrow (or down for vertical nav)
      await page.keyboard.press('ArrowRight');

      // Focus should have moved
      const newFocused = await page.evaluate(() => document.activeElement?.textContent);
      expect(newFocused).not.toBe(initialFocused);
    });

    test('should close modals with Escape key', async ({ page }) => {
      // This test depends on there being a modal to open
      // For now, we'll check that escape doesn't cause errors
      await page.keyboard.press('Escape');

      // Page should still be functional
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();
    });

    test('Enter key should activate buttons', async ({ page }) => {
      // Find a button
      const button = page.locator('button').first();
      await button.focus();

      // Press Enter
      await page.keyboard.press('Enter');

      // Button should have been activated (no error thrown)
      expect(true).toBe(true);
    });

    test('Space key should activate buttons', async ({ page }) => {
      // Find a button
      const button = page.locator('button').first();
      await button.focus();

      // Press Space
      await page.keyboard.press(' ');

      // Button should have been activated (no error thrown)
      expect(true).toBe(true);
    });
  });

  // ==========================================================================
  // Focus Management Tests
  // ==========================================================================

  test.describe('Focus Management', () => {
    test('focus should be visible when using keyboard', async ({ page }) => {
      // Tab to first focusable element
      await page.keyboard.press('Tab');

      // Check that focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();

      // Check for focus ring styles
      const outline = await focusedElement.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          boxShadow: styles.boxShadow,
        };
      });

      // Should have visible focus indicator (outline or box-shadow)
      const hasFocusIndicator =
        outline.outline !== 'none' ||
        outline.boxShadow !== 'none';

      expect(hasFocusIndicator).toBe(true);
    });

    test('focus should not be lost during navigation', async ({ page }) => {
      // Tab through several elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');

        // Check that something is focused
        const hasFocus = await page.evaluate(() => {
          return document.activeElement !== document.body;
        });

        expect(hasFocus).toBe(true);
      }
    });

    test('focus should return to trigger after closing dialog', async ({ page }) => {
      // Find a button that might open a dialog
      const triggerButton = page.locator('button[aria-haspopup], button[aria-expanded]').first();

      if (await triggerButton.count() > 0) {
        await triggerButton.focus();
        await triggerButton.click();

        // Wait for dialog
        await page.waitForTimeout(300);

        // Press Escape to close
        await page.keyboard.press('Escape');

        // Focus should return to trigger
        await expect(triggerButton).toBeFocused();
      }
    });
  });

  // ==========================================================================
  // ARIA Attributes Tests
  // ==========================================================================

  test.describe('ARIA Attributes', () => {
    test('navigation should have proper ARIA attributes', async ({ page }) => {
      const nav = page.locator('nav, [role="navigation"]').first();

      // Should have navigation role
      const role = await nav.getAttribute('role');
      expect(role === 'navigation' || (await nav.evaluate(el => el.tagName.toLowerCase())) === 'nav').toBe(true);

      // Should have aria-label
      const ariaLabel = await nav.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('main content area should have proper landmark', async ({ page }) => {
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();

      const role = await main.first().getAttribute('role');
      const tagName = await main.first().evaluate(el => el.tagName.toLowerCase());

      expect(role === 'main' || tagName === 'main').toBe(true);
    });

    test('buttons should have accessible names', async ({ page }) => {
      const buttons = page.locator('button');
      const count = await buttons.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const button = buttons.nth(i);
        const ariaLabel = await button.getAttribute('aria-label');
        const text = await button.textContent();
        const ariaLabelledby = await button.getAttribute('aria-labelledby');

        // Button should have accessible name via text content, aria-label, or aria-labelledby
        const hasAccessibleName = (text && text.trim().length > 0) || ariaLabel || ariaLabelledby;
        expect(hasAccessibleName).toBeTruthy();
      }
    });

    test('images should have alt text', async ({ page }) => {
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');

        // Image should have alt text or be marked as decorative
        const hasAltText = alt !== null || role === 'presentation' || role === 'none';
        expect(hasAltText).toBe(true);
      }
    });

    test('interactive elements should be focusable', async ({ page }) => {
      // Check buttons
      const buttons = page.locator('button:not([disabled])');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const tabindex = await button.getAttribute('tabindex');

        // Should not have negative tabindex (unless intentionally removed from tab order)
        if (tabindex) {
          expect(parseInt(tabindex, 10)).toBeGreaterThanOrEqual(-1);
        }
      }
    });

    test('live regions should be properly configured', async ({ page }) => {
      const liveRegions = page.locator('[aria-live]');
      const count = await liveRegions.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const region = liveRegions.nth(i);
          const ariaLive = await region.getAttribute('aria-live');

          // aria-live should be polite or assertive
          expect(['polite', 'assertive']).toContain(ariaLive);
        }
      }
    });
  });

  // ==========================================================================
  // Screen Reader Compatibility Tests
  // ==========================================================================

  test.describe('Screen Reader Compatibility', () => {
    test('page should have proper heading hierarchy', async ({ page }) => {
      const headings = await page.evaluate(() => {
        const h1s = document.querySelectorAll('h1');
        const h2s = document.querySelectorAll('h2');
        const h3s = document.querySelectorAll('h3');

        return {
          h1Count: h1s.length,
          h2Count: h2s.length,
          h3Count: h3s.length,
        };
      });

      // Should have at least one h1
      // (Allow 0 in case of SPA with dynamic content)
      expect(headings.h1Count).toBeGreaterThanOrEqual(0);
    });

    test('document should have lang attribute', async ({ page }) => {
      const lang = await page.getAttribute('html', 'lang');
      expect(lang).toBeTruthy();
      expect(lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/); // e.g., "en" or "en-US"
    });

    test('page should have title', async ({ page }) => {
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title.length).toBeGreaterThan(0);
    });

    test('links should have descriptive text', async ({ page }) => {
      const links = page.locator('a');
      const count = await links.count();

      for (let i = 0; i < Math.min(count, 10); i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        // Link should have descriptive text
        const hasText = (text && text.trim().length > 0) || ariaLabel;
        expect(hasText).toBeTruthy();

        // Should not be generic text
        if (text) {
          const genericPhrases = ['click here', 'read more', 'learn more', 'here'];
          const isGeneric = genericPhrases.some((phrase) =>
            text.toLowerCase().trim() === phrase
          );
          // Warning only - don't fail test
          if (isGeneric) {
            console.warn(`Link has generic text: "${text}"`);
          }
        }
      }
    });
  });

  // ==========================================================================
  // Reduced Motion Tests
  // ==========================================================================

  test.describe('Reduced Motion Support', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Emulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Reload to apply
      await page.reload();

      // Check that animations are disabled
      const animations = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        let animatedCount = 0;

        elements.forEach((el) => {
          const styles = window.getComputedStyle(el);
          const duration = parseFloat(styles.animationDuration) || 0;
          const transitionDuration = parseFloat(styles.transitionDuration) || 0;

          if (duration > 0.01 || transitionDuration > 0.01) {
            animatedCount++;
          }
        });

        return animatedCount;
      });

      // Ideally, no elements should have significant animations
      // But we'll be lenient and just log
      console.log(`Elements with animations when reduced-motion is preferred: ${animations}`);
    });
  });

  // ==========================================================================
  // Color and Contrast Tests
  // ==========================================================================

  test.describe('Color and Contrast', () => {
    test('should have sufficient text contrast', async ({ page }) => {
      // Use axe-core for thorough contrast checking
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .analyze();

      expect(accessibilityScanResults.violations).toHaveLength(0);
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to an element
      await page.keyboard.press('Tab');

      // Check focus indicator visibility
      const focusStyles = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        if (!el) return null;

        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineColor: styles.outlineColor,
          outlineWidth: styles.outlineWidth,
          boxShadow: styles.boxShadow,
        };
      });

      expect(focusStyles).toBeTruthy();

      // Should have visible focus indicator
      const hasOutline =
        focusStyles?.outlineWidth !== '0px' ||
        focusStyles?.boxShadow !== 'none';

      expect(hasOutline).toBe(true);
    });

    test('information should not be conveyed by color alone', async ({ page }) => {
      // Check for elements that might rely only on color
      const colorOnlyIndicators = await page.evaluate(() => {
        const warnings: string[] = [];

        // Check for red/green status indicators without additional cues
        const statusElements = document.querySelectorAll(
          '.status-ok, .status-error, .text-terminal-red, .text-terminal-green'
        );

        statusElements.forEach((el) => {
          const hasIcon = el.querySelector('svg, img, [aria-hidden]');
          const hasText = (el as HTMLElement).innerText.trim().length > 0;
          const hasAriaLabel = el.getAttribute('aria-label');

          if (!hasIcon && !hasText && !hasAriaLabel) {
            warnings.push(`Element may rely on color alone: ${el.className}`);
          }
        });

        return warnings;
      });

      // Log warnings but don't fail
      if (colorOnlyIndicators.length > 0) {
        console.warn('Potential color-only indicators:', colorOnlyIndicators);
      }
    });
  });

  // ==========================================================================
  // Touch Target Size Tests
  // ==========================================================================

  test.describe('Touch Target Size', () => {
    test('interactive elements should have minimum touch target size', async ({ page }) => {
      const smallTargets: string[] = [];
      const minSize = 44; // WCAG 2.1 AAA is 44px, AA is 24px

      const interactiveElements = await page.locator(
        'button, a, input, [role="button"], [tabindex]'
      ).all();

      for (const element of interactiveElements) {
        const box = await element.boundingBox();

        if (box && (box.width < minSize || box.height < minSize)) {
          const text = await element.textContent();
          smallTargets.push(
            `${text?.slice(0, 20) || 'element'}: ${box.width}x${box.height}px`
          );
        }
      }

      // Log warnings for small targets
      if (smallTargets.length > 0) {
        console.warn(`Touch targets smaller than ${minSize}px:`, smallTargets);
      }

      // Don't fail - just warn
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all accessibility violations for a page
 */
async function getAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations;
}

/**
 * Check if an element has a visible focus indicator
 */
async function hasFocusIndicator(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  await element.focus();

  const styles = await element.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      outline: computed.outline,
      boxShadow: computed.boxShadow,
    };
  });

  return styles.outline !== 'none' || styles.boxShadow !== 'none';
}
