"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"

type NavItem = {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: { title: string; url: string }[]
}

function isExpandable(item: NavItem): boolean {
    return !!item.items && item.items.length > 0
}

export function NavMain({
    items,
    openGroup,
    onGroupToggle,
    onItemClick,
}: {
    items: NavItem[]
    openGroup?: string | null
    onGroupToggle?: (groupTitle: string) => void
    onItemClick?: () => void
}) {
    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => {
                    if (isExpandable(item)) {
                        return (
                            <Collapsible
                                key={item.title}
                                asChild
                                open={openGroup === item.title}
                                onOpenChange={() => onGroupToggle?.(item.title)}
                                className="group/collapsible"
                            >
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip={item.title} className="hover:bg-main active:bg-main data-[state=open]:hover:bg-main">
                                            {item.icon && <item.icon className="h-4 w-4 flex-shrink-0 text-current" />}
                                            <span>{item.title}</span>
                                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {item.items?.map((subItem) => {
                                                const isExternal = subItem.url.startsWith('http');
                                                return (
                                                    <SidebarMenuSubItem key={subItem.title}>
                                                        <SidebarMenuSubButton asChild className="text-white">
                                                            {isExternal ? (
                                                                <a
                                                                    href={subItem.url}
                                                                    onClick={onItemClick}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    <span>{subItem.title}</span>
                                                                </a>
                                                            ) : (
                                                                <Link
                                                                    href={subItem.url}
                                                                    onClick={onItemClick}
                                                                >
                                                                    <span>{subItem.title}</span>
                                                                </Link>
                                                            )}
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                );
                                            })}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        )
                    }

                    const isExternal = item.url.startsWith('http');
                    return (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-main active:bg-main">
                                {isExternal ? (
                                    <a
                                        href={item.url}
                                        onClick={onItemClick}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {item.icon && <item.icon className="h-4 w-4 flex-shrink-0 text-current" />}
                                        <span>{item.title}</span>
                                    </a>
                                ) : (
                                    <Link href={item.url} onClick={onItemClick}>
                                        {item.icon && <item.icon className="h-4 w-4 flex-shrink-0 text-current" />}
                                        <span>{item.title}</span>
                                    </Link>
                                )}
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </SidebarGroup>
    )
}
