# Comment Lifecycle Improvement Plan

## Goal

Replace the current permanent, password-in-the-URL comment inbox with a bounded
and authenticated workflow. A comment should have a clear lifecycle rather than
being an unstructured record that remains forever and is returned in full on
every refresh.

## Current Behavior

- A listener submits a comment with `GET /api/add-comment?message=...`.
- The API inserts a MongoDB `Comment` document.
- The DJ management page prompts for a shared password.
- The browser sends that password in the URL to `GET /api/get-comments` every
  15 seconds.
- The API returns every stored comment, newest first.
- There is no read state, deletion workflow, expiration, pagination, or
  authenticated session.

## Target Lifecycle

```text
submitted -> available to DJ -> read or moderated -> retained briefly -> expired
```

The application should retain enough history for DJ operations without treating
every historical comment as part of every inbox response.

## Planned API Changes

### Submit A Comment

Replace the public GET route with a POST route:

```text
POST /api/comments
Content-Type: application/json

{
  "message": "..."
}
```

The API should validate that the message is present, trim it, enforce a maximum
length, and return a created response. The listener-facing client should submit
JSON in the request body rather than placing the comment in a URL.

Add rate limiting and basic spam protection before treating the endpoint as a
public production form. The specific approach can be selected later, but the
endpoint needs a defined limit per client over a defined interval.

### DJ Authentication

Replace the `password` query parameter with an authentication service that
creates a DJ session.

Suggested interaction:

1. DJ opens the management comments page.
2. DJ submits credentials to a login endpoint over HTTPS.
3. The server verifies the credentials and creates a short-lived session.
4. The server stores the session in a secure, HTTP-only, same-site cookie.
5. Comment routes use the cookie to identify an authenticated DJ.
6. The DJ can explicitly log out, and expired sessions require sign-in again.

This keeps credentials out of URLs, browser history, repeated polling requests,
and routine request logs. It also creates a place to support multiple DJ users
or roles later without changing the comment API again.

### Read Comments

Replace the unbounded response with a bounded inbox route, for example:

```text
GET /api/comments?limit=50&before=<cursor>
```

The response should include only a defined page of comments, ordered newest
first, plus a cursor that lets the management interface retrieve older history
only when requested.

```json
{
  "comments": [],
  "nextCursor": "..."
}
```

The default and maximum `limit` values should be enforced server-side. A first
implementation can return the newest 50 comments. The management page can poll
only for records newer than its newest known timestamp or identifier, instead
of downloading the same full page repeatedly.

## Comment Data Model

Keep the message and creation date, then add lifecycle fields as needed:

```js
{
  message: String,
  createdAt: Date,
  status: 'new' | 'read' | 'hidden',
  readAt: Date | null,
  expiresAt: Date
}
```

`expiresAt` can support a MongoDB TTL index so old comments are removed
automatically. This is preferable to relying on a manual cleanup task.

Only retain name, email, or phone fields if the public form actually collects
them and there is an operational reason to keep them. The current Snow form
submits only a message, so those fields are presently unused.

## Policy Decisions Required

These choices should be made before implementation:

| Decision | Suggested starting point |
| --- | --- |
| Inbox page size | 50 newest comments |
| Maximum page size | 100 comments |
| Comment retention | 30 or 90 days, depending on DJ needs |
| DJ session lifetime | One shift or one day, with explicit logout |
| Read behavior | Mark as read when the DJ views or explicitly acknowledges it |
| Spam limit | A small number of submissions per IP per hour |
| Historical access | Cursor-based pages, limited to authenticated DJs |

## Migration Sequence

1. Define the policy decisions above.
2. Add the new authenticated API alongside the existing API.
3. Update the Snow comment form to submit `POST /api/comments`.
4. Update the management page to log in and use its session cookie.
5. Add bounded/cursor-based comment retrieval and lifecycle fields.
6. Add the TTL index after selecting the retention period.
7. Verify the new clients are deployed and working.
8. Retire `/api/add-comment` and `/api/get-comments`.

Keeping the old routes during migration avoids breaking the listener form or DJ
page while the two applications are updated separately.
