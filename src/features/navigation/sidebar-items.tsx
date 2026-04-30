import type { SidebarItem } from "@/types/navigation";

function MenuIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-6 w-6 text-green-600"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

export const sidebarItems: SidebarItem[] = [
  { icon: <MenuIcon />, menuName: "采摘熟练", progress: 52 },
  { icon: <PlusIcon />, menuName: "钓鱼熟练", progress: 37 },
  { icon: <MenuIcon />, menuName: "锻造熟练", progress: 48 },
  { icon: <PlusIcon />, menuName: "冒险名望", progress: 68 },
];
