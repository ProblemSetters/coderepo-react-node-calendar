import { Modal } from "../../shared/components/Modal.jsx";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { formatTime } from "../../shared/utils/date.js";

export function EventPreview({ calendar, error = "", event, onClose, onDelete, onEdit }) {
    const date = new Date(event.startAt);
    const typeLabels = { event: "Event", task: "Task", outOfOffice: "Out of office", focusTime: "Focus time", workingLocation: "Working location", appointmentSchedule: "Appointment schedule" };
    return <Modal className="event-preview-modal" onClose={onClose}><article className="event-preview">
        <div className="preview-actions">{event.editable !== false && <><button className="icon-button" title="Edit event" aria-label="Edit event" onClick={onEdit}><MaterialIcon size={20}>edit</MaterialIcon></button><button className="icon-button" title="Delete event" aria-label="Delete event" onClick={() => { if (window.confirm(`Delete “${event.title}”?`)) onDelete(); }}><MaterialIcon size={20}>delete</MaterialIcon></button></>}<button className="icon-button" title="Close" aria-label="Close" onClick={onClose}><MaterialIcon size={22}>close</MaterialIcon></button></div>
        <div className="preview-title"><i style={{ backgroundColor: event.color || calendar?.color }} /><h2>{event.title}</h2></div>
        <div className="preview-detail"><MaterialIcon>schedule</MaterialIcon><span>{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}<small>{event.allDay ? "All day" : `${formatTime(event.startAt)} – ${formatTime(event.endAt)}`}</small></span></div>
        <div className="preview-detail"><MaterialIcon>event</MaterialIcon><span>{typeLabels[event.type || "event"]}<small>{calendar?.name || event.calendarName || "Calendar"}</small></span></div>
        {event.editable === false && <div className="preview-detail"><MaterialIcon>person</MaterialIcon><span>{event.readOnlyOwner ? `Organized by ${event.readOnlyOwner}` : "Invited event"}<small>{event.readOnlyOwner ? `Only ${event.readOnlyOwner} can make changes to this event.` : "Only the organizer can edit or delete this event."}</small></span></div>}
        {(event.participants?.length || event.organizer) && <div className="preview-detail"><MaterialIcon>group</MaterialIcon><span>{event.participants?.length ? event.participants.join(", ") : event.organizer}</span></div>}
        {event.location && <div className="preview-detail"><MaterialIcon>location_on</MaterialIcon><span>{event.location}</span></div>}
        {event.description && <div className="preview-detail"><MaterialIcon>subject</MaterialIcon><span>{event.description}</span></div>}
        {error && <p className="preview-error" role="alert">{error}</p>}
    </article></Modal>;
}
