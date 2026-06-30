'use client';

import { avatarColor, avatarInitials } from './assignee-types';

export default function AssigneeAvatar({ name, email, seed, size = 24 }: {
  name: string; email: string; seed: string; size?: number;
}) {
  return (
    <div
      className={`rounded-full text-2xs font-semibold text-white flex items-center justify-center shrink-0 ${avatarColor(seed)}`}
      style={{ width: size, height: size }}
    >
      {avatarInitials(name, email)}
    </div>
  );
}
