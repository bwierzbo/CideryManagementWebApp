import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import PressingPage from "../page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

// Mock UI components
jest.mock("@/components/navbar", () => ({
  Navbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock("@/components/pressing", () => ({
  PressRunCompletion: () => (
    <div data-testid="press-run-completion">PressRunCompletion</div>
  ),
}));

jest.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: () => <div data-testid="confirm-dialog">ConfirmDialog</div>,
}));

jest.mock("@/components/ui/toast-provider", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock tRPC
const mockTrpcContext = {
  pressRun: {
    list: {
      useQuery: jest.fn(),
    },
    create: {
      useMutation: jest.fn(),
    },
    cancel: {
      useMutation: jest.fn(),
    },
    delete: {
      useMutation: jest.fn(),
    },
  },
};

jest.mock("@/utils/trpc", () => ({
  trpc: mockTrpcContext,
}));

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
};

const mockCompletedPressRuns = [
  {
    id: "test-press-run-1",
    pressRunName: "Test Press Run 1",
    status: "completed",
    endTime: "2024-01-15T14:00:00.000Z",
    totalAppleWeightKg: "500",
    totalJuiceVolumeL: "300",
    extractionRatePercent: 60,
    varieties: ["Gala", "Honeycrisp"],
    vesselName: "Tank A",
  },
  {
    id: "test-press-run-2",
    pressRunName: "Test Press Run 2",
    status: "completed",
    endTime: "2024-01-16T13:30:00.000Z",
    totalAppleWeightKg: "750",
    totalJuiceVolumeL: "450",
    extractionRatePercent: 60,
    varieties: ["Fuji"],
    vesselName: "Tank B",
  },
];

const mockActivePressRuns = [
  {
    id: "active-press-run-1",
    pressRunName: "Active Press Run",
    status: "in_progress",
    startTime: "2024-01-17T08:00:00.000Z",
    totalAppleWeightKg: "200",
    varieties: ["Granny Smith"],
    loadCount: 1,
    vendorName: "Active Vendor",
  },
];

