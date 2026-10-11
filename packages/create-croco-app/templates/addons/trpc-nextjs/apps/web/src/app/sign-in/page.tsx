import { localDemoEnabled } from "../../server/LocalSessionProvider";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <main>
      <p className="eyebrow">LOCAL TEST IDENTITIES</p>
      <h1>Choose a workspace.</h1>
      <p className="lead">
        These synthetic identities are enabled only in the explicit local demo mode.
      </p>
      {localDemoEnabled() ? (
        <form action="/api/local-session" method="post" className="card">
          <label htmlFor="identity">Test identity</label>
          <select id="identity" name="identity" defaultValue="alice">
            <option value="alice">Alice · Studio A</option>
            <option value="bob">Bob · Studio B</option>
            <option value="carol">Carol · Studio A</option>
          </select>
          <button type="submit">Enter workspace</button>
          <p className="note">
            One-hour server sessions. Private results belong to both a user and a tenant.
          </p>
        </form>
      ) : (
        <p role="alert">Local sign-in is disabled. Run the documented local demo command.</p>
      )}
    </main>
  );
}
