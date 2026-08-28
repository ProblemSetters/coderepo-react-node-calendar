export function profileInitials(name = "") {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function ProfileAvatar({ profile, size = "medium" }) {
    return <span className={`profile-avatar profile-avatar-${size}`} style={{ "--profile-color": profile.avatarColor }} aria-hidden="true">
        <span>{profileInitials(profile.name)}</span>
    </span>;
}
