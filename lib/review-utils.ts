// lib/review-utils.ts

export function timeAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const TYPE_LABELS: Record<string, string> = {
  image: 'Image',
  ad: 'Ad',
  webpage: 'Page',
  email: 'Email',
  video: 'Video',
};