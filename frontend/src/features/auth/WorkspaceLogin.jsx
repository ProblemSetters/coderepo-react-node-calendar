import { useState } from "react";

export function WorkspaceLogin({ error = "", loading = false, onLogin = () => {} }) {
    const [email, setEmail] = useState("calendar@hackerrank.com");
    const [password, setPassword] = useState("password123");
    const submit = (event) => { event.preventDefault(); onLogin(email.trim(), password); };
    return <main className="workspace-login-page">
        <header className="profile-picker-brand" aria-label="Calendar"><span className="brand-date"><span className="brand-binding" />31</span><span>Calendar</span></header>
        <section className="workspace-login-card" aria-labelledby="workspace-login-title">
            <div className="workspace-login-mark"><span className="brand-date"><span className="brand-binding" />31</span></div>
            <h1 id="workspace-login-title">Welcome to Calendar</h1>
            <p>Sign in once, then choose any assessment profile.</p>
            <form onSubmit={submit}>
                <label><span>Email</span><input autoComplete="username" data-testid="email-input" disabled={loading} inputMode="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
                <label><span>Password</span><input autoComplete="off" className="workspace-password-input" data-testid="password-input" disabled={loading} name="password" required type="text" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
                {error && <p className="workspace-login-error" role="alert">{error}</p>}
                <button className="primary-button" disabled={loading} type="submit">{loading ? "Signing in…" : "Continue"}</button>
            </form>
        </section>
    </main>;
}
