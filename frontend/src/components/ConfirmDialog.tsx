import type { ReactNode } from "react";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  loading?: boolean;
}

export default function ConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Dialog panel */}
      <div
        style={{
          position: "relative",
          background: "var(--card-bg, #1a1a2e)",
          border: "1px solid var(--border, #2a2a3e)",
          borderRadius: 12,
          padding: "1.5rem",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <h3
          id="confirm-dialog-title"
          style={{
            margin: "0 0 0.75rem",
            fontSize: "1.05rem",
            fontWeight: 600,
          }}
        >
          {title}
        </h3>

        <div
          style={{
            fontSize: "0.9rem",
            color: "var(--muted, #888)",
            marginBottom: "1.5rem",
            lineHeight: 1.55,
          }}
        >
          {description}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: 80 }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-success"
            onClick={onConfirm}
            disabled={loading}
            style={{ minWidth: 100 }}
          >
            {loading ? "Sending…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
