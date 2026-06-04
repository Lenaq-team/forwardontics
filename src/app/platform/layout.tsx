import { AppSidebar, Header, MobileHeader, MembershipAlert, TermsGuard } from '@/components';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { RecordingProvider, TimezoneProvider } from '@/contexts';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
    return (
        <TermsGuard>
        <RecordingProvider>
        <TimezoneProvider>
            <div className="flex h-screen flex-col md:flex-row">
                <MobileHeader />
                <SidebarProvider>
                    <AppSidebar key="sidebar" />
                    <SidebarInset>
                        <MembershipAlert />
                        <Header />
                        <main className="flex-1 bg-quaternary pt-0 pb-20 md:pb-0">{children}</main>
                </SidebarInset>
            </SidebarProvider>
        </div>
        </TimezoneProvider>
        </RecordingProvider>
        </TermsGuard>
    );
}
