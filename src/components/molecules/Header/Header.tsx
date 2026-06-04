import { SidebarTrigger } from "@/components/ui";

const Header = () => {
    return (
        <header className="hidden md:flex h-14 min-h-14 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-quaternary ">
            <div className="flex items-center gap-2 px-4">
                <SidebarTrigger className="-ml-1" />
            </div>
        </header>
    )
}

export default Header;