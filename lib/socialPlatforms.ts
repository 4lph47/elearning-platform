export interface SocialPlatform {
  key:
    | "websiteUrl"
    | "twitterUrl"
    | "linkedinUrl"
    | "youtubeUrl"
    | "instagramUrl"
    | "facebookUrl"
    | "tiktokUrl"
    | "githubUrl"
    | "discordUrl"
    | "mediumUrl"
    | "twitchUrl";
  label: string;
  placeholder: string;
  // null = qualquer URL http(s) serve (Website). Nos outros, o link tem de
  // ser mesmo do domínio da plataforma escolhida — evita pôr um link de
  // Instagram no campo do LinkedIn, por engano ou de propósito.
  hostnames: string[] | null;
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: "websiteUrl", label: "Website", placeholder: "https://o-teu-site.com", hostnames: null },
  { key: "twitterUrl", label: "Twitter / X", placeholder: "https://x.com/utilizador", hostnames: ["twitter.com", "x.com"] },
  { key: "linkedinUrl", label: "LinkedIn", placeholder: "https://linkedin.com/in/utilizador", hostnames: ["linkedin.com"] },
  { key: "youtubeUrl", label: "YouTube", placeholder: "https://youtube.com/@canal", hostnames: ["youtube.com", "youtu.be"] },
  { key: "instagramUrl", label: "Instagram", placeholder: "https://instagram.com/utilizador", hostnames: ["instagram.com"] },
  { key: "facebookUrl", label: "Facebook", placeholder: "https://facebook.com/pagina", hostnames: ["facebook.com", "fb.com", "fb.watch"] },
  { key: "tiktokUrl", label: "TikTok", placeholder: "https://tiktok.com/@utilizador", hostnames: ["tiktok.com"] },
  { key: "githubUrl", label: "GitHub", placeholder: "https://github.com/utilizador", hostnames: ["github.com"] },
  { key: "discordUrl", label: "Discord", placeholder: "https://discord.gg/convite", hostnames: ["discord.gg", "discord.com"] },
  { key: "mediumUrl", label: "Medium", placeholder: "https://medium.com/@utilizador", hostnames: ["medium.com"] },
  { key: "twitchUrl", label: "Twitch", placeholder: "https://twitch.tv/canal", hostnames: ["twitch.tv"] },
];

export type SocialPlatformKey = SocialPlatform["key"];

// Aceita o domínio exato ou um subdomínio dele (ex.: "escrever.medium.com"
// bate com "medium.com"), nunca um domínio só parecido (ex.: "medium.com.evil.tld" falha).
function hostnameMatches(hostname: string, allowed: string) {
  return hostname === allowed || hostname.endsWith(`.${allowed}`);
}

export function matchesPlatformDomain(platform: SocialPlatform, url: string): boolean {
  if (!platform.hostnames) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return platform.hostnames.some((allowed) => hostnameMatches(hostname, allowed));
  } catch {
    return false;
  }
}
