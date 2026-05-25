import { Redirect } from "wouter";

// The standalone profile page was folded into /coach/settings as the
// "Profilis" tab. This redirect keeps old bookmarks and external links
// working.
export default function CoachProfileRedirect() {
  return <Redirect to="/coach/settings?tab=profile" />;
}
