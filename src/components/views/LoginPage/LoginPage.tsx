import { LoginForm } from "@/components"
import Image from "next/image"
import { memo } from "react"

const LoginPage = memo(() => {
    return (
        <div className="bg-quaternary flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex w-full max-w-sm flex-col gap-6">
                <a
                    href="https://gopex.org/"
                    className="flex items-center gap-2 self-center font-medium"
                    rel="noopener noreferrer"
                    target="_blank"
                >
                    <Image src="/images/gopex.jpeg" alt="logo" width={50} height={50} className="rounded-lg" />
                    <h1 className="text-3xl font-bold">GOPex</h1>
                </a>
                <LoginForm />
            </div>
        </div>
    )
})

LoginPage.displayName = 'LoginPage';

export default LoginPage;