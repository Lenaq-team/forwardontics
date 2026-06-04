import {
    BookOpen,
    Settings2,
    ShoppingCart,
    Users,
    UserCheck,
    UserCog,
    Video,
    Film,
    UserPen,
    Home,
    Brain,
    GraduationCap,
} from 'lucide-react';

export const menuItems = {
    user: {
        name: 'shadcn',
        email: 'm@example.com',
        avatar: '/avatars/shadcn.jpg',
    },
    navMain: [
        {
            title: 'Home',
            url: '/platform',
            icon: Home,
            access: ['User', 'Reviewer', 'Admin'],
        },
        {
            title: 'New Video',
            url: '/platform/recordvideo',
            icon: Video,
            access: ['User'],
        },
        {
            title: 'My Videos',
            url: '/platform/myvideos',
            icon: Film,
            access: ['User'],
        },

        {
            title: 'My Patients',
            url: '/platform/patients',
            icon: Users,
            access: ['Reviewer'],
        },
        {
            title: 'Pending Reviews',
            url: '/platform/pendingreviews',
            icon: UserPen,
            access: ['Reviewer'],
        },
        {
            title: 'Completed Reviews',
            url: '/platform/completedreviews',
            icon: UserCheck,
            access: ['Reviewer'],
        },
        {
            title: 'Examples',
            url: '/platform/examples',
            icon: GraduationCap,
            access: ['User', 'Reviewer'],
        },
        {
            title: 'Users',
            url: '/platform/admin/users',
            icon: UserCog,
            access: ['Admin'],
        },
        // {
        //     title: 'Tutorials',
        //     url: '#',
        //     icon: BookOpen,
        //     access: ['User', 'Reviewer', 'Admin'], // All authenticated users
        //     items: [
        //         {
        //             title: 'Benefits',
        //             url: '#',
        //         },
        //         {
        //             title: 'YouTube Channel',
        //             url: 'https://www.youtube.com/@Forwardontics',
        //         },
        //     ],
        // },
    ],
    navSecondary: [
        // {
        //     name: 'Join GOPex Club',
        //     url: 'https://gopex.org/',
        //     icon: Users,
        //     access: ['User', 'Reviewer', 'Admin'], // All authenticated users
        // },
        // {
        //     name: 'Forwardontics Store',
        //     url: 'https://forwardontics.com/collections/all',
        //     icon: ShoppingCart,
        //     access: ['User', 'Reviewer', 'Admin'], // All authenticated users
        // },
    ],
    navSettings: [
        // {
        //     name: 'Settings',
        //     url: '/platform/settings',
        //     icon: Settings2,
        //     access: ['User', 'Reviewer', 'Admin'], // All authenticated users
        // },
    ],
};