describe("PressingPage Navigation Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock successful tRPC queries
    mockTrpcContext.pressRun.list.useQuery
      .mockReturnValueOnce({
        // First call for in_progress status
        data: { pressRuns: mockActivePressRuns },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      })
      .mockReturnValueOnce({
        // Second call for completed status
        data: { pressRuns: mockCompletedPressRuns },
        isLoading: false,
        error: null,
        refetch: jest.fn(),
      });

    // Mock mutations
    mockTrpcContext.pressRun.create.useMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    mockTrpcContext.pressRun.cancel.useMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    mockTrpcContext.pressRun.delete.useMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  describe("Completed Press Run Navigation", () => {
    test("renders completed press run cards with proper navigation attributes", () => {
      render(<PressingPage />);

      // Find cards by role and aria-label containing press run info
      const cards = screen
        .getAllByRole("button")
        .filter((card) =>
          card.getAttribute("aria-label")?.includes("View press run details"),
        );

      expect(cards.length).toBeGreaterThan(0);

      // Check first card has proper attributes
      const firstCard = cards[0];
      expect(firstCard).toHaveAttribute("tabIndex", "0");
      expect(firstCard).toHaveClass("cursor-pointer");
      expect(firstCard).toHaveClass("hover:bg-green-50");
    });

    test("navigates to press run detail page when card is clicked", async () => {
      render(<PressingPage />);

      // Find the first completed press run card
      const pressRunCard = screen.getByLabelText(
        /View press run details for Test Press Run 1/,
      );

      fireEvent.click(pressRunCard);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/pressing/test-press-run-1",
        );
      });
    });

    test("navigates to press run detail page when Enter key is pressed", async () => {
      render(<PressingPage />);

      const pressRunCard = screen.getByLabelText(
        /View press run details for Test Press Run 1/,
      );

      fireEvent.keyDown(pressRunCard, { key: "Enter" });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/pressing/test-press-run-1",
        );
      });
    });

    test("navigates to press run detail page when Space key is pressed", async () => {
      render(<PressingPage />);

      const pressRunCard = screen.getByLabelText(
        /View press run details for Test Press Run 1/,
      );

      fireEvent.keyDown(pressRunCard, { key: " " });

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/pressing/test-press-run-1",
        );
      });
    });

    test("does not navigate when other keys are pressed", async () => {
      render(<PressingPage />);

      const pressRunCard = screen.getByLabelText(
        /View press run details for Test Press Run 1/,
      );

      fireEvent.keyDown(pressRunCard, { key: "Tab" });
      fireEvent.keyDown(pressRunCard, { key: "Escape" });
      fireEvent.keyDown(pressRunCard, { key: "ArrowDown" });

      await waitFor(() => {
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });

    test("View Press Run button navigates correctly", async () => {
      render(<PressingPage />);

      const viewButtons = screen.getAllByTestId("view-press-run");
      expect(viewButtons.length).toBeGreaterThan(0);

      fireEvent.click(viewButtons[0]);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          "/pressing/test-press-run-1",
        );
      });
    });

    test("renders View Press Run button with correct styling", () => {
      render(<PressingPage />);

      const viewButtons = screen.getAllByTestId("view-press-run");
      expect(viewButtons.length).toBeGreaterThan(0);

      const viewButton = viewButtons[0];
      expect(viewButton).toHaveTextContent("View Press Run");
      expect(viewButton).toHaveClass("text-green-700");
      expect(viewButton).toHaveClass("border-green-600");
      expect(viewButton).toHaveClass("hover:bg-green-600");
      expect(viewButton).toHaveClass("hover:text-white");
    });

    test("displays correct press run information in completed cards", () => {
      render(<PressingPage />);

      // Check first press run data
      expect(screen.getByText("Test Press Run 1")).toBeInTheDocument();
      expect(screen.getByText("Gala, Honeycrisp")).toBeInTheDocument();
      expect(screen.getByText("→ Tank A")).toBeInTheDocument();
      expect(screen.getByText("500 kg")).toBeInTheDocument();
      expect(screen.getByText("300.0 L")).toBeInTheDocument();
      expect(screen.getByText("60.0%")).toBeInTheDocument();

      // Check second press run data
      expect(screen.getByText("Test Press Run 2")).toBeInTheDocument();
      expect(screen.getByText("Fuji")).toBeInTheDocument();
      expect(screen.getByText("→ Tank B")).toBeInTheDocument();
      expect(screen.getByText("750 kg")).toBeInTheDocument();
      expect(screen.getByText("450.0 L")).toBeInTheDocument();
    });
  });

  describe("Active Press Run Navigation", () => {
    test("active press runs do not have navigation functionality", () => {
      render(<PressingPage />);

      // Active press runs should display without navigation features
      expect(screen.getByText("Active Vendor")).toBeInTheDocument();

      // Active press runs are in a different section without clickable cards
      const completedSection = screen.getByText("Recent Completed");
      expect(completedSection).toBeInTheDocument();

      // Verify active runs don't have "View Press Run" buttons
      const activeSection = screen.getByText("Active Vendor").closest("div");
      const viewButtonsInActiveSection = activeSection?.querySelectorAll(
        '[data-testid="view-press-run"]',
      );
      expect(viewButtonsInActiveSection?.length).toBeFalsy();
    });
  });

  describe("Error Handling", () => {
    test("handles loading state gracefully", () => {
      jest.clearAllMocks();
      (useRouter as jest.Mock).mockReturnValue(mockRouter);

      mockTrpcContext.pressRun.list.useQuery
        .mockReturnValueOnce({
          data: undefined,
          isLoading: true,
          error: null,
          refetch: jest.fn(),
        })
        .mockReturnValueOnce({
          data: undefined,
          isLoading: true,
          error: null,
          refetch: jest.fn(),
        });

      render(<PressingPage />);

      // Should render loading state without errors
      expect(
        screen.getByText("Loading active press runs..."),
      ).toBeInTheDocument();
    });

    test("handles empty data gracefully", () => {
      jest.clearAllMocks();
      (useRouter as jest.Mock).mockReturnValue(mockRouter);

      mockTrpcContext.pressRun.list.useQuery
        .mockReturnValueOnce({
          data: { pressRuns: [] },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        })
        .mockReturnValueOnce({
          data: { pressRuns: [] },
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        });

      render(<PressingPage />);

      // Should render empty states
      expect(screen.getByText("No active press runs")).toBeInTheDocument();
      expect(
        screen.getByText("No completed press runs found"),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    test("completed press run cards have proper ARIA attributes", () => {
      render(<PressingPage />);

      const cards = screen
        .getAllByRole("button")
        .filter((card) =>
          card.getAttribute("aria-label")?.includes("View press run details"),
        );

      expect(cards.length).toBeGreaterThan(0);
      const firstCard = cards[0];

      expect(firstCard).toHaveAttribute("role", "button");
      expect(firstCard).toHaveAttribute("tabIndex", "0");
      expect(firstCard).toHaveAttribute("aria-label");
    });

    test("View Press Run buttons are keyboard accessible", () => {
      render(<PressingPage />);

      const viewButtons = screen.getAllByTestId("view-press-run");
      expect(viewButtons.length).toBeGreaterThan(0);

      const viewButton = viewButtons[0];
      expect(viewButton).toHaveAttribute("type", "button");
      expect(viewButton).not.toHaveAttribute("disabled");
    });
  });
});
