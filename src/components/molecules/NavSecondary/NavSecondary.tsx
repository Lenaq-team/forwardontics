"use client"

import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

const NavSecondary = ({
    items,
    onItemClick,
}: {
    items: {
        name: string
        url: string
        icon: LucideIcon
    }[]
    onItemClick?: () => void
}) => {

    return (
        <SidebarMenu>
            {items.map((item) => {
                const isExternal = item.url.startsWith('http');
                return (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton asChild>
                            {isExternal ? (
                                <a
                                    href={item.url}
                                    onClick={onItemClick}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.name}</span>
                                </a>
                            ) : (
                                <Link
                                    href={item.url}
                                    onClick={onItemClick}
                                >
                                    <item.icon className="h-4 w-4" />
                                    <span>{item.name}</span>
                                </Link>
                            )}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    )
}

export default NavSecondary;