import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider, useToast } from "../toast";
import { NotificationCenter } from "../../components/NotificationCenter";
import { useNotificationStore } from "../notificationStore";

function Trigger() {
  const { addToast } = useToast();
  return (
    <>
      <button onClick={() => addToast("Transaction confirmed", "success")}>success</button>
      <button onClick={() => addToast("Transaction failed", "error")}>error</button>
    </>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  );
}

describe("toast announcements", () => {
  it("announces success toasts politely via role=status", () => {
    renderToasts();
    fireEvent.click(screen.getByText("success"));

    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("Transaction confirmed");
    expect(toast.getAttribute("aria-live")).toBe("polite");
    expect(toast.getAttribute("aria-atomic")).toBe("true");
  });

  it("announces error toasts assertively via role=alert", () => {
    renderToasts();
    fireEvent.click(screen.getByText("error"));

    const toast = screen.getByRole("alert");
    expect(toast.textContent).toContain("Transaction failed");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
    expect(toast.getAttribute("aria-atomic")).toBe("true");
  });

  it("keeps success and error styling distinct", () => {
    renderToasts();
    fireEvent.click(screen.getByText("success"));
    fireEvent.click(screen.getByText("error"));

    const success = screen.getByRole("status");
    const error = screen.getByRole("alert");
    expect(success.getAttribute("data-toast-type")).toBe("success");
    expect(error.getAttribute("data-toast-type")).toBe("error");
    expect(success.style.background).not.toBe(error.style.background);
    expect(success.style.color).not.toBe(error.style.color);
  });
});

describe("NotificationCenter announcements", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
  });

  it("announces the newest unread notification in a polite live region", () => {
    render(
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>,
    );

    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");

    act(() => {
      useNotificationStore.getState().push({
        title: "Transfer settled",
        message: "Invoice token transfer confirmed",
        severity: "info",
        category: "transfer",
      });
    });

    expect(region.textContent).toBe("Transfer settled: Invoice token transfer confirmed");
  });
});
