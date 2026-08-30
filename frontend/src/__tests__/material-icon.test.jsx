import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { MaterialIcon } from "../shared/components/MaterialIcon.jsx";

const applicationIcons = [
    "add", "arrow_back", "arrow_drop_down", "arrow_drop_up", "business", "check", "check_circle",
    "chevron_left", "chevron_right", "close", "delete", "edit", "error", "error_outline", "event",
    "event_busy", "expand_less", "expand_more", "group", "headphones", "help", "help_outline",
    "insights", "location_on", "lock", "logout", "menu", "more_vert", "palette", "person", "repeat",
    "schedule", "search", "subject", "sync", "warning", "warning_amber",
];

describe("MaterialIcon", () => {
    test("provides a non-empty SVG path for every icon used by the application", () => {
        const { container } = render(<>{applicationIcons.map((name) => <MaterialIcon key={name}>{name}</MaterialIcon>)}</>);
        const paths = [...container.querySelectorAll("path")];
        expect(paths).toHaveLength(applicationIcons.length);
        expect(paths.every((path) => Boolean(path.getAttribute("d")?.trim()))).toBe(true);
    });

    test("uses a visible fallback instead of rendering an empty icon", () => {
        const { container } = render(<MaterialIcon>unknown_icon_name</MaterialIcon>);
        expect(container.querySelector("path")).toHaveAttribute("d", expect.stringMatching(/\S/));
    });
});
