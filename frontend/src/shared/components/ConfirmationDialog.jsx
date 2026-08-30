import { createPortal } from "react-dom";
import { useId } from "react";
import { MaterialIcon } from "./MaterialIcon.jsx";
import { Modal } from "./Modal.jsx";

export function ConfirmationDialog({ busy = false, confirmLabel = "Continue", destructive = false, error = "", icon, message, onCancel, onConfirm, title }) {
    const titleId = `confirmation-${useId().replace(/:/g, "")}`;
    return createPortal(<Modal className="confirmation-dialog-modal" labelledBy={titleId} onClose={() => { if (!busy) onCancel(); }}>
        <section className="confirmation-dialog">
            <div className={`confirmation-dialog-icon ${destructive ? "destructive" : ""}`}><MaterialIcon size={22}>{icon || (destructive ? "delete" : "warning")}</MaterialIcon></div>
            <div className="confirmation-dialog-content">
                <h2 id={titleId}>{title}</h2>
                <p>{message}</p>
                {error && <p className="confirmation-dialog-error" role="alert">{error}</p>}
            </div>
            <footer>
                <button data-autofocus disabled={busy} type="button" onClick={onCancel}>Cancel</button>
                <button className={destructive ? "destructive-button" : "primary-button"} disabled={busy} type="button" onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button>
            </footer>
        </section>
    </Modal>, document.body);
}
