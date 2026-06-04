"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    Home,
    SquarePlay,
    Settings2,
    Video,
    GraduationCap,
    Users,
    UserPen,
    UserCheck,
} from "lucide-react"
import { filterMenuItemsByRole } from "@/lib/utils/menuUtils"
import { useUser } from "@/contexts"

const UserBottomNavigation = () => {
    const router = useRouter()
    const pathname = usePathname()
    const { user, roles } = useUser()
    const [isVisible, setIsVisible] = React.useState(true)
    // const [showLinksMenu, setShowLinksMenu] = React.useState(false)

    // Links menu items (commented out for now)
    // const linksMenuItems: LinkItem[] = [
    //     {
    //         title: 'Benefits',
    //         url: '#',
    //         isExternal: false
    //     },
    //     {
    //         title: 'YouTube Channel',
    //         url: 'https://www.youtube.com/@Forwardontics',
    //         isExternal: true
    //     },
    //     {
    //         title: 'Join GOPex Club',
    //         url: 'https://gopex.org/',
    //         isExternal: true
    //     },
    //     {
    //         title: 'Forwardontics Store',
    //         url: 'https://forwardontics.com/collections/all',
    //         isExternal: true
    //     }
    // ]

    // Simplified and working scroll detection logic
    React.useEffect(() => {
        let lastScrollTop = 0
        let hideTimer: ReturnType<typeof setTimeout>

        const handleScroll = () => {
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop

            // Clear previous timer
            if (hideTimer) {
                clearTimeout(hideTimer)
            }

            if (currentScrollTop > lastScrollTop && currentScrollTop > 50) {
                // Scrolling down - hide navigation
                setIsVisible(false)
            } else {
                // Scrolling up or at top - show navigation
                setIsVisible(true)
            }

            lastScrollTop = currentScrollTop

            // Auto-hide after scrolling stops (increased delay for better UX)
            hideTimer = setTimeout(() => {
                if (currentScrollTop > 50) {
                    setIsVisible(false)
                }
            }, 3000)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })

        return () => {
            window.removeEventListener('scroll', handleScroll)
            if (hideTimer) {
                clearTimeout(hideTimer)
            }
        }
    }, [])

    // Filter menu items based on user roles
    const filteredMenuItems = React.useMemo(() =>
        filterMenuItemsByRole(roles),
        [roles]
    );

    console.log('UserBottomNavigation - Filtered menu items:', filteredMenuItems)
    console.log('UserBottomNavigation - navMain:', filteredMenuItems.navMain)
    console.log('UserBottomNavigation - navSecondary:', filteredMenuItems.navSecondary)
    console.log('UserBottomNavigation - navSettings:', filteredMenuItems.navSettings)

    // Don't render if no user
    if (!user) {
        console.log('UserBottomNavigation - No user, not rendering')
        return null;
    }

    console.log('UserBottomNavigation - Rendering for user:', user.email)
    console.log('UserBottomNavigation - User role:', user.role)

    const isReviewerOrAdmin = roles.includes("Reviewer") || roles.includes("Admin");

    const navigationItems = isReviewerOrAdmin
        ? [
            { icon: Home, label: "Home", url: "/platform", isActive: pathname === "/platform" },
            { icon: Users, label: "Patients", url: "/platform/patients", isActive: pathname === "/platform/patients" },
            { icon: UserPen, label: "Pending", url: "/platform/pendingreviews", isActive: pathname === "/platform/pendingreviews" },
            { icon: UserCheck, label: "Completed", url: "/platform/completedreviews", isActive: pathname === "/platform/completedreviews" },
            { icon: GraduationCap, label: "Examples", url: "/platform/examples", isActive: pathname === "/platform/examples" },
            { icon: Settings2, label: "Settings", url: "/platform/settings", isActive: pathname === "/platform/settings" },
        ]
        : [
            { icon: Home, label: "Home", url: "/platform", isActive: pathname === "/platform" },
            { icon: SquarePlay, label: "Videos", url: "/platform/myvideos", isActive: pathname === "/platform/myvideos" },
            { icon: Video, label: "Record", url: "/platform/recordvideo", isActive: pathname === "/platform/recordvideo", isCentral: true as const },
            { icon: GraduationCap, label: "Examples", url: "/platform/examples", isActive: pathname === "/platform/examples" },
            { icon: Settings2, label: "Settings", url: "/platform/settings", isActive: pathname === "/platform/settings" },
        ]

    const handleNavigation = (url: string, label: string) => {
        console.log('handleNavigation called:', { url, label })

        // if (label === "Links") {
        //     setShowLinksMenu(!showLinksMenu)
        //     return
        // }

        if (url && url !== "#" && url !== undefined) {
            console.log('Navigating to:', url)
            router.push(url)
        } else {
            console.log('Cannot navigate - invalid URL:', url)
        }
    }

    // const handleLinkClick = (link: LinkItem) => {
    //     if (link.isExternal) {
    //         window.open(link.url, '_blank', 'noopener,noreferrer')
    //     } else {
    //         router.push(link.url)
    //     }
    //     setShowLinksMenu(false)
    // }

    return (
        <AnimatePresence mode="wait">
            {isVisible && (
                <motion.div
                    className="fixed bottom-0 left-0 right-0 z-[9999] bg-main/95 backdrop-blur-md border-t border-white/10 shadow-2xl md:hidden"
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 40,
                        duration: 0.3
                    }}
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                >
                    <div className="flex items-center justify-around px-2 py-0">
                        {navigationItems.map((item, index) => {
                            console.log(`UserBottomNavigation - Rendering item ${index}:`, item)
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    className="flex flex-col items-center justify-center gap-1 h-16 flex-1 rounded-none transition-colors duration-200 text-white z-[9999] cursor-pointer hover:bg-white/10 select-none border-none bg-transparent"
                                    onClick={() => {
                                        console.log('=== BUTTON CLICKED ===');
                                        console.log('Button clicked:', item.label);
                                        console.log('Button URL:', item.url);
                                        console.log('Button item:', item);
                                        handleNavigation(item.url, item.label);
                                    }}
                                >
                                    {item.isCentral ? (
                                        <div className="bg-purple-600 rounded-full p-4 border border-accent pointer-events-none mb-2">
                                            <item.icon className="h-8 w-8" />
                                        </div>
                                    ) : (
                                        <div className="pointer-events-none">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                    )}
                                    {!item.isCentral && (
                                        <span className={`text-xs pointer-events-none ${item.isActive ? 'font-bold' : 'font-light'}`}>
                                            {item.label}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* Links Menu (commented out for now)
                    <AnimatePresence>
                        {showLinksMenu && (
                            <motion.div
                                className="bg-main/95 backdrop-blur-md border-t border-white/10"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="px-4 py-3">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-white text-sm font-medium">Quick Links</h3>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-white hover:bg-white/20"
                                            onClick={() => setShowLinksMenu(false)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {linksMenuItems.map((link, index) => (
                                            <Button
                                                key={index}
                                                variant="ghost"
                                                size="sm"
                                                className="flex items-center justify-between h-10 px-3 text-white hover:bg-white/20 text-left"
                                                onClick={() => handleLinkClick(link)}
                                            >
                                                <span className="text-xs truncate">{link.title}</span>
                                                {link.isExternal && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    */}
                </motion.div>
            )}
        </AnimatePresence>
    )
}

export default UserBottomNavigation
