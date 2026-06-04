"use client"

import * as React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import Image from "next/image"
import { NavMain, NavSecondary, NavUser } from "@/components"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { filterMenuItemsByRole } from "@/lib/utils/menuUtils"
import { cn } from "@/lib/utils/helpers"
import { useUser } from "@/contexts"

interface AppSidebarProps {
  className?: string
  innerClassName?: string
}

// Memoize the filtered menu items function to prevent recreation
const useFilteredMenuItems = (roles: string[]) => {
  return useMemo(() =>
    filterMenuItemsByRole(roles),
    [roles]
  );
};

// Memoize the sidebar content to prevent unnecessary re-renders
const SidebarContentMemo = React.memo(({
  filteredMenuItems,
  openGroup,
  handleGroupToggle,
  handleItemClick
}: {
  filteredMenuItems: ReturnType<typeof filterMenuItemsByRole>
  openGroup: string | null
  handleGroupToggle: (groupTitle: string) => void
  handleItemClick: () => void
}) => (
  <SidebarContent>
    <NavMain
      items={filteredMenuItems.navMain}
      openGroup={openGroup}
      onGroupToggle={handleGroupToggle}
      onItemClick={handleItemClick}
    />
    <NavSecondary
      items={filteredMenuItems.navSecondary}
      onItemClick={handleItemClick}
    />
  </SidebarContent>
));

SidebarContentMemo.displayName = 'SidebarContentMemo';

// Memoize the loading state to prevent unnecessary re-renders
const LoadingSidebar = React.memo(({
  sidebarProps,
  className
}: {
  sidebarProps: React.ComponentProps<typeof Sidebar>
  className?: string
}) => (
  <Sidebar {...sidebarProps} className={cn("bg-main text-white", className)}>
    <SidebarHeader>
      <SidebarTitle />
    </SidebarHeader>
    <SidebarContent>
      <div className="flex flex-col gap-2 p-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md opacity-60" />
        ))}
      </div>
    </SidebarContent>
  </Sidebar>
));

LoadingSidebar.displayName = 'LoadingSidebar';

// Component to conditionally show the title based on sidebar state
const SidebarTitle = React.memo(() => {
  const { state } = useSidebar();
  const isDev =
    (process.env.NEXT_PUBLIC_STAGE || "dev").toLowerCase() === "dev";

  // Only show title when sidebar is expanded (not in icon mode)
  if (state === "collapsed") {
    return null;
  }

  return (
    <div className="my-3 mx-2 flex items-center gap-2">
      <h1 className="text-white text-2xl font-bold">GOPex</h1>
      {isDev && (
        <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-red-500 text-black">
          DEV
        </span>
      )}
    </div>
  );
});

SidebarTitle.displayName = 'SidebarTitle';

const AppSidebar = React.memo<AppSidebarProps>(({ className, innerClassName }) => {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { user, roles, loading } = useUser();
  const { state, setOpen } = useSidebar();

  // Use custom hook for filtered menu items
  const filteredMenuItems = useFilteredMenuItems(roles);

  // Memoize handlers to prevent recreation on every render
  const handleGroupToggle = useCallback((groupTitle: string) => {
    setOpenGroup(prevOpenGroup => {
      if (prevOpenGroup === groupTitle) {
        return null;
      }
      return groupTitle;
    });

    // If sidebar is collapsed (icon mode), expand it so user can see the group options
    if (state === "collapsed") {
      setOpen(true);
    }
  }, [state, setOpen]);

  const handleItemClick = useCallback(() => {
    setOpenGroup(null);

    // If sidebar is collapsed (icon mode), expand it so user can see the options
    if (state === "collapsed") {
      setOpen(true);
    }
  }, [state, setOpen]);

  // Memoize user object to prevent unnecessary re-renders
  const userProps = useMemo(() => ({
    name: user?.name || '',
    email: user?.email || '',
    avatar: user?.avatar || ''
  }), [user?.name, user?.email, user?.avatar]);

  // Memoize the sidebar props to prevent recreation
  const sidebarProps = useMemo(() => ({
    collapsible: "icon" as const,
    className,
    innerClassName: innerClassName
  }), [className, innerClassName]);

  // Only show loading on initial load, not on subsequent re-renders
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);

  // Show loading state only on initial load
  if (loading && isInitialLoad) {
    return (
      <LoadingSidebar sidebarProps={sidebarProps} className={className} />
    );
  }

  // Don't render sidebar if no user
  if (!user) {
    return null;
  }

  return (
    <Sidebar {...sidebarProps} className={cn("bg-main text-white", className)}>
      <SidebarHeader>
        <SidebarTitle />
      </SidebarHeader>
      <SidebarContentMemo
        filteredMenuItems={filteredMenuItems}
        openGroup={openGroup}
        handleGroupToggle={handleGroupToggle}
        handleItemClick={handleItemClick}
      />
      <SidebarFooter>
        <NavSecondary
          items={filteredMenuItems.navSettings}
          onItemClick={handleItemClick}
        />
        <NavUser user={userProps} />
      </SidebarFooter>
    </Sidebar>
  )
});

AppSidebar.displayName = 'AppSidebar';

export { AppSidebar };
