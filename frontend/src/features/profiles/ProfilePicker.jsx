import { ProfileAvatar } from "./ProfileAvatar.jsx";

export function ProfilePicker({ error = "", loading = false, onLogout, onRetry, onSelect, profiles = [] }) {
    return <main className="profile-picker-page">
        <header className="profile-picker-brand" aria-label="Calendar"><span className="brand-date"><span className="brand-binding" />31</span><span>Calendar</span></header>
        <section className="profile-picker-panel" aria-labelledby="profile-picker-title">
            <div className="profile-picker-copy"><h1 id="profile-picker-title">Who’s using Calendar?</h1></div>
            {loading && <div className="profile-picker-status" role="status"><span className="profile-loader" />Loading profiles…</div>}
            {!loading && error && <div className="profile-picker-error" role="alert"><div><strong>Profiles couldn’t be loaded</strong><span>{error}</span></div><button onClick={onRetry}>Try again</button></div>}
            {!loading && !error && <div className="profile-grid">{profiles.map((profile) => <button className="profile-card" key={profile._id} style={{ "--profile-color": profile.avatarColor }} onClick={() => onSelect(profile)} aria-label={`Continue as ${profile.name}`}>
                <ProfileAvatar profile={profile} size="large" />
                <strong>{profile.name}</strong>
            </button>)}</div>}
            {!loading && !error && profiles.length === 0 && <div className="profile-picker-status">No profiles are available.</div>}
            <button className="profile-picker-signout" type="button" onClick={onLogout}>Sign out of workspace</button>
        </section>
    </main>;
}
