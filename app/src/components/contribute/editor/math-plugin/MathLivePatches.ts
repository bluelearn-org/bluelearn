/**
 * This file contains global patches and workarounds for MathLive Web Components.
 * Because MathLive uses Singletons and global DOM elements (like the Scrim),
 * integrating it with ephemeral React components (like Radix Popovers) causes crashes.
 *
 * These patches MUST be applied once at editor initialization.
 */

export function applyMathLivePatches() {
  if (typeof window === "undefined") return;

  applyShowPopoverPatch();
  applySubmenuCrashInterceptor();
}

function applyShowPopoverPatch() {
  if (
    typeof (HTMLElement.prototype as any).showPopover !== "function" ||
    (HTMLElement.prototype as any)._patchedForMathLive
  ) {
    return;
  }

  const originalShowPopover = HTMLElement.prototype.showPopover;
  HTMLElement.prototype.showPopover = function () {
    try {
      if (!this.isConnected) {
        // If MathLive's singleton menu is disconnected (because its parent math-field was unmounted),
        // we must rescue it and attach it to the currently active math-field.
        const activeMathField =
          document.querySelector("math-field:focus-within") ||
          document.querySelector("math-field");

        if (activeMathField && activeMathField.shadowRoot) {
          const toggle = activeMathField.shadowRoot.querySelector(
            "[part='menu-toggle']"
          );
          const container = toggle || activeMathField.shadowRoot;

          const parent = this.parentNode;
          if (parent && !parent.isConnected) {
            container.appendChild(parent);
          } else {
            container.appendChild(this);
          }

          if (!(this as any).isConnected) return;
        } else {
          return;
        }
      }
      originalShowPopover.call(this);
    } catch (e) {
      console.warn("[MathLive] Suppressed showPopover error:", e);
    }
  };
  (HTMLElement.prototype as any)._patchedForMathLive = true;
}

function applySubmenuCrashInterceptor() {
  if ((window as any)._mathLiveInterceptorApplied) return;

  const preventCrash = (e: Event) => {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    for (const node of path) {
      if (node instanceof HTMLElement) {
        if (
          node.tagName.toUpperCase() === "LI" &&
          node.classList.contains("is-submenu-open")
        ) {
          // MathLive crashes if it processes a click on an already-open submenu.
          // By stopping it in the capture phase, MathLive never receives the event.
          e.stopPropagation();
          e.preventDefault();
          return;
        }
      }
    }
  };

  window.addEventListener("click", preventCrash, true);
  window.addEventListener("pointerdown", preventCrash, true);
  window.addEventListener("pointerup", preventCrash, true);
  window.addEventListener("mousedown", preventCrash, true);
  window.addEventListener("mouseup", preventCrash, true);

  (window as any)._mathLiveInterceptorApplied = true;
}
