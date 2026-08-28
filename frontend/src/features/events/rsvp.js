export const rsvpOptions = [
    { status: "accepted", label: "Yes", accessibleLabel: "Yes, attending", icon: "check" },
    { status: "declined", label: "No", accessibleLabel: "No, declining", icon: "close" },
    { status: "tentative", label: "Maybe", accessibleLabel: "Maybe attending", icon: "help_outline" },
];

export const rsvpStatusLabels = {
    needsAction: "Awaiting response",
    accepted: "Yes",
    declined: "No",
    tentative: "Maybe",
};

export function responseSummaryText(summary = {}) {
    return [
        summary.accepted && `${summary.accepted} yes`,
        summary.tentative && `${summary.tentative} maybe`,
        summary.declined && `${summary.declined} no`,
        summary.needsAction && `${summary.needsAction} awaiting`,
    ].filter(Boolean).join(" · ");
}
