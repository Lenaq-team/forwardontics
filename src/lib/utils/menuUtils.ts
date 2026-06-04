import { menuItems } from '@/lib/data/menuItems';
import { LucideIcon } from 'lucide-react';

export interface MenuItem {
    title: string;
    url: string;
    icon: LucideIcon;
    access: string[];
    items?: {
        title: string;
        url: string;
    }[];
}

export interface SecondaryMenuItem {
    name: string;
    url: string;
    icon: LucideIcon;
    access: string[];
}

export interface SettingsMenuItem {
    name: string;
    url: string;
    icon: LucideIcon;
    access: string[];
}

// Reviewer-test sees the same menu as Reviewer (trial reviewers get full reviewer menu)
const rolesForMenuAccess = (userRoles: string[]): string[] => {
    if (!userRoles?.length) return [];
    if (userRoles.includes('Reviewer-test') && !userRoles.includes('Reviewer')) {
        return [...userRoles, 'Reviewer'];
    }
    return userRoles;
};

// Filter menu items based on user roles
export const filterMenuItemsByRole = (userRoles: string[]) => {
    if (!userRoles || userRoles.length === 0) {
        return {
            navMain: [],
            navSecondary: [],
            navSettings: [],
        };
    }

    const roles = rolesForMenuAccess(userRoles);

    // Filter main navigation
    const filteredNavMain = menuItems.navMain.filter((item: MenuItem) => {
        return item.access.some((role) => roles.includes(role));
    });

    // Filter secondary navigation
    const filteredNavSecondary = menuItems.navSecondary.filter(
        (item: SecondaryMenuItem) => {
            return item.access.some((role) => roles.includes(role));
        }
    );

    // Filter settings navigation
    const filteredNavSettings = menuItems.navSettings.filter(
        (item: SettingsMenuItem) => {
            return item.access.some((role) => roles.includes(role));
        }
    );

    return {
        navMain: filteredNavMain,
        navSecondary: filteredNavSecondary,
        navSettings: filteredNavSettings,
    };
};

// Check if user has access to a specific route
export const hasRouteAccess = (route: string, userRoles: string[]): boolean => {
    if (!userRoles || userRoles.length === 0) return false;
    const roles = rolesForMenuAccess(userRoles);

    const navMain = menuItems.navMain as MenuItem[];
    for (const item of navMain) {
        const hasAccess = item.access.some((role) => roles.includes(role));
        if (!hasAccess) continue;

        if (item.items && item.items.length > 0) {
            for (const subItem of item.items) {
                if (subItem.url === route) return true;
            }
        } else if (item.url === route) {
            return true;
        }
    }

    return false;
};

// Get all accessible routes for a user
export const getAccessibleRoutes = (userRoles: string[]): string[] => {
    if (!userRoles || userRoles.length === 0) return [];
    const roles = rolesForMenuAccess(userRoles);

    const accessibleRoutes: string[] = [];

    (menuItems.navMain as MenuItem[]).forEach((item) => {
        if (item.access.some((role) => roles.includes(role))) {
            if (item.items && item.items.length > 0) {
                item.items.forEach((subItem) => {
                    accessibleRoutes.push(subItem.url);
                });
            } else if (item.url && item.url !== '#') {
                accessibleRoutes.push(item.url);
            }
        }
    });

    return accessibleRoutes;
};
