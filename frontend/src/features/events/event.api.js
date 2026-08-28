import { request } from "../../shared/api/client.js";

export const eventApi = {
    list: (from, to, calendarIds) => request(`/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&calendarIds=${calendarIds.join(",")}`),
    search: (filters, calendarIds) => {
        const parameters = new URLSearchParams({ calendarIds: calendarIds.join(",") });
        for (const field of ["what", "who", "where", "exclude"]) if (filters[field]) parameters.set(field, filters[field]);
        if (filters.from) parameters.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
        if (filters.to) {
            const exclusiveEnd = new Date(`${filters.to}T00:00:00`);
            exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
            parameters.set("to", exclusiveEnd.toISOString());
        }
        return request(`/events/search?${parameters.toString()}`);
    },
    get: (id) => request(`/events/${id}`),
    create: (event) => request("/events", { method: "POST", body: JSON.stringify(event) }),
    update: (id, event) => request(`/events/${id}`, { method: "PATCH", body: JSON.stringify(event) }),
    remove: (id) => request(`/events/${id}`, { method: "DELETE" }),
};
