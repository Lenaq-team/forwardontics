"use client";

import Link from "next/link";
import { Home, Users, UserCog } from "lucide-react";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AdminPage = () => {
    return (
        <div className="container mx-auto p-6 overflow-y-auto space-y-6">
            {/* Breadcrumb */}
            <Breadcrumb className="hidden md:block">
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/platform">
                            <Home className="h-4 w-4" />
                        </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>Admin</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            {/* Welcome */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-main/10 text-main">
                            <UserCog className="h-6 w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Admin</h1>
                            <p className="text-muted-foreground">
                                Manage platform users and settings.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Admin actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link href="/platform/admin/users" className="block">
                    <Card className="h-full cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-main/30 border-2">
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-main" />
                                <CardTitle className="text-base">Users</CardTitle>
                            </div>
                            <CardDescription>
                                Create and manage user accounts, roles, and access.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <span className="text-sm font-medium text-main">
                                Manage users →
                            </span>
                        </CardContent>
                    </Card>
                </Link>

                <Card className="h-full border-2 border-dashed border-neutral-200 dark:border-neutral-800 opacity-80">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <UserCog className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base text-muted-foreground">
                                Reviewers
                            </CardTitle>
                        </div>
                        <CardDescription>
                            Manage reviewer capacity and access. Coming soon.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <span className="text-sm text-muted-foreground">Coming soon</span>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminPage;
