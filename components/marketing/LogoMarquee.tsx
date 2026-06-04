'use client';

const TOOLS = [
  'Proposify', 'PandaDoc', 'Filestage', 'Google Docs',
  'Canva', 'Monday.com', 'Dropbox', 'Notion',
  'Asana', 'Trello', 'Slack', 'Loom',
];

export function LogoMarquee() {
  return (
    <div className="relative py-5 overflow-hidden">
      <div className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
      <div className="flex overflow-hidden">
        <div className="flex shrink-0 items-center gap-10 animate-marquee">
          {[...TOOLS, ...TOOLS].map((tool, i) => (
            <span
              key={i}
              className="text-sm font-medium text-faint/70 whitespace-nowrap select-none"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
