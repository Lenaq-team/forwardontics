import { LoginPage } from "@/components"
import { memo } from "react"

const Login = memo(() => {
    return <LoginPage />
})

Login.displayName = 'Login';

export default Login;