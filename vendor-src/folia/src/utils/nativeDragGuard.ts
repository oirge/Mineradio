// src/utils/nativeDragGuard.ts
// Stops the browser's native drag-and-drop from taking over a pointer gesture that was meant for
// a slider. Issue #394: once something outside a text field is selected (a cover image, a label,
// Ctrl+A), pressing on the progress bar or a settings slider and dragging starts a native drag of
// the selection - the page content gets pulled out like on a web page, the slider receives
// pointercancel and stays dead until the selection collapses (clicking a text box does that).
//
// Nothing in this app is a native HTML5 drag source: every in-app drag (queue reorder, grid pan,
// the bottom bar positioner, Reorder.Item) runs on pointer events, and the drop zones only accept
// files dragged in from the OS, which never fire `dragstart` inside the page. So the one guard
// below is enough, and it is deliberately a deny-by-default filter with an opt-in escape hatch.

/** Elements whose native drag/selection behaviour must keep working. */
const NATIVE_DRAG_ALLOWED_SELECTOR = [
    // Only text-entry inputs. A range input is the very thing this guard protects, and it is the
    // `dragstart` target in the #394 repro, so a bare `input` here would let the bug straight through.
    'input:not([type="range"],[type="checkbox"],[type="radio"],[type="button"],[type="submit"],[type="reset"],[type="image"],[type="file"],[type="color"])',
    'textarea',
    '[contenteditable]:not([contenteditable="false"])',
    '[draggable="true"]',
    '[data-native-drag="allow"]',
].join(',');

/** Drag sources arrive as Elements, or as Text nodes when a text selection is being dragged. */
const resolveDragSourceElement = (target: EventTarget | null): Element | null => {
    if (target instanceof Element) {
        return target;
    }
    if (target instanceof Node) {
        return target.parentElement;
    }
    return null;
};

/** True when a `dragstart` on this target is a drag the app did not ask for. */
export const isUnwantedNativeDrag = (target: EventTarget | null): boolean => {
    const source = resolveDragSourceElement(target);
    if (!source) {
        return true;
    }
    return source.closest(NATIVE_DRAG_ALLOWED_SELECTOR) === null;
};

/** Marks a document that already has the guard, so repeat installs (HMR re-evaluating bootstrap) do not stack listeners. */
const INSTALLED_KEY = Symbol.for('folia.nativeDragGuard.uninstall');

type GuardedDocument = Document & { [INSTALLED_KEY]?: () => void };

/**
 * Installs the capture-phase `dragstart` filter on the given document. Idempotent per document
 * (a second call returns the existing uninstall function); returns an uninstall function (used by
 * tests and probes).
 */
export const installNativeDragGuard = (doc: Document = document): (() => void) => {
    const guarded = doc as GuardedDocument;
    const existing = guarded[INSTALLED_KEY];
    if (existing) {
        return existing;
    }
    const handleDragStart = (event: DragEvent) => {
        // A document-level listener sees `event.target` retargeted to the shadow host, so a mod
        // rendered into a shadow root (Folium) would look like a bare div. The composed path's first
        // entry is the real drag source, or the host again for a closed root.
        const source = event.composedPath?.()[0] ?? event.target;
        if (isUnwantedNativeDrag(source)) {
            event.preventDefault();
        }
    };
    doc.addEventListener('dragstart', handleDragStart, true);
    const uninstall = () => {
        doc.removeEventListener('dragstart', handleDragStart, true);
        delete guarded[INSTALLED_KEY];
    };
    guarded[INSTALLED_KEY] = uninstall;
    return uninstall;
};
