import React, {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export interface MathFieldAdapterRef {
  focus: () => void;
  blur: () => void;
  setValue: (value: string) => void;
}

interface MathFieldAdapterProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onPointerDown?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/* eslint-disable @typescript-eslint/no-namespace */
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "virtual-keyboard-mode"?: string;
          value?: string;
          readOnly?: boolean;
          "read-only"?: string;
        },
        HTMLElement
      >;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Track if the dynamic import has already resolved across all component instances
let globalMathLiveLoaded = false;

export const MathFieldAdapter = React.forwardRef<
  MathFieldAdapterRef,
  MathFieldAdapterProps
>(
  (
    {
      value,
      onChange,
      readOnly = false,
      onFocus,
      onBlur,
      onKeyDown,
      onPointerDown,
      className,
      style,
    },
    forwardRef
  ) => {
    const internalRef = useRef<any>(null);
    const lastEmittedValue = useRef<string | null>(null);
    const [mathliveLoaded, setMathliveLoaded] = useState(globalMathLiveLoaded);

    // Dynamic loading of mathlive to prevent SSR crashes in next.js/vinxi environments
    useEffect(() => {
      let isMounted = true;
      if (typeof window !== "undefined" && !globalMathLiveLoaded) {
        const win = window as any;
        // Pre-emptively intercept the module-level font prefetch before the import finishes evaluating
        if (!win.MathfieldElement || !win.MathfieldElement.fontsDirectory) {
          let _mathfieldElement: any = { fontsDirectory: "/mathlive/fonts/" };
          try {
            Object.defineProperty(win, "MathfieldElement", {
              get() {
                return _mathfieldElement;
              },
              set(val) {
                _mathfieldElement = val;
                if (val) {
                  val.fontsDirectory = "/mathlive/fonts/";
                }
              },
              configurable: true,
            });
          } catch (e) {
            console.warn(
              "Could not define MathfieldElement prefetch wrapper",
              e
            );
          }
        }

        import("mathlive").then((ml) => {
          if (isMounted) {
            ml.MathfieldElement.fontsDirectory = "/mathlive/fonts/";
            globalMathLiveLoaded = true;
            setMathliveLoaded(true);
          }
        });
      }
      return () => {
        isMounted = false;
      };
    }, []);

    // Synchronize readOnly state to raw custom element properties
    useLayoutEffect(() => {
      if (mathliveLoaded && internalRef.current) {
        internalRef.current.readOnly = readOnly;
      }
    }, [readOnly, mathliveLoaded]);

    // Expose clean imperative handles (focus, blur, value sync)
    useImperativeHandle(forwardRef, () => ({
      focus: () => {
        if (internalRef.current) {
          internalRef.current.readOnly = false;
          internalRef.current.focus();
        }
      },
      blur: () => {
        if (internalRef.current) {
          internalRef.current.blur();
        }
      },
      setValue: (val: string) => {
        if (internalRef.current) {
          internalRef.current.value = val;
        }
      },
    }));

    // Use a ref for onChange to avoid re-binding event listeners on every render
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Listen to native input changes on web component and bubble up onChange callback
    useEffect(() => {
      const el = internalRef.current;
      if (!el || !mathliveLoaded) {
        return;
      }

      const handleInput = (e: Event) => {
        const val = (e.target as any).value;
        lastEmittedValue.current = val;
        if (onChangeRef.current) {
          onChangeRef.current(val);
        }
      };

      const handleFocusOut = () => {
        setTimeout(() => {
          if (el && el.shadowRoot && document.activeElement !== el) {
            // When math-field loses focus, MathLive visually hides the menu but leaves its internal state open.
            // Force a clean reset by programmatically clicking its Scrim background,
            // but only if focus actually left the math-field (not just a temporary blur from clicking the menu toggle).
            const menuToggle = el.shadowRoot.querySelector(
              "[part='menu-toggle']"
            );
            if (menuToggle) {
              const scrim = menuToggle.querySelector(
                "div[role='presentation']"
              );
              if (scrim) {
                scrim.dispatchEvent(
                  new MouseEvent("click", { bubbles: true, cancelable: true })
                );
              }
            }
          }
        }, 100);
      };

      el.addEventListener("input", handleInput);
      el.addEventListener("focusout", handleFocusOut);

      return () => {
        if (el) {
          el.removeEventListener("input", handleInput);
          el.removeEventListener("focusout", handleFocusOut);
        }
      };
    }, [mathliveLoaded]);

    // Clean blur on unmount to release static MathLive focus references without running on every render
    useEffect(() => {
      const el = internalRef.current;
      return () => {
        if (el) {
          try {
            el.blur();
          } catch (e) {
            // Ignore
          }
        }
      };
    }, [mathliveLoaded]);

    // Sync value changes from parent components
    useEffect(() => {
      if (mathliveLoaded && internalRef.current) {
        // If the incoming value is exactly what MathLive just emitted, do not force an update.
        // This prevents MathLive from destroying and rebuilding its internal shadow DOM (which breaks menus).
        if (value === lastEmittedValue.current) {
          return;
        }

        if (internalRef.current.value !== value) {
          internalRef.current.value = value;
        }
      }
    }, [value, mathliveLoaded]);

    if (!mathliveLoaded) {
      return (
        <span
          className="animate-pulse text-slate-400 select-none"
          style={{
            ...style,
            fontStyle: "italic",
            fontSize: "0.875rem",
          }}
        >
          Loading math editor...
        </span>
      );
    }

    const handlePointerDown = () => {
      if (internalRef.current) {
        internalRef.current.readOnly = false;
      }
      if (onPointerDown) {
        onPointerDown();
      }
    };

    return (
      <math-field
        ref={internalRef}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        onPointerDown={handlePointerDown}
        className={className}
        style={style}
      />
    );
  }
);

MathFieldAdapter.displayName = "MathFieldAdapter";
