"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
    Menu,
    ChevronRight,
    Home
} from "lucide-react"
import Image from "next/image"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui"
import { Button } from "@/components/ui"
import { filterMenuItemsByRole } from "@/lib/utils/menuUtils"
import { useUser, useRecording } from "@/contexts"
import { UserBottomNavigation } from "@/components/molecules/UserBottomNavigation"

const MobileHeader = () => {
    const router = useRouter()
    const { user, roles } = useUser()
    const { isRecording } = useRecording()
    const [isVisible, setIsVisible] = React.useState(true)
    const [lastScrollY, setLastScrollY] = React.useState(0)
    const [isOpen, setIsOpen] = React.useState(false)

    // Filter menu items based on user roles
    const filteredMenuItems = React.useMemo(() =>
        filterMenuItemsByRole(roles),
        [roles]
    );

    React.useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY

            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                // Scrolling down and past 100px
                setIsVisible(false)
            } else {
                // Scrolling up
                setIsVisible(true)
            }

            setLastScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [lastScrollY])

    const handleNavigation = (url: string) => {
        router.push(url)
        setIsOpen(false)
    }

    // Don't render if no user
    if (!user) {
        return null;
    }

    // Hide UserBottomNavigation when recording
    if (isRecording) {
        return null;
    }

    // Debug logging
    console.log('MobileHeader - User:', user)
    console.log('MobileHeader - User role:', user.role)
    console.log('MobileHeader - Roles array:', roles)

    // If user has role "user", show bottom navigation instead of hamburger
    if (user.role === "User" || user.role === "user" || user.role.toLowerCase() === "user") {
        console.log('MobileHeader - Showing UserBottomNavigation')
        return <UserBottomNavigation />;
    }

    // TEMPORARY: Always show UserBottomNavigation for testing
    console.log('MobileHeader - TEMPORARY: Always showing UserBottomNavigation for testing')
    return <UserBottomNavigation />;
}

export default MobileHeader