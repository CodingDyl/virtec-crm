/**
 * Whether a portal request came from a program rather than the client.
 *
 * "Last opened" is only worth reading if it means a person opened it. Chat
 * apps, social sites and mail scanners fetch a link the moment it is sent, to
 * build a preview card or to check it is safe, and that fetch would otherwise
 * stamp the portal as opened. The match is on the user agent, so it catches
 * the honest ones; a scanner that pretends to be a browser still gets through.
 */
// Specific on purpose. "bot" already catches LinkedInBot, Twitterbot, Slackbot,
// Discordbot and TelegramBot, so those apps' names are left out: their in-app
// browsers put the app's name in the user agent, and a client tapping the link
// inside LinkedIn is a person.
const AUTOMATED =
  /bot|crawler|spider|preview|fetcher|slurp|facebookexternalhit|whatsapp\/|curl|wget|python-requests|go-http-client|okhttp|axios|node-fetch|headlesschrome|lighthouse|pingdom|uptime|monitor|safelinks|proofpoint|mimecast|barracuda/i;

export function isAutomatedVisit(userAgent: string | null | undefined): boolean {
  // A real browser always says what it is; no user agent at all is a script.
  if (!userAgent || !userAgent.trim()) return true;
  return AUTOMATED.test(userAgent);
}
