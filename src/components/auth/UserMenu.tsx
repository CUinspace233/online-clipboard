'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { KeyIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface UserMenuProps {
  username: string;
  onChangePassword: () => void;
}

export function UserMenu({ username, onChangePassword }: UserMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Open menu for ${username}`}
          className="inline-flex max-w-[10rem] items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
        >
          <span className="truncate">{username}</span>
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[12rem] overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-lg animate-menu-in"
        >
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              onChangePassword();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 outline-none transition-colors data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-600"
          >
            <KeyIcon className="h-4 w-4" aria-hidden="true" />
            Change Password
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
