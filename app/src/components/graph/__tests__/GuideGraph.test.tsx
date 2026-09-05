// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideGraph } from "../GuideGraph";
import { WalkthroughGraph } from "../WalkthroughGraph";
import type * as XyflowReact from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";

// Mock @xyflow/react to inspect the props passed to Controls and avoid DOM layout measurements in jsdom
const mockControls = vi.fn();
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof XyflowReact>("@xyflow/react");
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    ReactFlow: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="react-flow">{children}</div>
    ),
    Panel: ({
      children,
      position,
    }: {
      children: React.ReactNode;
      position: string;
    }) => <div data-testid={`panel-${position}`}>{children}</div>,
    Controls: (props: Record<string, unknown>) => {
      mockControls(props);
      return <div data-testid="react-flow-controls" />;
    },
    useReactFlow: () => ({
      fitView: vi.fn(),
    }),
    useNodesState: () => [[], vi.fn(), vi.fn()],
    useEdgesState: () => [[], vi.fn(), vi.fn()],
  };
});

vi.mock("@/lib/themeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("../useGraphLayout", () => ({
  useGraphLayout: () => ({
    nodes: [],
    edges: [],
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    isLayoutSettled: true,
  }),
}));

const mockWalkthroughData: Walkthrough = {
  nodes: [
    {
      id: "node-1",
      slug: "calc-intro",
      title: "Calculus Introduction",
      level: 0,
      summary: null,
      duration_minutes: 10,
      tags: [],
    },
  ],
  edges: [],
};

describe("GuideGraph Controls & Fullscreen", () => {
  afterEach(() => {
    cleanup();
  });
  it("hides the Fit View control when showFitView is false", () => {
    mockControls.mockClear();

    render(
      <GuideGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        nodeType="walkthroughNode"
        nodeTypes={{}}
        showFitView={false}
      />
    );

    expect(mockControls).toHaveBeenCalledWith(
      expect.objectContaining({
        showFitView: false,
        showInteractive: false,
        position: "bottom-right",
      })
    );
  });

  it("preserves the Fit View control by default", () => {
    mockControls.mockClear();

    render(
      <GuideGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        nodeType="walkthroughNode"
        nodeTypes={{}}
      />
    );

    expect(mockControls).toHaveBeenCalledWith(
      expect.objectContaining({
        showFitView: true,
        showInteractive: false,
        position: "bottom-right",
      })
    );
  });

  it("configures WalkthroughGraph to hide the Fit View control", () => {
    mockControls.mockClear();

    render(
      <WalkthroughGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        selectedGuide="calc-intro"
        onSelectGuide={vi.fn()}
      />
    );

    expect(mockControls).toHaveBeenCalledWith(
      expect.objectContaining({
        showFitView: false,
      })
    );
  });

  it("renders the top-right fullscreen button with 'Enter Fullscreen' title when not in fullscreen", () => {
    const onToggleFullscreen = vi.fn();

    render(
      <GuideGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        nodeType="walkthroughNode"
        nodeTypes={{}}
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
      />
    );

    const button = screen.getByRole("button", { name: /enter fullscreen/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("renders the top-right fullscreen button with 'Exit Fullscreen' title when in fullscreen", () => {
    const onToggleFullscreen = vi.fn();

    render(
      <GuideGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        nodeType="walkthroughNode"
        nodeTypes={{}}
        isFullscreen={true}
        onToggleFullscreen={onToggleFullscreen}
      />
    );

    const button = screen.getByRole("button", { name: /exit fullscreen/i });
    expect(button).toBeDefined();

    fireEvent.click(button);
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("does not render the top-right fullscreen button if onToggleFullscreen is not provided", () => {
    render(
      <GuideGraph
        walkthroughData={mockWalkthroughData}
        targetSlug="calc-intro"
        hoveredGuide={null}
        onHoverGuide={vi.fn()}
        nodeType="walkthroughNode"
        nodeTypes={{}}
        isFullscreen={false}
      />
    );

    expect(screen.queryByRole("button", { name: /fullscreen/i })).toBeNull();
  });
});
